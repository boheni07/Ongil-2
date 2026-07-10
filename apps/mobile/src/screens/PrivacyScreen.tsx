import { LegalDocument, type LegalSection } from "../components/LegalDocument";

/** A-10 개인정보처리방침 (프로토타입 요약본). */
const SECTIONS: LegalSection[] = [
  {
    heading: "1. 수집하는 개인정보 항목",
    bullets: [
      "필수: 이름·이메일·휴대폰·역할·비밀번호",
      "민감정보: 건강·장애 관련 기록",
      "자동 수집: 접속 로그·열람 이력·기기 정보",
    ],
  },
  {
    heading: "3. 민감정보의 처리",
    paragraphs: [
      "개인정보보호법 제23조에 따라 건강·장애 민감정보는 별도 동의 후 처리하며, 암호화 저장 및 행 수준 접근 제어(RLS)로 권한 없는 접근을 차단합니다.",
    ],
  },
  {
    heading: "5. 정보주체의 권리",
    bullets: [
      "언제든 열람·정정·삭제·처리정지를 요구할 수 있습니다.",
      "선택 동의 항목은 개별 철회할 수 있습니다.",
    ],
  },
  {
    heading: "6. 개인정보 보호책임자",
    paragraphs: ["연락처: privacy@ongil.example"],
  },
];

export function PrivacyScreen() {
  return <LegalDocument meta="시행일: 2026년 7월 7일 · v1.0" sections={SECTIONS} />;
}
