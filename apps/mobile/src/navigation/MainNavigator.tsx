import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import type { Role } from "@ongil/validation";
import { NEUTRAL, PRIMARY } from "../theme/colors";
import { PersonHomeScreen } from "../screens/PersonHomeScreen";
import { SelfExpressionScreen } from "../screens/SelfExpressionScreen";
import { MyRecordsScreen } from "../screens/MyRecordsScreen";
import { SupporterHomeScreen } from "../screens/SupporterHomeScreen";
import { JournalComposeScreen } from "../screens/JournalComposeScreen";
import { JournalDetailScreen } from "../screens/JournalDetailScreen";
import { HandoverListScreen } from "../screens/HandoverListScreen";
import { HandoverComposeScreen } from "../screens/HandoverComposeScreen";
import { GuardianDashboardScreen } from "../screens/GuardianDashboardScreen";
import { PersonRegisterScreen } from "../screens/PersonRegisterScreen";
import { PermissionMatrixScreen } from "../screens/PermissionMatrixScreen";
import { PermissionGrantScreen } from "../screens/PermissionGrantScreen";
import { RecordManagerScreen } from "../screens/RecordManagerScreen";
import { RecordDetailScreen } from "../screens/RecordDetailScreen";
import { RecordFormScreen } from "../screens/RecordFormScreen";
import { AccessLogsScreen } from "../screens/AccessLogsScreen";
import { GuardianTimelineScreen } from "../screens/GuardianTimelineScreen";
import { TeacherHomeScreen } from "../screens/TeacherHomeScreen";
import { IepWizardScreen } from "../screens/IepWizardScreen";
import { IepReviewScreen } from "../screens/IepReviewScreen";
import { ObservationFormScreen } from "../screens/ObservationFormScreen";
import { BipFormScreen } from "../screens/BipFormScreen";
import { ItpWizardScreen } from "../screens/ItpWizardScreen";
import { EduTimelineScreen } from "../screens/EduTimelineScreen";
import { SocialWorkerHomeScreen } from "../screens/SocialWorkerHomeScreen";
import { IspWizardScreen } from "../screens/IspWizardScreen";
import { IspReviewScreen } from "../screens/IspReviewScreen";
import { TransitionPlanWizardScreen } from "../screens/TransitionPlanWizardScreen";
import { ServiceUsageScreen } from "../screens/ServiceUsageScreen";
import { WelTimelineScreen } from "../screens/WelTimelineScreen";
import { CaseConferenceFormScreen } from "../screens/CaseConferenceFormScreen";
import { LegBoardScreen } from "../screens/LegBoardScreen";
import { GuardianshipReportWizardScreen } from "../screens/GuardianshipReportWizardScreen";
import { AdvocacyConsultationFormScreen } from "../screens/AdvocacyConsultationFormScreen";
import { TherapistHomeScreen } from "../screens/TherapistHomeScreen";
import { TherapyPlanWizardScreen } from "../screens/TherapyPlanWizardScreen";
import { TherapyPlanDetailScreen } from "../screens/TherapyPlanDetailScreen";
import { SessionNoteFormScreen } from "../screens/SessionNoteFormScreen";
import { EvalReportScreen } from "../screens/EvalReportScreen";
import { MedTimelineScreen } from "../screens/MedTimelineScreen";
import { GenericHomeScreen } from "../screens/GenericHomeScreen";
import { PrivacySettingsScreen } from "../screens/PrivacySettingsScreen";
import { NotificationListScreen } from "../screens/NotificationListScreen";
import {
  TeacherTabNavigator,
  SocialWorkerTabNavigator,
  TherapistTabNavigator,
  GuardianTabNavigator,
  SupporterTabNavigator,
} from "./RoleTabNavigators";
import type {
  PersonStackParamList,
  SupporterStackParamList,
  GuardianStackParamList,
  TeacherStackParamList,
  SocialWorkerStackParamList,
  TherapistStackParamList,
  GenericStackParamList,
} from "./types";

