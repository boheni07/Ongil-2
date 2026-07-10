"use client";

/**
 * 프로토타입 web-person.html save-overlay 재현 — confetti 이모지 + 축하 메시지.
 * 표시/숨김은 부모가 `show`로 제어하고, 2초 후 onDone은 부모의 setTimeout에서 호출한다.
 * 새 애니메이션 라이브러리 없이 CSS 트랜지션만 사용.
 */
export function SaveOverlay({ show }: { show: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!show}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary-50/95 text-center transition-opacity duration-300 ${
        show ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="mb-4 animate-bounce text-[72px] leading-none" aria-hidden="true">
        ✨
      </div>
      <p className="text-2xl font-extrabold text-primary-800">잘 저장했어요!</p>
      <p className="mt-2 text-person-base text-primary-700">오늘 이야기해줘서 고마워요 💚</p>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {["🎉", "⭐", "💚", "✨"].map((c, i) => (
          <span
            key={i}
            className="absolute text-4xl"
            style={{
              left: `${[16, 80, 32, 68][i]}%`,
              top: `${[14, 20, 60, 56][i]}%`,
              animation: show ? `float 1.4s ease-in-out ${i * 0.15}s infinite alternate` : "none",
            }}
          >
            {c}
          </span>
        ))}
      </div>
      <style>{`@keyframes float { from { transform: translateY(0) rotate(-6deg); } to { transform: translateY(-14px) rotate(6deg); } }`}</style>
    </div>
  );
}
