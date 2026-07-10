"use client";

import { useActionState, useState } from "react";
import { uploadAttachment, type UploadState } from "./actions";

/**
 * P0-6 검증용 최소 업로드/다운로드 UI (풀 UI 는 P1 범위 밖).
 * - 업로드: person_id / record_id / 파일 선택 → Server Action.
 * - 다운로드: attachment_id → presigned URL 발급(GET /api/attachments/url).
 *   MED/LEG 는 재인증(POST /api/attachments/reauth) 후에만 발급됨.
 */
export default function AttachmentsTestPage() {
  const [state, formAction, pending] = useActionState<UploadState | undefined, FormData>(
    uploadAttachment,
    undefined
  );

  const [attachmentId, setAttachmentId] = useState("");
  const [urlResult, setUrlResult] = useState<string>("");
  const [reauthMsg, setReauthMsg] = useState<string>("");

  async function fetchUrl() {
    setUrlResult("요청 중...");
    const res = await fetch(`/api/attachments/url?id=${encodeURIComponent(attachmentId)}`);
    const json = await res.json();
    if (res.ok) {
      setUrlResult(`발급 성공 (${json.domain}, ${json.expiresIn}s): ${json.url}`);
    } else if (json.reauthRequired) {
      setUrlResult("재인증 필요 (MED/LEG). 아래에서 비밀번호로 재인증하세요.");
    } else {
      setUrlResult(`실패 (${res.status}): ${json.error}`);
    }
  }

  async function reauth(formData: FormData) {
    setReauthMsg("재인증 중...");
    const res = await fetch("/api/attachments/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: formData.get("password") }),
    });
    const json = await res.json();
    setReauthMsg(res.ok ? "재인증 완료 — 이제 URL 발급을 다시 시도하세요." : `실패: ${json.error}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">첨부파일 업로드 (P0-6 검증)</h1>
        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <input name="personId" placeholder="person_id (uuid)" className="rounded border px-3 py-2 text-sm" />
          <input name="recordId" placeholder="record_id (uuid)" className="rounded border px-3 py-2 text-sm" />
          <input name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="text-sm" />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "업로드 중..." : "업로드"}
          </button>
        </form>
        {state?.ok && (
          <p className="mt-3 break-all text-sm text-green-600">
            업로드 성공. attachment_id: {state.attachmentId} / path: {state.path}
          </p>
        )}
        {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      </section>

      <section className="border-t pt-6">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Presigned URL 발급</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={attachmentId}
            onChange={(e) => setAttachmentId(e.target.value)}
            placeholder="attachment_id (uuid)"
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button onClick={fetchUrl} className="rounded border px-4 py-2 text-sm">
            URL 발급
          </button>
        </div>
        {urlResult && <p className="mt-3 break-all text-sm text-zinc-700 dark:text-zinc-300">{urlResult}</p>}
      </section>

      <section className="border-t pt-6">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">재인증 (MED/LEG)</h2>
        <form action={reauth} className="mt-3 flex gap-2">
          <input name="password" type="password" placeholder="비밀번호" className="flex-1 rounded border px-3 py-2 text-sm" />
          <button type="submit" className="rounded border px-4 py-2 text-sm">
            재인증
          </button>
        </form>
        {reauthMsg && <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{reauthMsg}</p>}
      </section>
    </div>
  );
}
