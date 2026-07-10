import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 민감 도메인(MED/LEG) 첨부파일 다운로드 전 세션 재인증(step-up) 토큰.
 *
 * 로컬 스택은 MFA(TOTP)가 비활성(config.toml auth.mfa.totp enroll/verify=false)이라
 * 풀 MFA 대신 "비밀번호 재입력 → 짧은 TTL 재인증 토큰" 방식을 쓴다.
 * 토큰은 `${userId}:${exp}` 에 대한 HMAC-SHA256 서명이며 상태를 서버에 저장하지 않는다
 * (stateless). userId 바인딩으로 타 사용자 토큰 재사용을 막고, exp 로 5분 만료를 강제한다.
 */

const TTL_MS = 5 * 60 * 1000; // 5분

function secret(): string {
  const s = process.env.SUPABASE_JWT_SECRET;
  if (!s) throw new Error("SUPABASE_JWT_SECRET 미설정 — 재인증 토큰 서명 불가");
  return s;
}

function sign(userId: string, exp: number): string {
  return createHmac("sha256", secret()).update(`${userId}:${exp}`).digest("hex");
}

/** 재인증 성공 시 발급. `${exp}.${sig}` 형태. */
export function issueReauthToken(userId: string): string {
  const exp = Date.now() + TTL_MS;
  return `${exp}.${sign(userId, exp)}`;
}

/** 토큰이 해당 userId 에 대해 유효하고 만료 전인지 검증. */
export function verifyReauthToken(token: string | undefined | null, userId: string): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = sign(userId, exp);
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export const REAUTH_COOKIE = "ongil_reauth";
export const REAUTH_HEADER = "x-reauth-token";
export const REAUTH_TTL_SECONDS = TTL_MS / 1000;
