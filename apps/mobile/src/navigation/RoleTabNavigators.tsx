import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getTeacherStudents } from "../lib/iep";
import { getSocialWorkerClients } from "../lib/isp";
import { getTherapistClients } from "../lib/therapy";
import { getGuardianPersons } from "../lib/guardian";
import { TeacherHomeScreen } from "../screens/TeacherHomeScreen";
import { SocialWorkerHomeScreen } from "../screens/SocialWorkerHomeScreen";
import { TherapistHomeScreen } from "../screens/TherapistHomeScreen";
import { GuardianDashboardScreen } from "../screens/GuardianDashboardScreen";
import { SupporterHomeScreen } from "../screens/SupporterHomeScreen";
import { PersonPickerScreen } from "../screens/PersonPickerScreen";
import { RoleSettingsScreen } from "../screens/RoleSettingsScreen";
import { JournalListScreen } from "../screens/JournalListScreen";
import { HandoverListScreen } from "../screens/HandoverListScreen";
import { DOMAIN_COLORS, NEUTRAL, PRIMARY } from "../theme/colors";
import type {
  TeacherStackParamList,
  TeacherTabParamList,
  SocialWorkerStackParamList,
  SocialWorkerTabParamList,
  TherapistStackParamList,
  TherapistTabParamList,
  GuardianStackParamList,
  GuardianTabParamList,
  SupporterStackParamList,
  SupporterTabParamList,
} from "./types";

/**
 * 프로토타입(app-{teacher,social-worker,therapist,guardian,supporter}.html) 하단 탭바
 * 5종(당사자 제외)을 구현한다(2026-07-19, Wave P-4). 각 역할의 기존 Home 화면은 그대로
 * 재사용하고(타이핑은 원래 Stack 화면 Props로 캐스트 — 실제 navigation 객체는 동일하게
 * 상위 Stack까지 올라가 동작한다), IEP/ISP/전환/치료계획/타임라인 등 대상자 선택이 필요한
 * 탭은 PersonPickerScreen(대상자 목록 → 목적 화면)으로 통일한다.
 *
 * 탭 화면 자체는 이 파일에서 Bottom Tab Navigator로만 감싸고, 위자드·상세 등 깊은 화면은
 * 기존과 동일하게 부모 Stack(MainNavigator)의 형제 스크린으로 남아 탭바 위로 push된다.
 */

const tabScreenOptions = {
  headerShown: false,
  tabBarStyle: { backgroundColor: NEUTRAL.bg, borderTopColor: NEUTRAL.border },
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
};

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 19 }}>{emoji}</Text>;
}

// ---------- 특수교사 ----------
const TeacherTab = createBottomTabNavigator<TeacherTabParamList>();
type TeacherHomeProps = NativeStackScreenProps<TeacherStackParamList, "TeacherHome">;

export function TeacherTabNavigator() {
  return (
    <TeacherTab.Navigator screenOptions={{ ...tabScreenOptions, tabBarActiveTintColor: DOMAIN_COLORS.EDU.accent }}>
      <TeacherTab.Screen
        name="Home"
        options={{ title: "홈", tabBarIcon: () => <TabIcon emoji="🏠" /> }}
      >
        {(props) => <TeacherHomeScreen {...(props as unknown as TeacherHomeProps)} />}
      </TeacherTab.Screen>
      <TeacherTab.Screen
        name="IepPicker"
        options={{ title: "IEP", tabBarIcon: () => <TabIcon emoji="📝" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="IEP 작성"
            emptyText="담당 학생이 없습니다."
            domainAccent={DOMAIN_COLORS.EDU.accent}
            fetchItems={async () =>
              (await getTeacherStudents()).map((s) => ({ id: s.personId, fullName: s.fullName }))
            }
            targetRoute="IepWizard"
          />
        )}
      </TeacherTab.Screen>
      <TeacherTab.Screen
        name="ObservationPicker"
        options={{ title: "관찰", tabBarIcon: () => <TabIcon emoji="👀" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="관찰기록 작성"
            emptyText="담당 학생이 없습니다."
            domainAccent={DOMAIN_COLORS.EDU.accent}
            fetchItems={async () =>
              (await getTeacherStudents()).map((s) => ({ id: s.personId, fullName: s.fullName }))
            }
            targetRoute="ObservationForm"
          />
        )}
      </TeacherTab.Screen>
      <TeacherTab.Screen
        name="TimelinePicker"
        options={{ title: "타임라인", tabBarIcon: () => <TabIcon emoji="📊" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="교육 타임라인"
            emptyText="담당 학생이 없습니다."
            domainAccent={DOMAIN_COLORS.EDU.accent}
            fetchItems={async () =>
              (await getTeacherStudents()).map((s) => ({ id: s.personId, fullName: s.fullName }))
            }
            targetRoute="EduTimeline"
          />
        )}
      </TeacherTab.Screen>
      <TeacherTab.Screen
        name="Settings"
        options={{ title: "설정", tabBarIcon: () => <TabIcon emoji="⚙️" /> }}
      >
        {() => <RoleSettingsScreen roleLabel="특수교사" manageLabel="담당 학생 관리" />}
      </TeacherTab.Screen>
    </TeacherTab.Navigator>
  );
}

