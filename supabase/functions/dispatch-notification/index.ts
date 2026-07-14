// dispatch-notification — Flow-SYS-03 실제 알림 발송 파이프라인 (FCM v1 + Resend 폴백)
// 참조: docs/04-workflow.md Flow-SYS-03, docs/05-erd.md §2-11-1 / §4-12
// 작성: backend-db
//
// 트리거 경로: notifications 테이블 AFTER INSERT → dispatch_notification() (pg_net)
//   → net.http_post(.../functions/v1/dispatch-notification, body := to_jsonb(NEW))
//   → 이 함수. body 는 notifications 행 그대로(snake_case): id, recipient_id, type,
//     title, body, data, is_read, sent_at, read_at.
//
// 발송 규칙:
//   1. notification_preferences(user_id=recipient_id, type) 조회. 행이 없으면 스키마
//      기본값(fcm_enabled=true, email_enabled=true)과 동일하게 "둘 다 활성"으로 간주.
//   2. fcm_enabled && users.fcm_token 있으면 FCM v1 시도.
//   3. FCM 실패(토큰 없음·비활성·API 에러) 시 email_enabled && users.email 있으면 Resend 폴백.
//   4. FCM/Resend 자체의 "실패"는 이미 폴백까지 시도한 정상 처리이므로 200 응답
//      (웹훅 재시도 불필요). 예상 못 한 내부 오류만 500(웹훅이 자동 재시도).
//
// 배포/시크릿은 이 세션에서 실행 불가한 수동 운영 작업이다 — 파일 하단 및 최종 보고 참조.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── 시크릿(Edge Function 환경변수) ───────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID") ?? "";
const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "";

interface NotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

// ── base64url 인코딩 헬퍼(JWT 세그먼트용) ────────────────────────────────────
function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// PKCS#8 PEM(private_key) → CryptoKey(RS256 서명용)
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const der = atob(
    pem
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\s+/g, ""),
  );
  const bytes = new Uint8Array(der.length);
  for (let i = 0; i < der.length; i++) bytes[i] = der.charCodeAt(i);
  return await crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

// 서비스 계정 JWT bearer flow → OAuth2 access token (FCM v1 전송 권한)
export async function getFcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth2 token 발급 실패 (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

// FCM HTTP v1 전송. 성공 시 true, 실패 시 false(폴백 유도) — 예외를 던지지 않는다.
export async function sendFcm(
  accessToken: string,
  fcmToken: string,
  n: NotificationRow,
): Promise<boolean> {
  // data 값은 문자열만 허용 → 전부 문자열화
  const dataStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(n.data ?? {})) {
    dataStr[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  dataStr.type = n.type;
  dataStr.notification_id = n.id;

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title: n.title, body: n.body ?? "" },
          data: dataStr,
        },
      }),
    },
  );
  if (!res.ok) {
    console.error(`FCM 전송 실패 (${res.status}): ${await res.text()}`);
    return false;
  }
  return true;
}

// Resend 이메일 폴백. 성공 시 true. 예외를 던지지 않는다.
export async function sendEmailFallback(
  email: string,
  n: NotificationRow,
): Promise<boolean> {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error("Resend 시크릿 미설정 — 이메일 폴백 스킵");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [email],
      subject: n.title,
      html: `<p>${n.body ?? ""}</p>`,
    }),
  });
  if (!res.ok) {
    console.error(`Resend 전송 실패 (${res.status}): ${await res.text()}`);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const n = (await req.json()) as NotificationRow;
    if (!n?.recipient_id || !n?.id) {
      console.error("잘못된 페이로드(recipient_id/id 없음)", n);
      return new Response("bad payload", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 채널 설정: 행이 없으면 기본값(둘 다 활성)
    const { data: pref } = await supabase
      .from("notification_preferences")
      .select("fcm_enabled, email_enabled")
      .eq("user_id", n.recipient_id)
      .eq("type", n.type)
      .maybeSingle();
    const fcmEnabled = pref?.fcm_enabled ?? true;
    const emailEnabled = pref?.email_enabled ?? true;

    // 수신자 채널 주소
    const { data: user } = await supabase
      .from("users")
      .select("fcm_token, email")
      .eq("id", n.recipient_id)
      .maybeSingle();
    const fcmToken = user?.fcm_token ?? null;
    const email = user?.email ?? null;

    let fcmDelivered = false;
    if (fcmEnabled && fcmToken && FCM_SERVICE_ACCOUNT_JSON && FCM_PROJECT_ID) {
      try {
        const sa = JSON.parse(FCM_SERVICE_ACCOUNT_JSON) as ServiceAccount;
        const token = await getFcmAccessToken(sa);
        fcmDelivered = await sendFcm(token, fcmToken, n);
      } catch (e) {
        console.error("FCM 경로 예외 — 이메일 폴백으로 전환", e);
        fcmDelivered = false;
      }
    } else {
      console.log(
        `FCM 스킵 (fcm_enabled=${fcmEnabled}, token=${!!fcmToken}) → 폴백 검토`,
      );
    }

    if (!fcmDelivered) {
      if (emailEnabled && email) {
        const ok = await sendEmailFallback(email, n);
        console.log(`이메일 폴백 ${ok ? "성공" : "실패"} (${email})`);
      } else {
        console.log(
          `이메일 폴백 스킵 (email_enabled=${emailEnabled}, email=${!!email}) — 인앱 알림만 유지`,
        );
      }
    } else {
      console.log(`FCM 전송 성공 (recipient=${n.recipient_id}, type=${n.type})`);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    // 예상 못 한 내부 오류만 500 → 웹훅 자동 재시도
    console.error("dispatch-notification 내부 오류", e);
    return new Response("internal error", { status: 500 });
  }
});
