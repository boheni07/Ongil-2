"use client";

import { useState } from "react";

type Role = {
  key: string;
  tab: string;
  title: string;
  desc: string;
  points: string[];
  // 활성 탭 배경색 — 역할 고유색(도메인/브랜드 토큰과 1:1 대응 안 되는 값은 인라인 스타일로 지정)
  color: string;
  textOnColor: string;
};

const ROLES: Role[] = [
  {
    key: "person",
    tab: "당사자",
    title: "당사자",
    desc: "내 삶을 내가 기록합니다. 큰 아이콘과 쉬운 화면으로 오늘의 기분과 활동을 남깁니다.",
    points: [
      "1화면 1질문의 자기표현 4단계 위자드",
      "72px 대형 아이콘 · 20px 이상 큰 글자 (WCAG AAA 목표)",
      "내 동의·권리 직접 관리",
    ],
    color: "#FAC775",
    textOnColor: "#064E3B",
  },
  {
    key: "guardian",
    tab: "보호자",
    title: "보호자",
    desc: "여러 자녀의 생애를 한 허브에서. 슬라이더로 당사자를 전환하고 권한을 관리합니다.",
    points: [
      "PersonCard 슬라이더 대시보드",
      "6도메인 생애주기 타임라인",
      "권한 매트릭스로 협력자별 열람 범위 제어",
    ],
    color: "#0F6E56",
    textOnColor: "#ffffff",
  },
  {
    key: "supporter",
    tab: "활동지원사",
    title: "활동지원사",
    desc: "현장에서 빠르게. 5단계 위자드로 활동 일지를 남기고 인계인수합니다.",
    points: [
      "일지 작성 5단계 위자드 (이전 일지 참조)",
      "건강·식사 아이콘 빠른 기록",
      "인계인수 작성·전달",
    ],
    color: "#E8991E",
    textOnColor: "#ffffff",
  },
  {
    key: "teacher",
    tab: "특수교사",
    title: "특수교사",
    desc: "IEP와 관찰을 통합. 개별화교육계획을 세우고 성장을 추적합니다.",
    points: [
      "IEP 작성 6단계 위자드",
      "영역별 목표 점검 Split Pane",
      "관찰기록 · 교육 타임라인",
    ],
    color: "#4377C0",
    textOnColor: "#ffffff",
  },
  {
    key: "social",
    tab: "사회복지사",
    title: "사회복지사",
    desc: "ISP와 전환 로드맵. 자립 목표의 달성률을 관리합니다.",
    points: [
      "ISP 작성 5단계 · 목표별 달성률 점검",
      "전환계획 로드맵 (탐색→계획→훈련→자립)",
      "서비스 이용 현황 관리",
    ],
    color: "#3EA673",
    textOnColor: "#ffffff",
  },
  {
    key: "therapist",
    tab: "치료사",
    title: "치료사",
    desc: "계획과 회기를 연동. 치료 목표 대비 실제 진행을 비교합니다.",
    points: [
      "치료계획서 작성 5단계",
      "계획 연동 회기 일지",
      "초기·중간·최종 3열 비교 평가보고서",
    ],
    color: "#E04545",
    textOnColor: "#ffffff",
  },
];

export function RoleTabs() {
  const [active, setActive] = useState("person");
  const role = ROLES.find((r) => r.key === active) ?? ROLES[0];

  return (
    <div>
      <div className="mt-10 mb-7 flex flex-wrap justify-center gap-2.5">
        {ROLES.map((r) => {
          const isActive = r.key === active;
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActive(r.key)}
              className={
                "min-h-11 rounded-full border-[1.5px] px-5 py-2.5 text-sm font-semibold transition-colors " +
                (isActive
                  ? "border-transparent"
                  : "border-[#dfe3df] bg-white text-[#555] hover:border-primary-400")
              }
              style={
                isActive
                  ? { background: r.color, color: r.textOnColor }
                  : undefined
              }
            >
              {r.tab}
            </button>
          );
        })}
      </div>

      <div className="mx-auto max-w-[760px] rounded-[14px] border border-[#eef0ee] bg-white p-9 text-left">
        <h3 className="mb-2.5 text-[22px] font-extrabold">{role.title}</h3>
        <p className="text-[#6b6b66]">{role.desc}</p>
        <ul className="mt-4 list-disc pl-5 text-sm text-[#555]">
          {role.points.map((p) => (
            <li key={p} className="mb-2">
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
