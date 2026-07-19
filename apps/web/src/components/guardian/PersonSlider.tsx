"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EmergencyInfoInput } from "@ongil/validation";
import {
  getPersonSummaryCards,
  getRecentNotifications,
  removeGuardianPerson,
  type GuardianPerson,
  type PersonCardStats,
  type PersonSummaryCards,
  type RecentNotificationItem,
} from "@/app/(app)/dashboard/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { DomainChip } from "@/components/timeline/DomainChip";
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
const ROLE_LABEL: Record<string, string> = {
  guardian: "보호자",
  person: "당사자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};
const LEVEL_LABEL: Record<string, string> = { read: "읽기", write: "작성", edit: "편집" };
const LEVEL_CLASS: Record<string, string> = {
  read: "bg-[#DBEAFE] text-[#1D4ED8]",
  write: "bg-[#D1FAE5] text-[#047857]",
  edit: "bg-[#FEF3C7] text-[#B45309]",
};

/** 프로토타입 web-guardian.html G-01 "오늘 10:30"/"어제"/"2일 전" 상대 표기. */
function formatRecordTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) {
    return `오늘 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  if (days === 1) return "어제";
  return `${days}일 전`;
}

export function PersonSlider({
  persons,
  personStats,
}: {
  persons: GuardianPerson[];
  personStats: Record<string, PersonCardStats>;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<PersonSummaryCards | null>(null);
  const [notifications, setNotifications] = useState<RecentNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Wave M-3(docs/11-livinglab-mega-workshop.md) — 다자녀 보호자가 슬라이더 화살표를 계속
  // 눌러야 전체를 못 본다는 리빙랩 관찰에 따라, 3명 이상일 때만 그리드 보기 토글을 노출한다.
  const [viewMode, setViewMode] = useState<"slider" | "grid">("slider");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const selected = persons[Math.min(index, persons.length - 1)];

  async function handleRemove() {
    if (!selected) return;
    const ok = window.confirm(
      `${selected.fullName}님을 피보호자 목록에서 제외하시겠습니까?\n` +
        "이 계정에서만 목록에서 사라지며, 다른 이해관계자가 작성한 기록은 그대로 유지됩니다."
    );
    if (!ok) return;
    setRemoving(true);
    setRemoveError(null);
    const res = await removeGuardianPerson(selected.id);
    setRemoving(false);
    if (res.error) {
      setRemoveError(res.error);
      return;
    }
    setIndex((i) => Math.max(0, Math.min(i, persons.length - 2)));
    router.refresh();
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getPersonSummaryCards(selected.id), getRecentNotifications(3)]).then(
      ([summaryRes, notifRes]) => {
        if (active) {
          setSummary(summaryRes);
          setNotifications(notifRes);
          setLoading(false);
        }
      }
    );
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
                <PersonCard person={p} stats={personStats[p.id]} selected={i === index} onSelect={() => setIndex(i)} />
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
              <PersonCard person={p} stats={personStats[p.id]} selected={i === index} onSelect={() => setIndex(i)} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-bold text-foreground">{selected.fullName}님 관리</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/persons/${selected.id}/edit`}
            className="rounded-(--br-md) border border-border bg-white px-3 py-1.5 text-caption font-semibold text-accent-stone shadow-sm hover:border-primary-400"
          >
            ✎ 정보 수정
          </Link>
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={removing}
            className="rounded-(--br-md) border border-red-200 bg-white px-3 py-1.5 text-caption font-semibold text-red-600 shadow-sm hover:border-red-400 disabled:opacity-60"
          >
            {removing ? "제외하는 중..." : "목록에서 제외"}
          </button>
        </div>
      </div>
      {removeError && (
        <p role="alert" className="text-caption font-semibold text-red-600">
          {removeError}
        </p>
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
            <ul>
              {summary.recentRecords.map((r) => (
                <RecRow key={r.id}>
                  <DomainChip domain={toDomain(r.domain)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">{r.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {r.authorName ?? "알 수 없음"} · {formatRecordTime(r.recordDate)}
                    </p>
                  </div>
                </RecRow>
              ))}
            </ul>
          ) : (
            <Muted>최근 기록이 없습니다.</Muted>
          )}
          <GhostCTA href={`/persons/${selected.id}/records`}>전체 기록 보기</GhostCTA>
        </Card>

        <Card title="권한 현황">
          {loading ? (
            <Muted>불러오는 중...</Muted>
          ) : summary && summary.permissions.length > 0 ? (
            <ul>
              {summary.permissions.map((perm) => (
                <li
                  key={perm.granteeId}
                  className="flex items-center justify-between gap-2 border-b border-border py-[9px] text-[13px] last:border-0"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {perm.granteeName ?? "알 수 없음"} · {ROLE_LABEL[perm.granteeRole ?? ""] ?? perm.granteeRole}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${LEVEL_CLASS[perm.accessLevel] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {LEVEL_LABEL[perm.accessLevel] ?? perm.accessLevel}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>부여된 권한이 없습니다.</Muted>
          )}
          <GhostCTA href={`/persons/${selected.id}/permissions`}>권한 매트릭스</GhostCTA>
        </Card>

        <Card title="알림">
          {loading ? (
            <Muted>불러오는 중...</Muted>
          ) : notifications.length > 0 ? (
            <ul>
              {notifications.map((n) => (
                <RecRow key={n.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">{n.title}</p>
                    {n.body && <p className="truncate text-[12px] text-muted-foreground">{n.body}</p>}
                  </div>
                </RecRow>
              ))}
            </ul>
          ) : (
            <Muted>새 알림이 없습니다.</Muted>
          )}
          {/* 프로토타입 원문 CTA는 "권한 부여하기"(G-32)지만 "알림" 카드와 무관해 원본 자체의
              오기로 판단했다 — docs/12 §3-4 근거에 따라 사용자 지시대로 "알림함 보기"를 쓴다. */}
          <Link
            href="/notifications"
            className="mt-3 block w-full rounded-(--br-md) bg-accent-amber py-2 text-center text-caption font-bold text-accent-stone hover:bg-[#f5bd5e]"
          >
            알림함 보기
          </Link>
        </Card>
      </div>

      <section className="mt-4 rounded-xl border-l-4 border-accent-amber bg-white p-5 shadow-md ring-1 ring-foreground/10">
        <h3 className="text-[14px] font-bold text-accent-stone">
          ⏳ 확인 대기 기록
          {summary && summary.pendingConfirmationCount > 0 && (
            <span className="ml-2 rounded-full bg-domain-dai-bg px-2 py-0.5 text-[11px] font-bold text-domain-dai-text">
              {summary.pendingConfirmationCount}건
            </span>
          )}
        </h3>
        {loading ? (
          <Muted>불러오는 중...</Muted>
        ) : summary && summary.pendingConfirmations.length > 0 ? (
          <>
            <ul className="mt-1">
              {summary.pendingConfirmations.map((r) => (
                <RecRow key={r.id}>
                  <DomainChip domain={toDomain(r.domain)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">{r.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {r.authorName ?? "알 수 없음"} · {formatRecordTime(r.recordDate)} 제출 ·{" "}
                      <span className="font-bold text-domain-dai-text">확인 대기</span>
                    </p>
                  </div>
                </RecRow>
              ))}
            </ul>
            <p className="mt-2.5 text-[12px] text-muted-foreground">
              IEP·ISP·치료계획서 등 공식 문서는 제출 시 보호자(또는 성년 당사자)의 확인이
              필요합니다. 승인·반려가 아닌 "내용을 확인했음"을 남기는 절차입니다.
            </p>
            <GhostCTA href={`/persons/${selected.id}/records`}>기록 관리에서 확인하기</GhostCTA>
          </>
        ) : (
          <p className="mt-2 text-caption text-muted-foreground">확인 대기 중인 기록이 없습니다.</p>
        )}
      </section>
    </div>
  );
}

/** 프로토타입 `.rec-row` — 좌측 정렬 아이템 + 하단 구분선, 마지막 행은 구분선 없음. */
function RecRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 border-b border-border py-2.5 last:border-0">{children}</li>
  );
}

/** 프로토타입 `.btn.btn-ghost` — 카드 폭 100%, 보조 톤 CTA. */
function GhostCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-3 block w-full rounded-(--br-md) border border-border bg-white py-2 text-center text-caption font-bold text-accent-stone hover:bg-muted"
    >
      {children}
    </Link>
  );
}

function PersonCard({
  person: p,
  stats,
  selected,
  onSelect,
}: {
  person: GuardianPerson;
  stats?: PersonCardStats;
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

      {/* 프로토타입 web-guardian.html `.pc-stats` — 이번주 기록/권한 부여/다음 점검 D-day
          3열 통계 바(2026-07-19, docs/12 Wave B — 이전엔 이 통계 자체가 없었다). */}
      <div className="mt-3 flex gap-2">
        <PcStat n={stats?.weeklyRecordCount ?? 0} label="이번주 기록" />
        <PcStat n={stats?.permissionCount ?? 0} label="권한 부여" />
        <PcStat n={stats?.nextReview ? `D-${stats.nextReview.dday}` : "-"} label={stats?.nextReview?.label ?? "다음 점검"} />
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

/** 프로토타입 `.pc-stat` — 18px 굵은 숫자 + 11px 회색 라벨, 3등분 가로배치(§4 타이포그래피 체크리스트). */
function PcStat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="flex-1 rounded-(--br-md) bg-muted p-2 text-center">
      <p className="text-[18px] font-extrabold text-primary-700">{n}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
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
