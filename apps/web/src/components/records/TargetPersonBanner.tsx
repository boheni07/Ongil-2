/**
 * docs/13 Wave Q-3 — 전문직군 작성 화면의 "제출 대상" 확인 줄. 재선택 자체는 없애지 않되
 * (§2 토론 결론: 사회복지사·활동지원사 페르소나가 "매번 확인"을 안전장치로 지지),
 * 저장 버튼 바로 위에서 대상자를 마지막으로 한 번 더 눈에 띄게 보여준다.
 */
export function TargetPersonBanner({ name }: { name: string | null | undefined }) {
  return (
    <p className="flex items-center gap-1.5 rounded-(--br-md) bg-accent-amber/15 px-3 py-2 text-body font-bold text-accent-stone">
      <span aria-hidden="true">🎯</span>
      제출 대상: {name || "선택되지 않음"}
    </p>
  );
}
