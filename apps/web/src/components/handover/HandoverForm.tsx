"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { handoverPrioritySchema, type HandoverPriority } from "@ongil/validation";
import {
  createHandover,
  getHandoverTargets,
  type HandoverTarget,
} from "@/app/(app)/handovers/actions";
import { Button } from "@/components/ui/button";

/**
 * S-21 인계인수 작성 폼. docs/04-workflow.md Flow-S-02.
 * 대상 당사자 선택 → 대상 지원사 선택(getHandoverTargets) → 내용·중요도 입력 → 제출.
 * 담당 이용자 목록은 S-12와 동일하게 기존 일지에 등장한 이용자에서 파생해 상위에서 주입한다.
 */

export interface HandoverPersonOption {
  id: string;
  name: string;
}

const PRIORITIES: { value: HandoverPriority; label: string }[] = [
  { value: "high", label: "중요" },
  { value: "normal", label: "보통" },
  { value: "low", label: "참고" },
];

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600";

export function HandoverForm({ persons }: { persons: HandoverPersonOption[] }) {
  const router = useRouter();
  const personFieldId = useId();
  const targetFieldId = useId();
  const contentFieldId = useId();
  const priorityFieldId = useId();

  const [personId, setPersonId] = useState(persons[0]?.id ?? "");
  const [targets, setTargets] = useState<HandoverTarget[] | "loading">(
    persons[0] ? "loading" : []
  );
  const [toUserId, setToUserId] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<HandoverPriority>("normal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadTargets(pid: string) {
    if (!pid) {
      setTargets([]);
      setToUserId("");
      return;
    }
    setTargets("loading");
    setToUserId("");
    const list = await getHandoverTargets(pid);
    setTargets(list);
    setToUserId(list[0]?.userId ?? "");
  }

  // 최초 마운트 시 첫 당사자의 대상 목록을 로드한다.
  const [initialized, setInitialized] = useState(false);
  if (!initialized && persons[0]) {
    setInitialized(true);
    void loadTargets(persons[0].id);
  }

  function handlePersonChange(pid: string) {
    setPersonId(pid);
    void loadTargets(pid);
  }

  async function handleSubmit() {
    setError(null);
    if (!personId) {
      setError("당사자를 선택해주세요.");
      return;
    }
    const parsed = handoverPrioritySchema.safeParse(priority);
    if (!parsed.success) {
      setError("중요도를 확인해주세요.");
      return;
    }
    if (!toUserId) {
      setError("인계 대상 지원사를 선택해주세요.");
      return;
    }
    if (!content.trim()) {
      setError("인계 내용을 입력해주세요.");
      return;
    }

    setBusy(true);
    const res = await createHandover(personId, {
      toUserId,
      content: content.trim(),
      priority,
    });
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push("/handovers");
    router.refresh();
  }

  if (persons.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">인계인수 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          아직 담당 이용자가 없어 인계인수를 작성할 수 없습니다. 활동일지를 남긴 이용자가 생기면
          해당 이용자의 인계를 작성할 수 있습니다.
        </p>
        <Button variant="outline" render={<Link href="/handovers" />} className="mt-5 h-11">
          ← 목록으로
        </Button>
      </div>
    );
  }

  const noTargets = Array.isArray(targets) && targets.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">인계인수 작성</h1>
      <p className="mt-1 text-body text-muted-foreground">
        다음 지원사에게 전달할 인계 사항을 작성합니다.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={personFieldId} className="text-label font-semibold text-accent-stone">
            대상 당사자 <span className="text-domain-med-text">*</span>
          </label>
          <select
            id={personFieldId}
            className={fieldClass}
            value={personId}
            onChange={(e) => handlePersonChange(e.target.value)}
          >
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={targetFieldId} className="text-label font-semibold text-accent-stone">
            인계 대상 지원사 <span className="text-domain-med-text">*</span>
          </label>
          <select
            id={targetFieldId}
            className={fieldClass}
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            disabled={targets === "loading" || noTargets}
          >
            {targets === "loading" && <option value="">불러오는 중...</option>}
            {noTargets && <option value="">인계할 다른 지원사가 없습니다</option>}
            {Array.isArray(targets) &&
              targets.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.fullName ?? "지원사"}
                </option>
              ))}
          </select>
          {noTargets && (
            <p className="text-caption text-muted-foreground">
              이 당사자에게 활동지원 권한을 가진 다른 지원사가 없어 인계 대상을 선택할 수 없습니다.
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend id={priorityFieldId} className="text-label font-semibold text-accent-stone">
            중요도
          </legend>
          <div className="flex gap-2" role="radiogroup" aria-labelledby={priorityFieldId}>
            {PRIORITIES.map((p) => {
              const on = priority === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPriority(p.value)}
                  className={`min-h-11 flex-1 rounded-(--br-md) border-2 px-3 text-body font-semibold transition-colors ${
                    on
                      ? "border-primary-600 bg-primary-50 text-primary-800"
                      : "border-border text-accent-stone hover:border-primary-400"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={contentFieldId} className="text-label font-semibold text-accent-stone">
            인계 내용 <span className="text-domain-med-text">*</span>
          </label>
          <textarea
            id={contentFieldId}
            className={`${fieldClass} min-h-40 py-2`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={3000}
            placeholder="다음 지원사가 참고할 인계 사항을 작성하세요."
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Button variant="outline" render={<Link href="/handovers" />} className="h-11">
          ← 취소
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          className="h-11 bg-primary-600 font-bold"
          disabled={busy || noTargets || targets === "loading"}
          onClick={() => void handleSubmit()}
        >
          {busy ? "제출 중..." : "인계 보내기"}
        </Button>
      </div>
    </div>
  );
}
