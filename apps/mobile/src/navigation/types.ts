import type { Role } from "@ongil/validation";

/**
 * 미로그인 상태 Auth Stack 파라미터.
 * 회원가입 위저드(RoleSelect→Profile→Consent→VerifyEmail)는 invite 토큰과
 * 단계별 입력값을 파라미터로 이어 전달한다(웹의 withInvite 쿼리스트링과 동일 개념).
 */
export type AuthStackParamList = {
  Login: undefined;
  RoleSelect: { invite?: string } | undefined;
  Profile: { role: Role; invite?: string };
  Consent: { role: Role; email: string; invite?: string };
  VerifyEmail: { email: string; marketingAgreed: boolean; invite?: string };
  InviteAccept: { token: string };
  ResetPassword: undefined;
  Terms: undefined;
  Privacy: undefined;
};

/**
 * 로그인 후 메인 스택 — 역할별로 진입 홈과 하위 화면이 다르다(MainNavigator가 분기).
 * 이번 범위: person(P1-3), supporter(P1-4), guardian(P1-5). 나머지 역할은 준비 중 홈.
 */
export type PersonStackParamList = {
  PersonHome: undefined;
  SelfExpression: undefined;
};

export type SupporterStackParamList = {
  SupporterHome: undefined;
  JournalCompose: { personId: string; personName: string } | undefined;
  JournalDetail: { journalId: string };
  HandoverList: undefined;
  HandoverCompose: { personId: string; personName: string } | undefined;
};

export type GuardianStackParamList = {
  GuardianDashboard: undefined;
  PersonRegister: undefined;
  PermissionMatrix: { personId: string; personName: string };
  PermissionGrant: { personId: string; personName: string };
  RecordManager: { personId: string; personName: string };
  RecordDetail: { recordId: string; personId: string; personName: string };
  RecordForm: { personId: string; personName: string; recordId?: string };
  AccessLogs: { personId: string; personName: string };
  Timeline: { personId: string; personName: string };
};

export type TeacherStackParamList = {
  TeacherHome: undefined;
  IepWizard: { personId: string; personName: string };
  IepReview: { recordId: string };
  ObservationForm: { personId: string; personName: string };
  EduTimeline: { personId: string; personName: string };
};

export type SocialWorkerStackParamList = {
  SocialWorkerHome: undefined;
  IspWizard: { personId: string; personName: string };
  IspReview: { recordId: string };
  ServiceUsage: undefined;
  WelTimeline: { personId: string; personName: string };
};

export type TherapistStackParamList = {
  TherapistHome: undefined;
  TherapyPlanWizard: { personId: string; personName: string };
  TherapyPlanDetail: { recordId: string };
  SessionNoteForm: { personId: string; personName: string };
  MedTimeline: { personId: string; personName: string };
};

export type GenericStackParamList = {
  GenericHome: undefined;
};
