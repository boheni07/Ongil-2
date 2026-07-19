"use client";

import { useState } from "react";
import Link from "next/link";
import { RECORD_TYPE_LABEL } from "@ongil/validation";
import type { DomainKey } from "@ongil/shared";
import { DomainChip } from "@/components/timeline/DomainChip";
import { RecordForm } from "@/components/guardian/RecordForm";

/**
 * G-21 신규 기록 작성 진입 — "보호자는 도메인 제한 없이 모든 기록을 직접 작성·수정할 수
 * 있다"는 원칙이 실제로는 GEN-001(제목+내용) 자유 기록 하나로만 구현돼 있어, IEP·BIP·치료계획서
 * 등 각 분야가 실제로 쓰는 전용 구조화 서식으로는 보호자가 작성할 수 없었다(2026-07-19 피드백).
 *
 * 전문가용 각 record_type 전용 화면(예: /records/iep/new)은 이미 person_id를 쿼리로 받아
 * 미리 선택하는 기능을 갖고 있고, INSERT 액션(createIep 등)도 RLS에만 의존해 역할 체크가
 * 없다 — 막고 있던 건 "담당 대상자" 목록 조회(getTeacherStudents 등)가 permissions(전문가
 * 권한 부여)만 보고 guardians 관계를 보지 않았던 것뿐이다. 그 조회들에 보호자 본인 자녀를
 * 합쳐 넣었으니(각 actions.ts), 여기서는 그 화면으로 안내만 하면 된다 — 폼을 새로 만들지
 * 않고 전문가와 완전히 동일한 입력 경험을 그대로 재사용한다.
 *
 * LEG-001/002(후견감독보고서·권익옹호상담)는 사회복지사 전담 법정·공식 서류라 목록에서
 * 제외한다(assertSocialWorker로 앱 레이어에서도 명시적으로 막혀 있음). WEL-005(서비스
 * 이용계획)는 어느 역할에도 아직 작성 화면이 없어(현황표만 존재) 제외한다. DAI-002(활동지원
 * 일지)는 활동지원사 본인이 제공한 서비스의 실적 기록이라 보호자가 대신 쓸 성격이 아니다.
 */

interface StructuredOption {
  domain: DomainKey;
  recordType: string;
  description: string;
  href: string;
}

function buildOptions(personId: string): StructuredOption[] {
  return [
    { domain: "EDU", recordType: "EDU-001", description: "학교 연간 목표·지원서비스", href: `/records/iep/new?personId=${personId}` },
    { domain: "EDU", recordType: "EDU-002", description: "행동·학습 상황 관찰", href: `/records/observation/new?personId=${personId}` },
    { domain: "EDU", recordType: "EDU-003", description: "문제행동 기능평가·중재 전략", href: `/records/bip/new?personId=${personId}` },
    { domain: "EDU", recordType: "EDU-005", description: "진로 흥미·현장실습 이력(청소년 전환기)", href: `/records/itp/new?personId=${personId}` },
    { domain: "MED", recordType: "MED-005", description: "치료 목표·회기 빈도", href: `/records/therapy-plan/new?personId=${personId}` },
    { domain: "MED", recordType: "MED-006", description: "회기별 진행 내용·영역 점수", href: `/records/session/new?personId=${personId}` },
    { domain: "MED", recordType: "MED-007", description: "초기/중간/최종 평가·권고사항", href: `/records/eval/new?personId=${personId}` },
    { domain: "WEL", recordType: "WEL-004", description: "욕구사정·목표·연계 서비스", href: `/records/isp/new?personId=${personId}` },
    { domain: "WEL", recordType: "WEL-006", description: "회의 참석자·논의·결정사항", href: `/records/case-notes/new?personId=${personId}` },
    { domain: "TRA", recordType: "TRA-001", description: "로드맵 단계·훈련 이력", href: `/records/transition/new?personId=${personId}` },
  ];
}

export function RecordTypePicker({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const [mode, setMode] = useState<"picker" | "free">("picker");

  if (mode === "free") {
    return (
      <div className="flex flex-1 flex-col">
        <button
          type="button"
          onClick={() => setMode("picker")}
          className="mx-auto mb-[-0.5rem] w-full max-w-2xl text-left text-caption font-semibold text-muted-foreground hover:text-foreground"
        >
          ← 서식 종류 다시 선택
        </button>
        <RecordForm personId={personId} personName={personName} existing={null} />
      </div>
    );
  }

  const options = buildOptions(personId);
  const grouped = options.reduce<Record<string, StructuredOption[]>>((acc, o) => {
    (acc[o.domain] ??= []).push(o);
    return acc;
  }, {});

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col">
      <Link
        href={`/persons/${personId}/records`}
        className="mb-2 inline-flex w-fit items-center gap-1 text-caption font-semibold text-muted-foreground hover:text-foreground"
      >
        ← 기록 목록으로
      </Link>
      <h1 className="text-headline-1 font-extrabold text-foreground">새 기록 작성</h1>
      <p className="mt-1 text-body text-muted-foreground">{personName}</p>

      <div className="mt-5 rounded-(--br-md) bg-primary-50 p-4 text-body text-primary-800">
        🔑 보호자는 도메인 제한 없이 모든 기록을 직접 작성할 수 있습니다. 각 분야의 공식 서식으로
        작성하려면 아래에서 종류를 선택하세요.
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {Object.entries(grouped).map(([domain, items]) => (
          <div key={domain}>
            <div className="mb-2 flex items-center gap-2">
              <DomainChip domain={domain as DomainKey} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((o) => (
                <Link
                  key={o.recordType}
                  href={o.href}
                  className="flex flex-col gap-1 rounded-(--br-md) border border-border bg-white px-4 py-3 transition-colors hover:border-primary-400 hover:bg-primary-50"
                >
                  <span className="text-body font-bold text-foreground">
                    {RECORD_TYPE_LABEL[o.recordType] ?? o.recordType}
                  </span>
                  <span className="text-caption text-muted-foreground">{o.description}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div>
          <div className="mb-2 flex items-center gap-2">
            <DomainChip domain="DAI" label="자기표현" />
          </div>
          <Link
            href={`/persons/${personId}/records/express`}
            className="flex flex-col gap-1 rounded-(--br-md) border border-border bg-white px-4 py-3 transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <span className="text-body font-bold text-foreground">🙂 대신 자기표현 남기기</span>
            <span className="text-caption text-muted-foreground">기분·식사·활동 등 당사자를 대신해 기록</span>
          </Link>
        </div>

        <div>
          <h2 className="mb-2 text-label font-semibold text-accent-stone">정해진 서식이 없다면</h2>
          <button
            type="button"
            onClick={() => setMode("free")}
            className="flex w-full flex-col gap-1 rounded-(--br-md) border border-dashed border-border bg-white px-4 py-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <span className="text-body font-bold text-foreground">📝 자유 기록(제목·내용)</span>
            <span className="text-caption text-muted-foreground">
              위 서식에 해당하지 않는 메모·일반 기록을 자유 형식으로 남깁니다.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
