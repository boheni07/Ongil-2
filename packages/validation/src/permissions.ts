import { z } from "zod";

/**
 * permissions(접근 권한) 검증 스키마 — G-30 권한 매트릭스 / G-32 권한 부여 위저드.
 * docs/05-erd.md §2-4(permissions), §4-5(라이프사이클), docs/01-prd.md §3-2~3-3.
 * 웹(Server Action)·모바일(Supabase 직접 호출)이 동일하게 import해 DB 계약을 공유한다.
 *
 * domain/access_level 값 집합은 permissions 테이블 CHECK 제약(§2-4) 및 Domain/AccessLevel
 * enum과 1:1 대응한다. 임의로 바꾸지 말 것.
 */

/** 6개 생애 도메인 — permissions.domain / records.domain 공용 (§2-4) */
export const domainKeySchema = z.enum(["MED", "EDU", "WEL", "DAI", "TRA", "LEG"]);
export type DomainKey = z.infer<typeof domainKeySchema>;

/** 접근 수준 — read < write < edit (§2-4) */
export const accessLevelSchema = z.enum(["read", "write", "edit"]);
export type AccessLevel = z.infer<typeof accessLevelSchema>;

/**
 * 초대 가능한 역할 — 당사자(person)·보호자(guardian)는 구조적 접근이라 권한 부여 대상이 아니다.
 * permission_presets.role 및 invitations.role CHECK(§2-12)의 진부분집합.
 */
export const inviteRoleSchema = z.enum(["supporter", "teacher", "social_worker", "therapist"]);
export type InviteRole = z.infer<typeof inviteRoleSchema>;

/** 도메인별 접근 수준 한 건 — G-32 Step3 결과 / invitations.domain_grants 요소 */
export const domainAccessSchema = z.object({
  domain: domainKeySchema,
  accessLevel: accessLevelSchema,
});
export type DomainAccess = z.infer<typeof domainAccessSchema>;

/**
 * G-32 권한 부여 최종 제출(Flow-G-02 4단계). 대상자가 기존 가입자인지 신규 초대인지 분기한다.
 * - target='existing': 이미 가입한 사용자에게 즉시 permissions 부여(granteeUserId).
 * - target='invite'  : 미가입자를 이메일로 초대(invitations INSERT, 수락 시 전개).
 *
 * 가드레일(PRD §3-3): edit 수준 항목이 하나라도 있으면 validUntil이 반드시 있어야 한다
 * (무기한 편집 금지). validUntil=null은 무기한을 의미하므로 edit와 공존할 수 없다.
 */
const grantFields = {
  domains: z.array(domainAccessSchema).min(1, "최소 한 개 도메인을 선택해주세요."),
  /** YYYY-MM-DD, null = 무기한 */
  validUntil: z.string().date("유효기간은 YYYY-MM-DD 형식이어야 합니다.").nullable(),
};

export const permissionGrantSchema = z
  .discriminatedUnion("target", [
    z.object({
      target: z.literal("existing"),
      granteeUserId: z.string().uuid("대상자 정보가 올바르지 않습니다."),
      ...grantFields,
    }),
    z.object({
      target: z.literal("invite"),
      inviteEmail: z.string().email("올바른 이메일을 입력해주세요."),
      inviteRole: inviteRoleSchema,
      ...grantFields,
    }),
  ])
  .refine((v) => !v.domains.some((d) => d.accessLevel === "edit") || v.validUntil !== null, {
    message: "편집(edit) 권한은 유효기간을 반드시 지정해야 합니다.",
    path: ["validUntil"],
  });

export type PermissionGrantInput = z.infer<typeof permissionGrantSchema>;