const screenOptions = {
  headerStyle: { backgroundColor: NEUTRAL.bg },
  headerTintColor: PRIMARY[700],
  headerTitleStyle: { color: NEUTRAL.text },
  headerBackButtonDisplayMode: "minimal" as const,
  contentStyle: { backgroundColor: NEUTRAL.bg },
};

const PersonStack = createNativeStackNavigator<PersonStackParamList>();
const SupporterStack = createNativeStackNavigator<SupporterStackParamList>();
const GuardianStack = createNativeStackNavigator<GuardianStackParamList>();
const TeacherStack = createNativeStackNavigator<TeacherStackParamList>();
const SocialWorkerStack = createNativeStackNavigator<SocialWorkerStackParamList>();
// HandoverList/ComposeScreen은 SupporterStackParamList로 타입돼 있어(원 소속 스택),
// 다른 스택(SocialWorkerStack)에 그대로 재사용하려면 props를 캐스트해야 한다 — 이 파일의
// TeacherHomeScreen 등 Home 화면 재사용과 동일한 패턴(docs/13 Wave Q-6).
type SwHandoverListProps = NativeStackScreenProps<SupporterStackParamList, "HandoverList">;
type SwHandoverComposeProps = NativeStackScreenProps<SupporterStackParamList, "HandoverCompose">;
const TherapistStack = createNativeStackNavigator<TherapistStackParamList>();
const GenericStack = createNativeStackNavigator<GenericStackParamList>();

