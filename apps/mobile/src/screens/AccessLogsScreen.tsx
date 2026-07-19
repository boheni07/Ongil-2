import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DomainKey, Role } from "@ongil/validation";
import {
  getAccessLogs,
  type AccessLogActionKey,
  type AccessLogFilters,
  type AccessLogRow,
} from "../lib/access-logs";
import { DomainChip } from "../components/DomainChip";
import { DateField } from "../components/DateField";
import { ErrorBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "AccessLogs">;

/** actor 역할 필터 후보 — 접근 로그에 등장하는 협력자 역할(당사자·보호자 제외 관례는 웹과 동일하게 강제하지 않음). */
const ROLE_OPTIONS: { key: Role; label: string }[] = [
  { key: "teacher", label: "특수교사" },
  { key: "therapist", label: "치료사" },
  { key: "social_worker", label: "사회복지사" },
  { key: "supporter", label: "활동지원사" },
  { key: "guardian", label: "보호자" },
];

const DOMAIN_OPTIONS: { key: DomainKey; label: string }[] = [
  { key: "MED", label: "의료" },
  { key: "EDU", label: "교육" },
  { key: "WEL", label: "복지" },
  { key: "DAI", label: "일상" },
  { key: "TRA", label: "전환" },
  { key: "LEG", label: "법률" },
];

const ROLE_LABEL: Record<Role, string> = {
  person: "당사자",
  guardian: "보호자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

/** 동작 배지 색·라벨 — 프로토타입 web-guardian.html act-badge 범례와 동일(deny 제외). */
const ACTION_META: Record<AccessLogActionKey, { bg: string; fg: string; label: string }> = {
  view: { bg: "#EFF6FF", fg: "#1D4ED8", label: "열람" },
  create: { bg: "#ECFDF5", fg: "#047857", label: "작성" },
  update: { bg: "#FFFBEB", fg: "#B45309", label: "수정" },
  export: { bg: "#F5F3FF", fg: "#6D28D9", label: "내보내기" },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** accessed_at ISO → "MM-DD HH:mm" (프로토타입 표기와 동일). */
function formatAccessedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * G-40 접근 로그(모바일) — 상단 필터(역할·도메인·날짜 범위) + keyset 무한 스크롤 목록.
 * 웹 표 대신 모바일 목록 카드로 옮겼다. 프로토타입 web-guardian.html 676~701줄.
 */
export function AccessLogsScreen({ route }: Props) {
  const { personId, personName } = route.params;
  const insets = useSafeAreaInsets();

  // 편집 중 필터 값(아직 적용 전) — "조회"를 눌러야 applied로 승격된다.
  const [roleDraft, setRoleDraft] = useState<Role | null>(null);
  const [domainDraft, setDomainDraft] = useState<DomainKey | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  const [items, setItems] = useState<AccessLogRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 현재 적용된 필터(무한 스크롤 다음 페이지도 같은 필터로 이어간다).
  const appliedRef = useRef<AccessLogFilters>({});

  const runQuery = useCallback(
    async (filters: AccessLogFilters) => {
      setLoading(true);
      setError(null);
      appliedRef.current = filters;
      const page = await getAccessLogs(personId, filters);
      setItems(page.items);
      setCursor(page.nextCursor);
      setLoading(false);
    },
    [personId]
  );

  useEffect(() => {
    void runQuery({});
  }, [runQuery]);

  const onSearch = () => {
    if (dateFrom && !DATE_RE.test(dateFrom.trim())) {
      setDateError("시작일은 YYYY-MM-DD 형식으로 입력하세요.");
      return;
    }
    if (dateTo && !DATE_RE.test(dateTo.trim())) {
      setDateError("종료일은 YYYY-MM-DD 형식으로 입력하세요.");
      return;
    }
    setDateError(null);
    void runQuery({
      role: roleDraft ?? undefined,
      domain: domainDraft ?? undefined,
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
    });
  };

  const onEndReached = async () => {
    if (loading || loadingMore || !cursor) return;
    setLoadingMore(true);
    const page = await getAccessLogs(personId, appliedRef.current, cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.nextCursor);
    setLoadingMore(false);
  };

  return (
    <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>접근 로그</Text>
        <Text style={styles.subtle}>
          {personName} · 누가, 언제, 어떤 기록에 접근했는지 확인합니다.
        </Text>

        <Text style={styles.filterLabel}>역할</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          accessibilityLabel="역할 필터"
        >
          <FilterChip
            label="전체"
            selected={roleDraft === null}
            onPress={() => setRoleDraft(null)}
            a11y="전체 역할"
          />
          {ROLE_OPTIONS.map((o) => (
            <FilterChip
              key={o.key}
              label={o.label}
              selected={roleDraft === o.key}
              onPress={() => setRoleDraft(o.key)}
              a11y={`역할 ${o.label}`}
            />
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>도메인</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          accessibilityLabel="도메인 필터"
        >
          <FilterChip
            label="전체"
            selected={domainDraft === null}
            onPress={() => setDomainDraft(null)}
            a11y="전체 도메인"
          />
          {DOMAIN_OPTIONS.map((o) => (
            <FilterChip
              key={o.key}
              label={o.label}
              selected={domainDraft === o.key}
              onPress={() => setDomainDraft(o.key)}
              a11y={`도메인 ${o.label}`}
            />
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>기간 (YYYY-MM-DD)</Text>
        <View style={styles.dateRow}>
          <DateField
            accessibilityLabel="조회 시작일"
            placeholder="시작일"
            value={dateFrom}
            onChange={setDateFrom}
            max={dateTo || undefined}
            style={styles.dateInput}
          />
          <Text style={styles.dateSep}>~</Text>
          <DateField
            accessibilityLabel="조회 종료일"
            placeholder="종료일"
            value={dateTo}
            onChange={setDateTo}
            min={dateFrom || undefined}
            style={styles.dateInput}
          />
        </View>
        {dateError ? <Text style={styles.dateErrorText}>{dateError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="필터 적용하여 조회"
          onPress={onSearch}
          style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
        >
          <Text style={styles.searchBtnText}>조회</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.bannerWrap}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY[600]} accessibilityLabel="접근 로그 불러오는 중" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>조건에 맞는 접근 기록이 없습니다.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={PRIMARY[600]} accessibilityLabel="이전 로그 불러오는 중" />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const act = ACTION_META[item.action];
            const actorLine = `${item.actorName ?? "알 수 없음"}${
              item.actorRole ? ` (${ROLE_LABEL[item.actorRole]})` : ""
            }`;
            return (
              <View
                style={styles.row}
                accessibilityLabel={`${formatAccessedAt(item.accessedAt)}, ${actorLine}, ${
                  act.label
                }, 대상 ${item.recordTitle}`}
              >
                <View style={styles.rowHead}>
                  <Text style={styles.rowTime}>{formatAccessedAt(item.accessedAt)}</Text>
                  {item.domain ? <DomainChip domain={item.domain} /> : null}
                  <View style={[styles.actBadge, { backgroundColor: act.bg }]}>
                    <Text style={[styles.actText, { color: act.fg }]}>{act.label}</Text>
                  </View>
                </View>
                <Text style={styles.rowActor}>{actorLine}</Text>
                <Text style={styles.rowTarget} numberOfLines={2}>
                  {item.recordTitle}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  a11y,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  a11y: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  header: { padding: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.xs },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginBottom: SPACING.xs },
  filterLabel: {
    fontSize: FONT.label,
    fontWeight: "700",
    color: NEUTRAL.text,
    marginTop: SPACING.sm,
  },
  chipRow: { gap: SPACING.sm, paddingVertical: 2 },
  chip: {
    minHeight: 36,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEUTRAL.bg,
  },
  chipSelected: { backgroundColor: PRIMARY[600], borderColor: PRIMARY[600] },
  chipText: { fontSize: FONT.body, fontWeight: "600", color: NEUTRAL.textMuted },
  chipTextSelected: { color: "#fff" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: 2 },
  dateInput: {
    flex: 1,
    minHeight: TOUCH_MIN,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.body,
    color: NEUTRAL.text,
    backgroundColor: "#fff",
  },
  dateSep: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  dateErrorText: { fontSize: FONT.caption, color: NEUTRAL.danger, marginTop: 2 },
  searchBtn: {
    marginTop: SPACING.md,
    minHeight: TOUCH_MIN,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: { fontSize: FONT.h3, fontWeight: "700", color: "#fff" },
  pressed: { opacity: 0.85 },
  bannerWrap: { paddingHorizontal: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
  emptyBox: {
    padding: SPACING.xl,
    alignItems: "center",
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.md,
  },
  emptyText: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  footer: { paddingVertical: SPACING.lg, alignItems: "center" },
  row: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
    gap: 4,
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  rowTime: { fontSize: FONT.body, fontWeight: "700", color: NEUTRAL.text },
  actBadge: { borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2 },
  actText: { fontSize: 11, fontWeight: "700" },
  rowActor: { fontSize: FONT.body, color: NEUTRAL.text },
  rowTarget: { fontSize: FONT.caption, color: NEUTRAL.textMuted },
});