// ---------- 사회복지사 ----------
const SocialWorkerTab = createBottomTabNavigator<SocialWorkerTabParamList>();
type SocialWorkerHomeProps = NativeStackScreenProps<SocialWorkerStackParamList, "SocialWorkerHome">;

export function SocialWorkerTabNavigator() {
  return (
    <SocialWorkerTab.Navigator
      screenOptions={{ ...tabScreenOptions, tabBarActiveTintColor: DOMAIN_COLORS.WEL.accent }}
    >
      <SocialWorkerTab.Screen
        name="Home"
        options={{ title: "홈", tabBarIcon: () => <TabIcon emoji="🏠" /> }}
      >
        {(props) => <SocialWorkerHomeScreen {...(props as unknown as SocialWorkerHomeProps)} />}
      </SocialWorkerTab.Screen>
      <SocialWorkerTab.Screen
        name="IspPicker"
        options={{ title: "ISP", tabBarIcon: () => <TabIcon emoji="📊" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="ISP 작성"
            emptyText="담당 당사자가 없습니다."
            domainAccent={DOMAIN_COLORS.WEL.accent}
            fetchItems={async () =>
              (await getSocialWorkerClients()).map((c) => ({ id: c.personId, fullName: c.fullName }))
            }
            targetRoute="IspWizard"
          />
        )}
      </SocialWorkerTab.Screen>
      <SocialWorkerTab.Screen
        name="TransitionPicker"
        options={{ title: "전환", tabBarIcon: () => <TabIcon emoji="🧭" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="전환계획 작성"
            emptyText="담당 당사자가 없습니다."
            domainAccent={DOMAIN_COLORS.WEL.accent}
            fetchItems={async () =>
              (await getSocialWorkerClients()).map((c) => ({ id: c.personId, fullName: c.fullName }))
            }
            targetRoute="TransitionPlanWizard"
          />
        )}
      </SocialWorkerTab.Screen>
      <SocialWorkerTab.Screen
        name="TimelinePicker"
        options={{ title: "타임라인", tabBarIcon: () => <TabIcon emoji="🗂️" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="복지 타임라인"
            emptyText="담당 당사자가 없습니다."
            domainAccent={DOMAIN_COLORS.WEL.accent}
            fetchItems={async () =>
              (await getSocialWorkerClients()).map((c) => ({ id: c.personId, fullName: c.fullName }))
            }
            targetRoute="WelTimeline"
          />
        )}
      </SocialWorkerTab.Screen>
      <SocialWorkerTab.Screen
        name="Settings"
        options={{ title: "설정", tabBarIcon: () => <TabIcon emoji="⚙️" /> }}
      >
        {() => (
          <RoleSettingsScreen roleLabel="사회복지사" manageLabel="담당 당사자 관리" />
        )}
      </SocialWorkerTab.Screen>
    </SocialWorkerTab.Navigator>
  );
}

// ---------- 치료사 ----------
const TherapistTab = createBottomTabNavigator<TherapistTabParamList>();
type TherapistHomeProps = NativeStackScreenProps<TherapistStackParamList, "TherapistHome">;

export function TherapistTabNavigator() {
  return (
    <TherapistTab.Navigator
      screenOptions={{ ...tabScreenOptions, tabBarActiveTintColor: DOMAIN_COLORS.MED.accent }}
    >
      <TherapistTab.Screen
        name="Home"
        options={{ title: "홈", tabBarIcon: () => <TabIcon emoji="🏠" /> }}
      >
        {(props) => <TherapistHomeScreen {...(props as unknown as TherapistHomeProps)} />}
      </TherapistTab.Screen>
      <TherapistTab.Screen
        name="PlanPicker"
        options={{ title: "치료계획", tabBarIcon: () => <TabIcon emoji="📋" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="치료계획서 작성"
            emptyText="담당 아동이 없습니다."
            domainAccent={DOMAIN_COLORS.MED.accent}
            fetchItems={async () =>
              (await getTherapistClients()).map((c) => ({ id: c.personId, fullName: c.fullName }))
            }
            targetRoute="TherapyPlanWizard"
          />
        )}
      </TherapistTab.Screen>
      <TherapistTab.Screen
        name="SessionPicker"
        options={{ title: "회기일지", tabBarIcon: () => <TabIcon emoji="📝" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="회기 일지 작성"
            emptyText="담당 아동이 없습니다."
            domainAccent={DOMAIN_COLORS.MED.accent}
            fetchItems={async () =>
              (await getTherapistClients()).map((c) => ({ id: c.personId, fullName: c.fullName }))
            }
            targetRoute="SessionNoteForm"
          />
        )}
      </TherapistTab.Screen>
      <TherapistTab.Screen
        name="EvalPicker"
        options={{ title: "평가", tabBarIcon: () => <TabIcon emoji="📊" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="평가보고서 작성"
            emptyText="담당 아동이 없습니다."
            domainAccent={DOMAIN_COLORS.MED.accent}
            fetchItems={async () =>
              (await getTherapistClients()).map((c) => ({ id: c.personId, fullName: c.fullName }))
            }
            targetRoute="EvalReport"
          />
        )}
      </TherapistTab.Screen>
      <TherapistTab.Screen
        name="Settings"
        options={{ title: "설정", tabBarIcon: () => <TabIcon emoji="⚙️" /> }}
      >
        {() => <RoleSettingsScreen roleLabel="치료사" manageLabel="담당 아동 관리" />}
      </TherapistTab.Screen>
    </TherapistTab.Navigator>
  );
}

