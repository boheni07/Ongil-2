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
  MyRecords: undefined;
  PrivacySettings: undefined;
  Notifications: undefined;
};

export type SupporterStackParamList = {
  SupporterTabs: undefined;
  SupporterHome: undefined;
  JournalCompose: { personId: string; personName: string } | undefined;
  JournalDetail: { journalId: string };
  HandoverList: undefined;
  HandoverCompose: { personId: string; personName: string } | undefined;
  PrivacySettings: undefined;
  Notifications: undefined;
};

/** S-01/S-13/S-20/설정 — app-supporter.html 하단 탭바 4탭(2026-07-19 신설). */
export type SupporterTabParamList = {
  Home: undefined;
  Journals: undefined;
  Handovers: undefined;
  Settings: undefined;
};

export type GuardianStackParamList = {
  GuardianTabs: undefined;
  GuardianDashboard: undefined;
  PersonRegister: undefined;
  PermissionMatrix: { personId: string; personName: string };
  PermissionGrant: { personId: string; personName: string };
  RecordManager: { personId: string; personName: string };
  RecordDetail: { recordId: string; personId: string; personName: string };
  RecordForm: { personId: string; personName: string; recordId?: string };
  AccessLogs: { personId: string; personName: string };
  Timeline: { personId: string; personName: string };
  PrivacySettings: undefined;
  Notifications: undefined;
};

/** G-01/G-10/G-20/G-30/설정 — app-guardian.html 하단 탭바 5탭(2026-07-19 신설). */
export type GuardianTabParamList = {
  Home: undefined;
  TimelinePicker: undefined;
  RecordsPicker: undefined;
  PermissionsPicker: undefined;
  Settings: undefined;
};

export type TeacherStackParamList = {
  TeacherTabs: undefined;
  TeacherHome: undefined;
  IepWizard: { personId: string; personName: string };
  IepReview: { recordId: string };
  ObservationForm: { personId: string; personName: string };
  BipForm: { personId?: string; personName?: string } | undefined;
  ItpWizard: { personId?: string; personName?: string } | undefined;
  EduTimeline: { personId: string; personName: string };
  PrivacySettings: undefined;
  Notifications: undefined;
};

/** T-01/T-13/T-16/T-20/설정 — app-teacher.html 하단 탭바 5탭(2026-07-19 신설). */
export type TeacherTabParamList = {
  Home: undefined;
  IepPicker: undefined;
  ObservationPicker: undefined;
  TimelinePicker: undefined;
  Settings: undefined;
};

export type SocialWorkerStackParamList = {
  SocialWorkerTabs: undefined;
  SocialWorkerHome: undefined;
  IspWizard: { personId: string; personName: string };
  IspReview: { recordId: string };
  TransitionPlanWizard: { personId: string; personName: string };
  ServiceUsage: undefined;
  WelTimeline: { personId: string; personName: string };
  CaseConferenceForm: { personId?: string; personName?: string } | undefined;
  LegBoard: undefined;
  GuardianshipReportWizard: { personId?: string; personName?: string } | undefined;
  AdvocacyConsultationForm: { personId?: string; personName?: string } | undefined;
  // docs/13 Wave Q-6: 웹 사이드바엔 "인수인계"가 있는데 모바일엔 진입점 자체가 없던 갭 —
  // SupporterStackParamList와 동형(공용 HandoverList/HandoverComposeScreen 재사용).
  HandoverList: undefined;
  HandoverCompose: { personId: string; personName: string } | undefined;
  PrivacySettings: undefined;
  Notifications: undefined;
};

/** W-01/W-13/W-16/W-20/설정 — app-social-worker.html 하단 탭바 5탭(2026-07-19 신설). */
export type SocialWorkerTabParamList = {
  Home: undefined;
  IspPicker: undefined;
  TransitionPicker: undefined;
  TimelinePicker: undefined;
  Settings: undefined;
};

export type TherapistStackParamList = {
  TherapistTabs: undefined;
  TherapistHome: undefined;
  TherapyPlanWizard: { personId: string; personName: string };
  TherapyPlanDetail: { recordId: string };
  SessionNoteForm: { personId: string; personName: string };
  EvalReport: { personId: string; personName: string };
  MedTimeline: { personId: string; personName: string };
  PrivacySettings: undefined;
  Notifications: undefined;
};

/** TH-01/TH-14/TH-15/TH-17/설정 — app-therapist.html 하단 탭바 5탭(2026-07-19 신설). */
export type TherapistTabParamList = {
  Home: undefined;
  PlanPicker: undefined;
  SessionPicker: undefined;
  EvalPicker: undefined;
  Settings: undefined;
};

export type GenericStackParamList = {
  GenericHome: undefined;
  Notifications: undefined;
};
