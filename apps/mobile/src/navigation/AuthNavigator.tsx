import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NEUTRAL, PRIMARY } from "../theme/colors";
import type { AuthStackParamList } from "./types";
import { LoginScreen } from "../screens/LoginScreen";
import { RoleSelectScreen } from "../screens/RoleSelectScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ConsentScreen } from "../screens/ConsentScreen";
import { VerifyEmailScreen } from "../screens/VerifyEmailScreen";
import { InviteAcceptScreen } from "../screens/InviteAcceptScreen";
import { ResetPasswordScreen } from "../screens/ResetPasswordScreen";
import { TermsScreen } from "../screens/TermsScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerStyle: { backgroundColor: NEUTRAL.bg },
        headerTintColor: PRIMARY[700],
        headerTitleStyle: { color: NEUTRAL.text },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: NEUTRAL.bg },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} options={{ title: "회원가입" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "기본 정보" }} />
      <Stack.Screen name="Consent" component={ConsentScreen} options={{ title: "약관 동의" }} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: "이메일 인증" }} />
      <Stack.Screen name="InviteAccept" component={InviteAcceptScreen} options={{ title: "초대 수락" }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: "비밀번호 재설정" }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ title: "이용약관" }} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: "개인정보처리방침" }} />
    </Stack.Navigator>
  );
}
