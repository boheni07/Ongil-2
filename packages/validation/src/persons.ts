import { z } from "zod";

/**
 * persons(당사자) 등록 검증 — P1-5 보호자 당사자 등록 6단계(Flow-G-01).
 * docs/05-erd.md §2-2 persons, §2-8 consents(민감정보 대리 동의).
 * 웹·모바일 공용. 화면은 6단계로 나뉘지만 최종 제출 페이로드는 이 단일 스키마로 검증한다.
 */

/** YYYY-MM-DD */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
/** 응급 연락처 — 유선/휴대폰 모두 허용(병원 등) */
const contactPhoneRegex = /^[0-9-]{7,20}$/;

/** 응급 연락처 항목 */
export const emergencyContactSchema = z.object({
  name: z.string().min(1, "연락처 이름을 입력해주세요."),
  relation: z.string().max(50).optional(),
  phone: z.string().regex(contactPhoneRegex, "올바른 전화번호를 입력해주세요."),
});

/** persons.emergency_info JSONB — { allergies, medications, contacts } (§2-2) */
export const emergencyInfoSchema = z.object({
  allergies: z.array(z.string().min(1)).default([]),
  medications: z.array(z.string().min(1)).default([]),
  contacts: z.array(emergencyContactSchema).default([]),
});

export type EmergencyInfoInput = z.infer<typeof emergencyInfoSchema>;

/**
 * 당사자 등록 6단계 통합 스키마.
 * - Step 1 기본정보: fullName / birthDate / gender
 * - Step 2 민감정보 동의: sensitiveConsent (별도 consents 행으로 저장 — on_behalf 대리 동의)
 * - Step 3 장애정보: disabilityTypes / disabilityDegree
 * - Step 4 응급정보: emergencyInfo
 * - Step 5 프로필사진: avatarUrl (선택)
 */
export const personRegisterSchema = z.object({
  fullName: z.string().min(1, "이름을 입력해주세요."),
  birthDate: z
    .string()
    .regex(dateRegex, "생년월일은 YYYY-MM-DD 형식이어야 합니다.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "올바른 날짜가 아닙니다.")
    .refine((v) => new Date(v) <= new Date(), "생년월일은 미래일 수 없습니다."),
  gender: z.enum(["M", "F", "other"]).optional(),
  sensitiveConsent: z.literal(true, {
    errorMap: () => ({ message: "민감정보 수집·이용에 동의해야 등록할 수 있습니다." }),
  }),
  disabilityTypes: z.array(z.string().min(1)).default([]),
  disabilityDegree: z.enum(["severe", "mild"]).optional(),
  emergencyInfo: emergencyInfoSchema.optional(),
  avatarUrl: z.string().url().optional(),
});

export type PersonRegisterInput = z.infer<typeof personRegisterSchema>;
