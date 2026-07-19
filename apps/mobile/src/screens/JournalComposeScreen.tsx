import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Network from "expo-network";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { computeServiceHours, supportJournalSchema } from "@ongil/validation";
import {
  getPreviousJournal,
  getServiceablePersons,
  submitSupportJournal,
} from "../lib/journal";
import { enqueue, flushQueue } from "../lib/offline-queue";
import { useNetworkSync } from "../hooks/useNetworkSync";
import {
  JOURNAL_CATEGORIES,
  JOURNAL_HEALTH_CHOICES,
  JOURNAL_MEAL_CHOICES,
} from "../lib/content";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StepBar } from "../components/StepBar";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SupporterStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SupporterStackParamList, "JournalCompose">;

const STEP_CAPS = ["서비스 정보", "활동 내역", "건강·식사", "특이사항", "확인·제출"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface Draft {
  serviceDate: string;
  personId: string;
  startTime: string;
  endTime: string;
  categories: string[];
  minutes: Record<string, string>;
  mealStatus: string | null;
  healthStatus: string | null;
  incidents: string;
  handoverNote: string;
}

/** S-12 활동일지 5단계 위저드 (임시저장·이전 일지 참조 포함). */
export function JournalComposeScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params?.personId;
  const paramPersonName = route.params?.personName;

  const [step, setStep] = useState(1);
  const [persons, setPersons] = useState<{ id: string; fullName: string }[]>([]);
  const [serviceDate, setServiceDate] = useState(todayISO());
  const [personId, setPersonId] = useState(paramPersonId ?? "");
  const [startTime, setStartTime] = useState(nowHHMM());
  const [endTime, setEndTime] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [mealStatus, setMealStatus] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [incidents, setIncidents] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [prevInfo, setPrevInfo] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const { loading, error, run } = useAsyncAction();

  // 온라인 전환/포그라운드 복귀 시 큐잉된 오프라인 일지를 자동 재제출.
  // (offline-queue의 런타임 락으로 SupporterHome의 flush와 중복 제출되지 않는다.)
  useNetworkSync(
    useCallback(() => {
      void flushQueue("journal", submitSupportJournal).then((res) => {
        if (res.synced > 0) setSyncNotice(`오프라인 일지 ${res.synced}건이 저장되었습니다.`);
      });
    }, [])
  );
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>("journal:draft");

  const snapshot = useCallback(
    (): Draft => ({
      serviceDate,
      personId,
      startTime,
      endTime,
      categories,
      minutes,
      mealStatus,
      healthStatus,
      incidents,
      handoverNote,
    }),
    [serviceDate, personId, startTime, endTime, categories, minutes, mealStatus, healthStatus, incidents, handoverNote]
  );

  const applyDraft = useCallback((d: Draft) => {
    setServiceDate(d.serviceDate);
    setPersonId(d.personId);
    setStartTime(d.startTime);
    setEndTime(d.endTime);
    setCategories(d.categories);
    setMinutes(d.minutes);
    setMealStatus(d.mealStatus);
    setHealthStatus(d.healthStatus);
    setIncidents(d.incidents);
    setHandoverNote(d.handoverNote);
  }, []);

  useEffect(() => {
    void (async () => {
      setPersons(await getServiceablePersons());
      if (!paramPersonId) await checkRestore(applyDraft);
    })();
  }, [checkRestore, applyDraft, paramPersonId]);

  // 단계 이동 시 로컬 임시저장(오프라인 대비)
  useEffect(() => {
    saveDraft(snapshot());
  }, [step, saveDraft, snapshot]);

  const buildInput = () => ({
    service_date: serviceDate.trim(),
    start_time: startTime.trim(),
    end_time: endTime.trim(),
    activities: categories.map((c) => ({
      category: c,
      minutes: Number.parseInt(minutes[c] ?? "0", 10) || 0,
    })),
    health_status: healthStatus ?? undefined,
    meal_status: mealStatus ?? undefined,
    incidents: incidents.trim() ? incidents.trim() : undefined,
    handover_note: handoverNote.trim() ? handoverNote.trim() : undefined,
  });

  const toggleCategory = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const loadPrevious = () =>
    run(async () => {
      if (!personId) return "먼저 이용자를 선택해주세요.";
      const prev = await getPreviousJournal(personId);
      if (!prev) {
        setPrevInfo("불러올 이전 일지가 없습니다.");
        return;
      }
      const cats = prev.content.activities.map((a) => a.category);
      const mins: Record<string, string> = {};
      prev.content.activities.forEach((a) => {
        mins[a.category] = String(a.minutes);
      });
      setCategories(cats);
      setMinutes(mins);
      setPrevInfo(`${prev.recordDate} 일지의 활동을 불러왔습니다.`);
    });

  const canNext =
    (step === 1 && personId && /^\d{4}-\d{2}-\d{2}$/.test(serviceDate) && /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) ||
    step === 2 ||
    (step === 3 && mealStatus && healthStatus) ||
    step === 4;

  const finish = (isDraft: boolean) =>
    run(async () => {
      const parsed = supportJournalSchema.safeParse(buildInput());
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";

      // 실패 감지보다 사전 확인이 신뢰성 높다: 오프라인이면 네트워크 호출 없이 바로 큐잉.
      const netState = await Network.getNetworkStateAsync().catch(() => null);
      const offline = netState != null && netState.isConnected === false;

      if (offline) {
        await enqueue({
          formType: "journal",
          personId,
          payload: parsed.data,
          isDraft,
          // 논리적 초안 식별자 — 같은 이용자·같은 날짜 일지는 최신본만 큐에 유지
          dedupeKey: `journal:${personId}:${parsed.data.service_date}`,
        });
        // 로컬 임시저장을 지워 다음 진입 시 "이어작성" 다이얼로그와 큐 항목이 중복되지 않게 함
        clearDraft();
        Alert.alert(
          "오프라인 상태입니다",
          "네트워크가 연결되면 작성한 일지가 자동으로 저장됩니다.",
          [{ text: "확인", onPress: () => navigation.goBack() }]
        );
        return;
      }

      const res = await submitSupportJournal(personId, parsed.data, isDraft);
      if (res.error) return res.error;
      clearDraft();
      if (res.recordId) {
        navigation.replace("JournalDetail", { journalId: res.recordId });
      } else {
        navigation.goBack();
      }
    });

  const serviceHours =
    /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
      ? computeServiceHours(startTime, endTime)
      : null;
  const selectedPersonName =
    persons.find((p) => p.id === personId)?.fullName ?? paramPersonName ?? "";

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <StepBar current={step} total={5} label="일지 작성" />
      <Text style={styles.stepCap}>
        {step}/5 · {STEP_CAPS[step - 1]}
      </Text>
      {error ? <ErrorBanner message={error} /> : null}
      {syncNotice ? <InfoBanner message={syncNotice} /> : null}

      {step === 1 && (
        <View>
          <Text style={styles.label}>서비스 날짜</Text>
          <DateField
            accessibilityLabel="서비스 날짜"
            value={serviceDate}
            onChange={setServiceDate}
            style={styles.input}
          />
          <Text style={styles.label}>이용자</Text>
          {persons.length === 0 ? (
            <Text style={styles.muted}>연결된 이용자가 없습니다.</Text>
          ) : (
            <View style={styles.pickWrap}>
              {persons.map((p) => (
                <CategoryChip
                  key={p.id}
                  emoji="🧑"
                  label={p.fullName}
                  selected={personId === p.id}
                  onPress={() => setPersonId(p.id)}
                />
              ))}
            </View>
          )}
          <Text style={styles.label}>시작 시간</Text>
          <TextInput
            accessibilityLabel="시작 시간. 예시 13:00"
            value={startTime}
            onChangeText={setStartTime}
            placeholder="HH:MM"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.label}>활동 카테고리 (복수 선택)</Text>
          <View style={styles.pickWrap}>
            {JOURNAL_CATEGORIES.map((c) => (
              <CategoryChip
                key={c.value}
                emoji={c.emoji}
                label={c.value}
                selected={categories.includes(c.value)}
                onPress={() => toggleCategory(c.value)}
              />
            ))}
          </View>

          {categories.length > 0 ? (
            <>
              <Text style={[styles.label, { marginTop: SPACING.lg }]}>활동별 소요 시간(분)</Text>
              {categories.map((c) => (
                <View key={c} style={styles.minRow}>
                  <Text style={styles.minLabel}>{c}</Text>
                  <TextInput
                    accessibilityLabel={`${c} 소요 시간 분`}
                    value={minutes[c] ?? ""}
                    onChangeText={(v) => setMinutes((prev) => ({ ...prev, [c]: v.replace(/[^0-9]/g, "") }))}
                    placeholder="0"
                    placeholderTextColor={NEUTRAL.textMuted}
                    keyboardType="number-pad"
                    style={styles.minInput}
                  />
                </View>
              ))}
            </>
          ) : null}

          <View style={styles.refPanel}>
            <Text style={styles.refTitle}>📎 이전 일지 참조</Text>
            <Text style={styles.refDesc}>최근 확정된 일지의 활동을 불러옵니다.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이전 일지 불러오기"
              onPress={loadPrevious}
              style={({ pressed }) => [styles.refBtn, pressed && styles.pressed]}
            >
              <Text style={styles.refBtnText}>이전 일지 불러오기</Text>
            </Pressable>
            {prevInfo ? <Text style={styles.refInfo}>{prevInfo}</Text> : null}
          </View>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.label}>🍚 식사 상태</Text>
          <View style={styles.pickWrap}>
            {JOURNAL_MEAL_CHOICES.map((c) => (
              <CategoryChip
                key={c.value}
                emoji={c.emoji}
                label={c.label}
                selected={mealStatus === c.value}
                onPress={() => setMealStatus(c.value)}
              />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: SPACING.lg }]}>💪 건강 상태</Text>
          <View style={styles.pickWrap}>
            {JOURNAL_HEALTH_CHOICES.map((c) => (
              <CategoryChip
                key={c.value}
                emoji={c.emoji}
                label={c.label}
                selected={healthStatus === c.value}
                onPress={() => setHealthStatus(c.value)}
              />
            ))}
          </View>
        </View>
      )}

      {step === 4 && (
        <View>
          <InfoBanner message="이 단계는 선택입니다. 인계할 내용이 없다면 건너뛰기를 누르세요." />
          <Text style={styles.label}>특이사항 / 행동 관찰</Text>
          <TextInput
            accessibilityLabel="특이사항"
            value={incidents}
            onChangeText={setIncidents}
            placeholder="특이 행동, 사고·안전 상황 등 (없으면 비워두세요)"
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />
          <Text style={styles.label}>다음 지원사에게 인계</Text>
          <TextInput
            accessibilityLabel="인계 메모"
            value={handoverNote}
            onChangeText={setHandoverNote}
            placeholder="다음 방문 시 참고할 내용"
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />
        </View>
      )}

      {step === 5 && (
        <View>
          <Text style={styles.label}>종료 시간</Text>
          <TextInput
            accessibilityLabel="종료 시간. 예시 16:00"
            value={endTime}
            onChangeText={setEndTime}
            placeholder="HH:MM"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <View style={styles.hoursBox}>
            <Text style={styles.hoursLabel}>서비스 시간 (자동)</Text>
            <Text style={styles.hoursValue}>
              {serviceHours != null ? `${serviceHours}시간` : "종료 시간을 입력하세요"}
            </Text>
          </View>

          <View style={styles.summary}>
            <SumRow k="이용자" v={selectedPersonName || "-"} />
            <SumRow k="날짜 · 시간" v={`${serviceDate} · ${startTime}~${endTime || "?"}`} />
            <SumRow
              k="활동"
              v={categories.length ? categories.join(" · ") : "없음"}
            />
            <SumRow
              k="식사 / 건강"
              v={`${JOURNAL_MEAL_CHOICES.find((c) => c.value === mealStatus)?.label ?? "-"} / ${
                JOURNAL_HEALTH_CHOICES.find((c) => c.value === healthStatus)?.label ?? "-"
              }`}
            />
            <SumRow k="특이사항" v={incidents.trim() || "없음"} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="임시저장"
            onPress={() => finish(true)}
            disabled={loading}
            style={({ pressed }) => [styles.draftBtn, pressed && styles.pressed]}
          >
            <Text style={styles.draftBtnText}>💾 임시저장</Text>
          </Pressable>
        </View>
      )}

      <WizardFooter
        onPrev={step > 1 ? () => setStep((s) => s - 1) : () => navigation.goBack()}
        onNext={step < 5 ? () => setStep((s) => s + 1) : undefined}
        onSkip={step === 4 ? () => setStep(5) : undefined}
        onSubmit={step === 5 ? () => finish(false) : undefined}
        nextDisabled={!canNext}
        loading={loading}
      />
    </ScrollView>
  );
}

