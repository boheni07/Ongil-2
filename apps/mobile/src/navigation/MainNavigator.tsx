import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import type { Role } from "@ongil/validation";
import { NEUTRAL, PRIMARY } from "../theme/colors";
import { PersonHomeScreen } from "../screens/PersonHomeScreen";
import { SelfExpressionScreen } from "../screens/SelfExpressionScreen";
import { SupporterHomeScreen } from "../screens/SupporterHomeScreen";
import { JournalComposeScreen } from "../screens/JournalComposeScreen";
import { JournalDetailScreen } from "../screens/JournalDetailScreen";
import { GuardianDashboardScreen } from "../screens/GuardianDashboardScreen";
import { PersonRegisterScreen } from "../screens/PersonRegisterScreen";
import { GenericHomeScreen } from "../screens/GenericHomeScreen";
import type {
  PersonStackParamList,
  SupporterStackParamList,
  GuardianStackParamList,
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
      </PersonStack.Navigator>
    );
  }

  if (role === "supporter") {
    return (
      <SupporterStack.Navigator initialRouteName="SupporterHome" screenOptions={screenOptions}>
        <SupporterStack.Screen
          name="SupporterHome"
          component={SupporterHomeScreen}
          options={{ headerShown: false }}
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
      </SupporterStack.Navigator>
    );
  }

  if (role === "guardian") {
    return (
      <GuardianStack.Navigator initialRouteName="GuardianDashboard" screenOptions={screenOptions}>
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
      </GuardianStack.Navigator>
    );
  }

  // 이번 범위 밖 역할(특수교사·사회복지사·치료사)
  return (
    <GenericStack.Navigator screenOptions={screenOptions}>
      <GenericStack.Screen name="GenericHome" options={{ headerShown: false }}>
        {() => <GenericHomeScreen roleLabel={role ? ROLE_LABEL[role] : "알 수 없는 역할"} />}
      </GenericStack.Screen>
    </GenericStack.Navigator>
  );
}
