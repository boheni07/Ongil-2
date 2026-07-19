"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EmergencyInfoInput } from "@ongil/validation";
import {
  getPersonSummaryCards,
  type GuardianPerson,
  type PersonSummaryCards,
} from "@/app/(app)/dashboard/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { DomainChip } from "@/components/timeline/DomainChip";
import { PendingConfirmCard } from "@/components/dashboard/PendingConfirmCard";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { DomainKey } from "@ongil/shared";
import { computeAge, computeLifeStage } from "@/lib/lifecycle";

/**
 * G-01 PersonCard 수평 슬라이더 + 선택 당사자의 응급정보 PinnedCard + 요약 3카드.
 * 선택 상태를 상위에서 관리하고, 선택이 바뀌면 getPersonSummaryCards로 요약을 다시 불러온다.
 */

const DOMAIN_KEYS: DomainKey[] = ["MED", "EDU", "WEL", "DAI", "TRA", "LEG"];
function toDomain(d: string): DomainKey {
  return (DOMAIN_KEYS.includes(d as DomainKey) ? d : "DAI") as DomainKey;
}

const GENDER_LABEL: Record<string, string> = { M: "남", F: "여", other: "" };

export function PersonSlider({ persons }: { persons: GuardianPerson[] }) {
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<PersonSummaryCards | null>(null);
  const [loading, setLoading] = useState(true);
  // Wave M-3(docs/11-livinglab-mega-workshop.md) — 다자녀 보호자가 슬라이더 화살표를 계속
  // 눌러야 전체를 못 본다는 리빙랩 관찰에 따라, 3명 이상일 때만 그리드 보기 토글을 노출한다.
  const [viewMode, setViewMode] = useState<"slider" | "grid">("slider");

  const selected = persons[index];

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPersonSummaryCards(selected.id).then((res) => {
      if (active) {
        setSummary(res);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selected.id]);

  // emergency_info는 JSONB라 DB가 배열 형태를 강제하지 않는다 — Zod 스키마 도입 전에 쓰인
  // 구형 행(문자열 등)이 있어도 .join()에서 크래시하지 않도록 방어적으로 배열만 취한다.
  const rawEmergency = (selected.emergencyInfo ?? null) as EmergencyInfoInput | null;
  const emergency = rawEmergency && {
    allergies: Array.isArray(rawEmergency.allergies) ? rawEmergency.allergies : [],
    medications: Array.isArray(rawEmergency.medications) ? rawEmergency.medications : [],
    contacts: Array.isArray(rawEmergency.contacts) ? rawEmergency.contacts : [],
  };

  const showGridToggle = persons.length > 2;

  return (
    <div className="flex flex-col gap-6">
      {showGridToggle && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === "slider" ? "grid" : "slider"))}
            className="rounded-(--br-md) border border-border bg-white px-3 py-1.5 text-caption font-semibold text-accent-stone shadow-sm hover:border-primary-400"
          >
            {viewMode === "slider" ? "⊞ 그리드로 보기" : "⟷ 슬라이더로 보기"}
          </button>
        </div>
      )}

      {viewMode === "slider" || !showGridToggle ? (
        <div className="flex items-center gap-2">
          <SliderButton dir="prev" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} />
          <ul className="flex flex-1 gap-3 overflow-x-auto pb-1">
            {persons.map((p, i) => (
              <li key={p.id} className="w-64 shrink-0">
                <PersonCard person={p} selected={i === index} onSelect={() => setIndex(i)} />
              </li>
            ))}
          </ul>
          <SliderButton
            dir="next"
            disabled={index >= persons.length - 1}
            onClick={() => setIndex((i) => Math.min(persons.length - 1, i + 1))}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {persons.map((p, i) => (
            <li key={p.id}>
              <PersonCard person={p} selected={i === index} onSelect={() => setIndex(i)} />
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-xl bg-domain-med-bg p-5 shadow-md ring-1 ring-domain-med-accent/40" aria-label="응급 정보">
        <h3 className="text-headline-3 font-bold text-domain-med-text">🚨 응급 대응 정보 — {selected.fullName}</h3>
        {emergency && (emergency.allergies?.length || emergency.medications?.length || emergency.contacts?.length) ? (
          <div className="mt-3 grid gap-x-6 gap-y-2 text-body sm:grid-cols-2">
            <Emergency k="알레르기" v={emergency.allergies?.join(", ") || "없음"} />
            <Emergency k="복용약" v={emergency.medications?.join(", ") || "없음"} />
            {(emergency.contacts ?? []).map((c, i) => (
              <Emergency key={i} k={`비상연락 (${c.relation || c.name})`} v={`${c.name} ${c.phone}`} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-body text-domain-med-text/80">등록된 응급 정보가 없습니다.</p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="최근 기록">
          {loading ? (
            <Muted>불러오는 중...</Muted>
          ) : summary && summary.recentRecords.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {summary.recentRecords.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <DomainChip domain={toDomain(r.domain)} />
                  <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
                    {r.recordType} · {r.recordDate.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>최근 기록이 없습니다.</Muted>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link
              href={`/persons/${selected.id}/records`}
              className="inline-block text-caption font-semibold text-primary-700 underline"
            >
              전체 기록 보기 →
            </Link>
            <Link
              href={`/persons/${selected.id}/timeline`}
              className="inline-block text-caption font-semibold text-primary-700 underline"
            >
              생애주기 타임라인 보기 →
            </Link>
          </div>
        </Card>

        <Card title="권한 현황">
          {loading ? (
            <Muted>불러오는 중...</Muted>
          ) : (
            <>
              <p className="text-2xl font-extrabold text-primary-700">{summary?.permissionCount ?? 0}건</p>
              <Link
                href={`/persons/${selected.id}/permissions`}
                className="mt-1 inline-block text-caption font-semibold text-primary-700 underline"
              >
                권한 매트릭스 보기 →
              </Link>
            </>
          )}
        </Card>

        <Card title="알림">
          <Link href="/notifications" className="inline-block text-caption font-semibold text-primary-700 underline">
            알림함 보기 →
          </Link>
        </Card>
      </div>

      <section className="rounded-xl bg-white p-5 shadow-md ring-1 ring-foreground/10">
        <h3 className="text-headline-3 font-bold text-accent-stone">⏳ 확인 대기 기록</h3>
        {loading ? (
          <Muted>불러오는 중...</Muted>
        ) : (
          <PendingConfirmCard count={summary?.pendingConfirmationCount ?? 0} personId={selected.id} />
        )}
      </section>
    </div>
  );
}

function PersonCard({
  person: p,
  selected,
  onSelect,
}: {
  person: GuardianPerson;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-xl border-2 bg-white p-4 text-left shadow-md transition-colors ${
        selected ? "border-primary-600 ring-2 ring-primary-100" : "border-border hover:border-primary-400"
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="bg-primary-50">
          {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
          <AvatarFallback aria-hidden="true" className="bg-primary-50 text-2xl">
            {p.isAdult ? "🧑" : "🧒"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="truncate text-body font-bold text-foreground">{p.fullName}</h3>
          <p className="text-caption text-muted-foreground">
            {p.birthDate} · 만 {computeAge(p.birthDate)}세
            {GENDER_LABEL[p.gender ?? ""] ? ` · ${GENDER_LABEL[p.gender ?? ""]}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StageBadge lifeStage={computeLifeStage(p.birthDate)} interactive={false} />
        {p.disabilityTypes.slice(0, 2).map((t) => (
          <span key={t} className="rounded-(--br-sm) bg-muted px-2 py-0.5 text-caption text-accent-stone">
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

function SliderButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "이전 당사자" : "다음 당사자"}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-accent-stone shadow-sm disabled:opacity-30"
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-md ring-1 ring-foreground/10">
      <h3 className="mb-3 text-headline-3 font-bold text-accent-stone">{title}</h3>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-caption text-muted-foreground">{children}</p>;
}

function Emergency({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="mr-2 font-semibold text-domain-med-text">{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