function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumK}>{k}</Text>
      <Text style={styles.sumV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  stepCap: { fontSize: FONT.h3, fontWeight: "700", color: PRIMARY[700], marginBottom: SPACING.md },
  label: { fontSize: 15, fontWeight: "600", color: NEUTRAL.text, marginBottom: SPACING.sm, marginTop: SPACING.sm },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: NEUTRAL.text,
  },
  textarea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: NEUTRAL.text,
    textAlignVertical: "top",
    marginBottom: SPACING.sm,
  },
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  minRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.sm },
  minLabel: { flex: 1, fontSize: 15, color: NEUTRAL.text },
  minInput: {
    width: 88,
    minHeight: 44,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: NEUTRAL.text,
    textAlign: "right",
  },
  refPanel: {
    marginTop: SPACING.xl,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.surface,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
  },
  refTitle: { fontSize: 15, fontWeight: "700", color: NEUTRAL.text },
  refDesc: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 4 },
  refBtn: {
    marginTop: SPACING.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[50],
    borderWidth: 1,
    borderColor: PRIMARY[400],
  },
  refBtnText: { fontSize: 14, fontWeight: "700", color: PRIMARY[700] },
  refInfo: { fontSize: 13, color: PRIMARY[700], marginTop: SPACING.sm },
  hoursBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.surface,
  },
  hoursLabel: { fontSize: 13, color: NEUTRAL.textMuted },
  hoursValue: { fontSize: 20, fontWeight: "800", color: PRIMARY[700], marginTop: 4 },
  summary: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    padding: SPACING.md,
  },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: SPACING.md },
  sumK: { fontSize: 14, color: NEUTRAL.textMuted },
  sumV: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text, flex: 1, textAlign: "right" },
  draftBtn: {
    marginTop: SPACING.lg,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
  },
  draftBtnText: { fontSize: 15, fontWeight: "700", color: NEUTRAL.textMuted },
  pressed: { opacity: 0.85 },
});
