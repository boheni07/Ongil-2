"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  exportMyData,
  reacquireConsent,
  withdrawAllConsentsAndDeactivate,
  withdrawOptionalConsent,
  type ConsentStatus,
  type ReacquisitionTarget,
} from "./actions";

/**
 * consent_type → 한글 라벨. 온보딩 ConsentForm(components/auth/ConsentForm.tsx)의 문구와 동일 계열로
 * 맞춘다(동일 동의 항목을 두 화면에서 같은 이름으로 부르기 위함).
 */
const CONSENT_LABELS: Record<string, string> = {
  terms: "이용약관 동의",
  privacy: "개인정보 수집·이용 동의",
  sensitive: "민감정보(건강·장애) 처리 동의",
  unique_id: "고유식별정보 처리 동의",
  marketing: "마케팅·이벤트 정보 수신",
};

function labelOf(type: string): string {
  return CONSENT_LABELS[type] ?? type;
}

function isActive(c: ConsentStatus): boolean {
  return c.isAgreed && !c.revokedAt;
}

export function PrivacySettingsClient({
  role,
  consents,
  reacquisitionTargets,
}: {
  role: string | null;
  consents: ConsentStatus[];
  reacquisitionTargets: ReacquisitionTarget[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmTitleId = useId();
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showConfirm) return;
    cancelBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowConfirm(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showConfirm]);

  const required = consents.filter((c) => c.isRequired);
  const optional = consents.filter((c) => !c.isRequired);
  const showReacquisition = role === "person" && reacquisitionTargets.length > 0;

  const heading =
    role === "person" ? "내 동의·권리 관리" : "동의·권리 관리";

  function handleWithdrawMarketing(consentType: string) {
    setError(null);
    startTransition(async () => {
      const res = await withdrawOptionalConsent(consentType);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function handleReacquire(consentType: string) {
    setError(null);
    startTransition(async () => {
      const res = await reacquireConsent(consentType);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  async function handleExport() {
    setError(null);
    setExporting(true);
    try {
      const res = await exportMyData();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const blob = new Blob([JSON.stringify(res, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ongil-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleDeactivate() {
    setError(null);
    setDeactivating(true);
    startTransition(async () => {
      const res = await withdrawAllConsentsAndDeactivate();
      if (res.error) {
        setError(res.error);
        setDeactivating(false);
        setShowConfirm(false);
        return;
      }
      // 성공 → 세션 종료 후 로그인 화면으로. (계정 삭제가 아니라 비활성화다.)
      await createClient().auth.signOut();
      router.replace("/login");
    });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-headline-1 font-extrabold text-foreground">{heading}</h1>
      <p className="mt-1 text-body text-muted-foreground">
        내 동의 현황을 확인하고, 선택 동의 철회·데이터 내보내기·계정 비활성화를 관리할 수 있습니다.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-(--br-md) bg-red-50 px-4 py-3 text-body text-red-700">
          {error}
        </p>
      )}

      {/* 성년 전환 — 본인 동의 재취득 (person + 재취득 대상 있을 때만) */}
      {showReacquisition && (
        <section className="mt-6 rounded-(--br-md) bg-domain-dai-bg p-5 ring-1 ring-domain-dai-accent/30">
          <h2 className="text-body font-bold text-domain-dai-text">성년 전환 · 본인 동의 재취득</h2>
          <p className="mt-1 text-body leading-relaxed text-foreground/80">
            성년이 되어 기록·동의의 주체가 본인으로 이관되었습니다. 아래 필수 동의를 본인 명의로 다시 확인해주세요.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {reacquisitionTargets.map((t) => (
              <li
                key={t.consentType}
                className="flex items-center justify-between gap-3 rounded-(--br-md) bg-white px-4 py-3 ring-1 ring-foreground/10"
              >
                <span className="text-body font-semibold text-foreground">
                  {labelOf(t.consentType)}
                </span>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => handleReacquire(t.consentType)}
                  className="h-10 bg-accent-amber px-4 font-bold text-accent-stone hover:bg-[#f5bd5e]"
                >
                  동의합니다
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 내 동의 현황 — 필수 */}
      <section className="mt-8">
        <h2 className="text-body font-bold text-foreground">필수 동의</h2>
        <p className="mt-1 text-caption text-muted-foreground">
          서비스 이용의 전제라 개별 철회할 수 없으며, 계정 비활성화 시 함께 철회됩니다.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {required.length === 0 ? (
            <li className="rounded-(--br-md) bg-white px-4 py-3 text-body text-muted-foreground ring-1 ring-foreground/10">
              표시할 동의 항목이 없습니다.
            </li>
          ) : (
            required.map((c) => (
              <li
                key={c.consentType}
                className="flex items-center justify-between gap-3 rounded-(--br-md) bg-white px-4 py-3 ring-1 ring-foreground/10"
              >
                <span className="text-body font-semibold text-foreground">
                  {labelOf(c.consentType)}
                </span>
                <StatusBadge active={isActive(c)} />
              </li>
            ))
          )}
        </ul>
      </section>

      {/* 내 동의 현황 — 선택 */}
      <section className="mt-8">
        <h2 className="text-body font-bold text-foreground">선택 동의</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {optional.length === 0 ? (
            <li className="rounded-(--br-md) bg-white px-4 py-3 text-body text-muted-foreground ring-1 ring-foreground/10">
              선택 동의 항목이 없습니다.
            </li>
          ) : (
            optional.map((c) => (
              <li
                key={c.consentType}
                className="flex items-center justify-between gap-3 rounded-(--br-md) bg-white px-4 py-3 ring-1 ring-foreground/10"
              >
                <span className="text-body font-semibold text-foreground">
                  {labelOf(c.consentType)}
                </span>
                {isActive(c) ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleWithdrawMarketing(c.consentType)}
                    className="h-10 px-4 font-semibold"
                  >
                    철회
                  </Button>
                ) : (
                  <StatusBadge active={false} />
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      {/* 데이터 내보내기 */}
      <section className="mt-8 rounded-(--br-md) bg-white p-5 ring-1 ring-foreground/10">
        <h2 className="text-body font-bold text-foreground">내 데이터 내보내기</h2>
        <p className="mt-1 text-caption text-muted-foreground">
          내 프로필·동의 이력·관리 대상자 요약을 JSON 파일로 내려받습니다.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={exporting}
          onClick={handleExport}
          className="mt-3 h-11 px-5 font-semibold"
        >
          {exporting ? "내보내는 중..." : "JSON으로 내보내기"}
        </Button>
      </section>

      {/* 위험 액션 — 동의 전체철회 및 계정 비활성화 */}
      <section className="mt-8 rounded-(--br-md) bg-red-50 p-5 ring-1 ring-red-200">
        <h2 className="text-body font-bold text-red-700">동의 전체철회 및 계정 비활성화</h2>
        <p className="mt-1 text-caption leading-relaxed text-red-700/90">
          모든 동의를 철회하고 계정을 비활성화합니다. 계정과 기록이 삭제되는 것은 아니며, 다시 로그인하면
          비활성화가 해제됩니다. 단, 철회된 동의는 자동으로 복구되지 않으니 재로그인 후 서비스를 계속
          이용하려면 이 화면에서 필수 동의를 다시 진행해야 할 수 있습니다.
        </p>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => setShowConfirm(true)}
          className="mt-3 h-11 px-5 font-bold"
        >
          동의 전체철회 및 계정 비활성화
        </Button>
      </section>

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={confirmTitleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id={confirmTitleId} className="text-headline-2 font-extrabold text-foreground">
              정말 진행할까요?
            </h3>
            <p className="mt-2 text-body leading-relaxed text-muted-foreground">
              모든 동의가 철회되고 계정이 비활성화됩니다. 진행하면 자동으로 로그아웃됩니다.
              (계정·기록은 삭제되지 않으며, 다시 로그인하면 해제됩니다.)
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                ref={cancelBtnRef}
                type="button"
                variant="ghost"
                disabled={deactivating}
                onClick={() => setShowConfirm(false)}
                className="h-11 px-5 font-semibold"
              >
                취소
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deactivating}
                onClick={handleDeactivate}
                className="h-11 px-5 font-bold"
              >
                {deactivating ? "처리 중..." : "전체철회 및 비활성화"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded-(--br-sm) bg-primary-100 px-2.5 py-1 text-caption font-bold text-primary-700">
      동의함
    </span>
  ) : (
    <span className="rounded-(--br-sm) bg-muted px-2.5 py-1 text-caption font-bold text-muted-foreground">
      철회됨
    </span>
  );
}
