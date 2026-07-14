import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { EvalColumn, EvalComparison, EvalType } from "../lib/eval";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";

/** 4개 영역 한글 라벨(치료계획/회기일지 화면과 동일 enum·라벨 재사용). */
const DOMAIN_LABEL: Record<string, string> = {
  physical: "신체 (구강운동)",
  language: "언어",
  cognitive: "인지",
  social: "사회성",
};

/** 3열 비교 뷰 열 정의(초기→중간→최종 순서 고정). */
const COL_DEFS: { key: EvalType; label: string }[] = [
  { key: "initial", label: "초기 평가" },
  { key: "interim", label: "중간 평가" },
  { key: "final", label: "최종 평가" },
];

const DOMAIN_COL_W = 72;
const SCORE_COL_W = 88;
const DELTA_COL_W = 84;

function scoreOf(col: EvalColumn | null, domain: string): number | null {
  const hit = col?.domainScores.find((s) => s.domain === domain);
  return hit ? hit.score : null;
}

/** 델타를 부호·화살표·색상으로 표현한다. null이면 "-"(비교 불가). */
function DeltaCell({ value }: { value: number | null }) {
  if (value === null) {
    return <Text style={[styles.deltaText, styles.deltaMuted]}>-</Text>;
  }
  const up = value > 0;
  const down = value < 0;
  const arrow = up ? "↑" : down ? "↓" : "→";
  const sign = up ? `+${value}` : `${value}`;
  const color = up ? PRIMARY[600] : down ? NEUTRAL.danger : NEUTRAL.textMuted;
  return (
    <Text
      style={[styles.deltaText, { color }]}
      accessibilityLabel={`최종 대비 초기 변화 ${up ? "증가" : down ? "감소" : "변화 없음"} ${Math.abs(value)}점`}
    >
      {sign} {arrow}
    </Text>
  );
}

/**
 * TH-17 평가보고서 3열 비교 뷰(docs/03-uiux.md §7-6). 영역별 행 × 초기/중간/최종 점수 3열 +
 * 우측 최종-초기 델타(finalVsInitial). 델타는 lib/eval.getEvalComparison에서 이미 계산되어 오므로
 * 여기서 재계산하지 않는다. 좁은 화면을 고려해 표 전체를 가로 스크롤로 감싼다. 빈 열은 "미제출".
 */
export function EvalComparisonTable({ comparison }: { comparison: EvalComparison }) {
  const { columns, deltas } = comparison;
  const domains = deltas.map((d) => d.domain);

  if (domains.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>아직 등록된 평가 점수가 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.scroll}>
      <View style={styles.table}>
        {/* 헤더 행 */}
        <View style={[styles.row, styles.headRow]}>
          <View style={[styles.cell, { width: DOMAIN_COL_W }]}>
            <Text style={styles.headText}>영역</Text>
          </View>
          {COL_DEFS.map((c) => (
            <View key={c.key} style={[styles.cell, { width: SCORE_COL_W }]}>
              <Text style={styles.headText}>{c.label}</Text>
            </View>
          ))}
          <View style={[styles.cell, { width: DELTA_COL_W }]}>
            <Text style={styles.headText}>최종-초기</Text>
          </View>
        </View>

        {/* 영역별 데이터 행 */}
        {deltas.map((d, i) => (
          <View key={d.domain} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
            <View style={[styles.cell, { width: DOMAIN_COL_W }]}>
              <Text style={styles.domainText}>{DOMAIN_LABEL[d.domain] ?? d.domain}</Text>
            </View>
            {COL_DEFS.map((c) => {
              const score = scoreOf(columns[c.key], d.domain);
              const submitted = columns[c.key] !== null;
              return (
                <View key={c.key} style={[styles.cell, { width: SCORE_COL_W }]}>
                  {!submitted ? (
                    <Text style={styles.notSubmitted}>미제출</Text>
                  ) : score === null ? (
                    <Text style={styles.notSubmitted}>-</Text>
                  ) : (
                    <Text style={styles.scoreText}>{score}점</Text>
                  )}
                </View>
              );
            })}
            <View style={[styles.cell, { width: DELTA_COL_W }]}>
              <DeltaCell value={d.finalVsInitial} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
  },
  table: { minWidth: "100%" },
  row: { flexDirection: "row", alignItems: "stretch" },
  headRow: { backgroundColor: PRIMARY[50] },
  rowAlt: { backgroundColor: NEUTRAL.surface },
  cell: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
  },
  headText: { fontSize: FONT.caption, fontWeight: "800", color: PRIMARY[700] },
  domainText: { fontSize: FONT.body, fontWeight: "700", color: NEUTRAL.text },
  scoreText: { fontSize: FONT.body + 1, fontWeight: "600", color: NEUTRAL.text },
  notSubmitted: { fontSize: FONT.caption, color: NEUTRAL.textMuted },
  deltaText: { fontSize: FONT.body, fontWeight: "800" },
  deltaMuted: { color: NEUTRAL.textMuted },
  emptyBox: {
    padding: SPACING.lg,
    alignItems: "center",
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.md,
  },
  emptyText: { fontSize: FONT.body, color: NEUTRAL.textMuted },
});