const ROLE_LABEL: Record<Role, string> = {
  person: "당사자",
  guardian: "보호자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

/** 로그인 후 메인 스택 — role별로 분기한다(P1-3/4/5 범위: person/supporter/guardian). */
export function MainNavigator({ session }: { session: Session }) {
  const role = (session.user.user_metadata?.role as Role | undefined) ?? null;

  if (role === "person") {
    return (
      <PersonStack.Navigator initialRouteName="PersonHome" screenOptions={screenOptions}>
        <PersonStack.Screen name="PersonHome" component={PersonHomeScreen} options={{ headerShown: false }} />
        <PersonStack.Screen
          name="SelfExpression"
          component={SelfExpressionScreen}
          options={{ headerShown: false }}
        />
        <PersonStack.Screen
          name="MyRecords"
          component={MyRecordsScreen}
          options={{ title: "내 기록" }}
        />
        <PersonStack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{ title: "개인정보·동의 관리" }}
        />
        <PersonStack.Screen name="Notifications" component={NotificationListScreen} options={{ title: "알림" }} />
      </PersonStack.Navigator>
    );
  }

  if (role === "supporter") {
    return (
      <SupporterStack.Navigator initialRouteName="SupporterTabs" screenOptions={screenOptions}>
        <SupporterStack.Screen
          name="SupporterTabs"
          component={SupporterTabNavigator}
          options={{ headerShown: false }}
        />
        <SupporterStack.Screen
          name="SupporterHome"
          component={SupporterHomeScreen}
          options={{ headerShown: false }}
        />
        <SupporterStack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{ title: "개인정보·동의 관리" }}
        />
        <SupporterStack.Screen
          name="JournalCompose"
          component={JournalComposeScreen}
          options={{ title: "활동일지 작성" }}
        />
        <SupporterStack.Screen
          name="JournalDetail"
          component={JournalDetailScreen}
          options={{ title: "일지 상세" }}
        />
        <SupporterStack.Screen
          name="HandoverList"
          component={HandoverListScreen}
          options={{ title: "인수인계" }}
        />
        <SupporterStack.Screen
          name="HandoverCompose"
          component={HandoverComposeScreen}
          options={{ title: "인수인계 작성" }}
        />
        <SupporterStack.Screen name="Notifications" component={NotificationListScreen} options={{ title: "알림" }} />
      </SupporterStack.Navigator>
    );
  }

  if (role === "guardian") {
    return (
      <GuardianStack.Navigator initialRouteName="GuardianTabs" screenOptions={screenOptions}>
        <GuardianStack.Screen
          name="GuardianTabs"
          component={GuardianTabNavigator}
          options={{ headerShown: false }}
        />
        <GuardianStack.Screen
          name="GuardianDashboard"
          component={GuardianDashboardScreen}
          options={{ headerShown: false }}
        />
        <GuardianStack.Screen
          name="PersonRegister"
          component={PersonRegisterScreen}
          options={{ title: "당사자 등록" }}
        />
        <GuardianStack.Screen
          name="PermissionMatrix"
          component={PermissionMatrixScreen}
          options={{ title: "권한 관리" }}
        />
        <GuardianStack.Screen
          name="PermissionGrant"
          component={PermissionGrantScreen}
          options={{ title: "권한 부여" }}
        />
        <GuardianStack.Screen
          name="RecordManager"
          component={RecordManagerScreen}
          options={{ title: "기록 관리" }}
        />
        <GuardianStack.Screen
          name="RecordDetail"
          component={RecordDetailScreen}
          options={{ title: "기록 상세" }}
        />
        <GuardianStack.Screen
          name="RecordForm"
          component={RecordFormScreen}
          options={{ title: "기록 작성" }}
        />
        <GuardianStack.Screen
          name="AccessLogs"
          component={AccessLogsScreen}
          options={{ title: "접근 로그" }}
        />
        <GuardianStack.Screen
          name="Timeline"
          component={GuardianTimelineScreen}
          options={{ title: "생애주기 타임라인" }}
        />
        <GuardianStack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{ title: "개인정보·동의 관리" }}
        />
        <GuardianStack.Screen name="Notifications" component={NotificationListScreen} options={{ title: "알림" }} />
      </GuardianStack.Navigator>
    );
  }

  if (role === "teacher") {
    return (
      <TeacherStack.Navigator initialRouteName="TeacherTabs" screenOptions={screenOptions}>
        <TeacherStack.Screen
          name="TeacherTabs"
          component={TeacherTabNavigator}
          options={{ headerShown: false }}
        />
        <TeacherStack.Screen
          name="TeacherHome"
          component={TeacherHomeScreen}
          options={{ headerShown: false }}
        />
        <TeacherStack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{ title: "개인정보·동의 관리" }}
        />
        <TeacherStack.Screen
          name="IepWizard"
          component={IepWizardScreen}
          options={{ title: "IEP 작성" }}
        />
        <TeacherStack.Screen
          name="IepReview"
          component={IepReviewScreen}
          options={{ title: "IEP 점검" }}
        />
        <TeacherStack.Screen
          name="ObservationForm"
          component={ObservationFormScreen}
          options={{ title: "관찰기록 작성" }}
        />
        <TeacherStack.Screen
          name="BipForm"
          component={BipFormScreen}
          options={{ title: "행동중재계획(BIP) 작성" }}
        />
        <TeacherStack.Screen
          name="ItpWizard"
          component={ItpWizardScreen}
          options={{ title: "개별화전환계획(ITP) 작성" }}
        />
        <TeacherStack.Screen
          name="EduTimeline"
          component={EduTimelineScreen}
          options={{ title: "교육 타임라인" }}
        />
        <TeacherStack.Screen name="Notifications" component={NotificationListScreen} options={{ title: "알림" }} />
      </TeacherStack.Navigator>
    );
  }

  if (role === "social_worker") {
    return (
      <SocialWorkerStack.Navigator initialRouteName="SocialWorkerTabs" screenOptions={screenOptions}>
        <SocialWorkerStack.Screen
          name="SocialWorkerTabs"
          component={SocialWorkerTabNavigator}
          options={{ headerShown: false }}
        />
        <SocialWorkerStack.Screen
          name="SocialWorkerHome"
          component={SocialWorkerHomeScreen}
          options={{ headerShown: false }}
        />
        <SocialWorkerStack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{ title: "개인정보·동의 관리" }}
        />
        <SocialWorkerStack.Screen
          name="IspWizard"
          component={IspWizardScreen}
          options={{ title: "ISP 작성" }}
        />
        <SocialWorkerStack.Screen
          name="IspReview"
          component={IspReviewScreen}
          options={{ title: "ISP 점검" }}
        />
        <SocialWorkerStack.Screen
          name="TransitionPlanWizard"
          component={TransitionPlanWizardScreen}
          options={{ title: "전환계획 작성" }}
        />
        <SocialWorkerStack.Screen
          name="ServiceUsage"
          component={ServiceUsageScreen}
          options={{ title: "서비스 이용 현황" }}
        />
        <SocialWorkerStack.Screen
          name="WelTimeline"
          component={WelTimelineScreen}
          options={{ title: "복지 타임라인" }}
        />
        <SocialWorkerStack.Screen
          name="CaseConferenceForm"
          component={CaseConferenceFormScreen}
          options={{ title: "사례회의록 작성" }}
        />
        <SocialWorkerStack.Screen
          name="LegBoard"
          component={LegBoardScreen}
          options={{ title: "법률·권리 기록" }}
        />
        <SocialWorkerStack.Screen
          name="GuardianshipReportWizard"
          component={GuardianshipReportWizardScreen}
          options={{ title: "후견감독보고서 작성" }}
        />
        <SocialWorkerStack.Screen
          name="AdvocacyConsultationForm"
          component={AdvocacyConsultationFormScreen}
          options={{ title: "권익옹호 상담기록 작성" }}
        />
        <SocialWorkerStack.Screen name="HandoverList" options={{ title: "인수인계" }}>
          {(props) => <HandoverListScreen {...(props as unknown as SwHandoverListProps)} />}
        </SocialWorkerStack.Screen>
        <SocialWorkerStack.Screen name="HandoverCompose" options={{ title: "인수인계 작성" }}>
          {(props) => <HandoverComposeScreen {...(props as unknown as SwHandoverComposeProps)} />}
        </SocialWorkerStack.Screen>
        <SocialWorkerStack.Screen name="Notifications" component={NotificationListScreen} options={{ title: "알림" }} />
      </SocialWorkerStack.Navigator>
    );
  }

  if (role === "therapist") {
    return (
      <TherapistStack.Navigator initialRouteName="TherapistTabs" screenOptions={screenOptions}>
        <TherapistStack.Screen
          name="TherapistTabs"
          component={TherapistTabNavigator}
          options={{ headerShown: false }}
        />
        <TherapistStack.Screen
          name="TherapistHome"
          component={TherapistHomeScreen}
          options={{ headerShown: false }}
        />
        <TherapistStack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{ title: "개인정보·동의 관리" }}
        />
        <TherapistStack.Screen
          name="TherapyPlanWizard"
          component={TherapyPlanWizardScreen}
          options={{ title: "치료계획서 작성" }}
        />
        <TherapistStack.Screen
          name="TherapyPlanDetail"
          component={TherapyPlanDetailScreen}
          options={{ title: "치료계획서 상세" }}
        />
        <TherapistStack.Screen
          name="SessionNoteForm"
          component={SessionNoteFormScreen}
          options={{ title: "회기 일지 작성" }}
        />
        <TherapistStack.Screen
          name="EvalReport"
          component={EvalReportScreen}
          options={{ title: "평가보고서 작성" }}
        />
        <TherapistStack.Screen
          name="MedTimeline"
          component={MedTimelineScreen}
          options={{ title: "치료 타임라인" }}
        />
        <TherapistStack.Screen name="Notifications" component={NotificationListScreen} options={{ title: "알림" }} />
      </TherapistStack.Navigator>
    );
  }

  // 이번 범위 밖 역할
  return (
    <GenericStack.Navigator screenOptions={screenOptions}>
      <GenericStack.Screen name="GenericHome" options={{ headerShown: false }}>
        {() => <GenericHomeScreen roleLabel={role ? ROLE_LABEL[role] : "알 수 없는 역할"} />}
      </GenericStack.Screen>
      <GenericStack.Screen name="Notifications" component={NotificationListScreen} options={{ title: "알림" }} />
    </GenericStack.Navigator>
  );
}