// ---------- 보호자 ----------
const GuardianTab = createBottomTabNavigator<GuardianTabParamList>();
type GuardianHomeProps = NativeStackScreenProps<GuardianStackParamList, "GuardianDashboard">;

export function GuardianTabNavigator() {
  return (
    <GuardianTab.Navigator screenOptions={{ ...tabScreenOptions, tabBarActiveTintColor: PRIMARY[700] }}>
      <GuardianTab.Screen
        name="Home"
        options={{ title: "홈", tabBarIcon: () => <TabIcon emoji="🏠" /> }}
      >
        {(props) => <GuardianDashboardScreen {...(props as unknown as GuardianHomeProps)} />}
      </GuardianTab.Screen>
      <GuardianTab.Screen
        name="TimelinePicker"
        options={{ title: "타임라인", tabBarIcon: () => <TabIcon emoji="📈" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="생애주기 타임라인"
            emptyText="등록된 당사자가 없습니다."
            domainAccent={PRIMARY[700]}
            fetchItems={async () =>
              (await getGuardianPersons()).map((p) => ({ id: p.id, fullName: p.fullName }))
            }
            targetRoute="Timeline"
          />
        )}
      </GuardianTab.Screen>
      <GuardianTab.Screen
        name="RecordsPicker"
        options={{ title: "기록", tabBarIcon: () => <TabIcon emoji="📁" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="기록 관리"
            emptyText="등록된 당사자가 없습니다."
            domainAccent={PRIMARY[700]}
            fetchItems={async () =>
              (await getGuardianPersons()).map((p) => ({ id: p.id, fullName: p.fullName }))
            }
            targetRoute="RecordManager"
          />
        )}
      </GuardianTab.Screen>
      <GuardianTab.Screen
        name="PermissionsPicker"
        options={{ title: "권한", tabBarIcon: () => <TabIcon emoji="🔐" /> }}
      >
        {() => (
          <PersonPickerScreen
            title="권한 관리"
            emptyText="등록된 당사자가 없습니다."
            domainAccent={PRIMARY[700]}
            fetchItems={async () =>
              (await getGuardianPersons()).map((p) => ({ id: p.id, fullName: p.fullName }))
            }
            targetRoute="PermissionMatrix"
          />
        )}
      </GuardianTab.Screen>
      <GuardianTab.Screen
        name="Settings"
        options={{ title: "설정", tabBarIcon: () => <TabIcon emoji="⚙️" /> }}
      >
        {() => <RoleSettingsScreen roleLabel="보호자" manageLabel="당사자 등록·관리" />}
      </GuardianTab.Screen>
    </GuardianTab.Navigator>
  );
}

// ---------- 활동지원사 ----------
const SupporterTab = createBottomTabNavigator<SupporterTabParamList>();
type SupporterHomeProps = NativeStackScreenProps<SupporterStackParamList, "SupporterHome">;
type HandoverListProps = NativeStackScreenProps<SupporterStackParamList, "HandoverList">;

export function SupporterTabNavigator() {
  return (
    <SupporterTab.Navigator
      screenOptions={{ ...tabScreenOptions, tabBarActiveTintColor: DOMAIN_COLORS.DAI.accent }}
    >
      <SupporterTab.Screen
        name="Home"
        options={{ title: "홈", tabBarIcon: () => <TabIcon emoji="🏠" /> }}
      >
        {(props) => <SupporterHomeScreen {...(props as unknown as SupporterHomeProps)} />}
      </SupporterTab.Screen>
      <SupporterTab.Screen
        name="Journals"
        component={JournalListScreen}
        options={{ title: "일지", tabBarIcon: () => <TabIcon emoji="📄" /> }}
      />
      <SupporterTab.Screen
        name="Handovers"
        options={{ title: "인수인계", tabBarIcon: () => <TabIcon emoji="🔁" /> }}
      >
        {(props) => <HandoverListScreen {...(props as unknown as HandoverListProps)} />}
      </SupporterTab.Screen>
      <SupporterTab.Screen
        name="Settings"
        options={{ title: "설정", tabBarIcon: () => <TabIcon emoji="⚙️" /> }}
      >
        {() => <RoleSettingsScreen roleLabel="활동지원사" />}
      </SupporterTab.Screen>
    </SupporterTab.Navigator>
  );
}
