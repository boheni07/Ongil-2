/**
 * 히어로 우측 모바일 목업. 프로토타입(web-common.html .phone-mock)의 카드 스택을 재현한 정적 마크업.
 * 순수 장식이므로 aria-hidden 처리.
 */
export function PhoneMockup() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-[280px] rounded-[32px] bg-white p-3.5 shadow-[0_30px_70px_rgba(0,0,0,0.35)]"
    >
      <div className="relative h-[520px] overflow-hidden rounded-[22px] bg-primary-50">
        <div className="bg-primary-800 px-[18px] pt-5 pb-[26px] text-white">
          <div className="text-[13px] opacity-85">안녕하세요, 보호자님</div>
          <div className="mt-1 text-[22px] font-extrabold">홍길동 님의 오늘</div>
        </div>

        {/* 응급정보 핀 카드 */}
        <div className="mx-4 -mt-4 mb-3 rounded-[14px] border-2 border-domain-med-accent bg-white p-4 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
          <span className="mb-2 inline-block rounded-full bg-domain-med-bg px-2.5 py-0.5 text-[11px] font-bold text-domain-med-text">
            응급 정보
          </span>
          <div className="text-sm font-bold">알레르기 · 복용약 · 비상연락처</div>
        </div>

        {/* 기분/식사/건강 미니 아이콘 행 */}
        <div className="mx-4 mb-3 flex gap-2">
          {[
            { icon: "😊", label: "기분 좋음" },
            { icon: "🍚", label: "식사 완료" },
            { icon: "💪", label: "건강" },
          ].map((m) => (
            <div
              key={m.label}
              className="flex-1 rounded-xl bg-white p-3 text-center text-xs font-semibold text-[#555] shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
            >
              <span className="mb-1 block text-[22px]">{m.icon}</span>
              {m.label}
            </div>
          ))}
        </div>

        {/* IEP 카드 */}
        <div className="mx-4 mb-3 rounded-[14px] bg-white p-4 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
          <span className="mb-2 inline-block rounded-full bg-domain-edu-bg px-2.5 py-0.5 text-[11px] font-bold text-domain-edu-text">
            교육 · IEP
          </span>
          <div className="text-[13px] font-bold">개별화교육계획 3분기 목표 점검</div>
          <div className="mt-1 text-xs text-[#999]">특수교사 김선생 · 오늘 14:00</div>
        </div>

        {/* ISP 카드 */}
        <div className="mx-4 rounded-[14px] bg-white p-4 shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
          <span className="mb-2 inline-block rounded-full bg-domain-wel-bg px-2.5 py-0.5 text-[11px] font-bold text-domain-wel-text">
            복지 · ISP
          </span>
          <div className="text-[13px] font-bold">자립생활 목표 달성률 60%</div>
        </div>
      </div>
    </div>
  );
}
