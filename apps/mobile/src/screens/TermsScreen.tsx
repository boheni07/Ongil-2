import { LegalDocument, type LegalSection } from "../components/LegalDocument";

/** A-09 이용약관 (프로토타입 요약본). */
const SECTIONS: LegalSection[] = [
  {
    heading: "제1조 (목적)",
    paragraphs: [
      "본 약관은 온길이 제공하는 장애인 생애주기 기록 플랫폼 서비스의 이용과 관련하여 회사와 회원 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.",
    ],
  },
  {
    heading: "제2조 (정의)",
    bullets: [
      "\"당사자\": 기록의 주체가 되는 이용자",
      "\"보호자\": 당사자를 대리해 권한을 관리하는 이용자",
      "\"협력자\": 활동지원사·특수교사·사회복지사·치료사 등 기록 참여자",
    ],
  },
  {
    heading: "제3조 (약관의 효력 및 변경)",
    paragraphs: [
      "본 약관은 서비스 화면 게시로 효력이 발생하며, 개정 시 적용일자·사유를 최소 7일 전 공지합니다.",
    ],
  },
  {
    heading: "제6조 (기록의 소유와 권한)",
    paragraphs: [
      "모든 생애 기록의 소유권은 당사자에게 있으며, 협력자의 열람·기록은 부여된 권한 범위 내에서만 이루어집니다.",
    ],
  },
];

export function TermsScreen() {
  return <LegalDocument meta="시행일: 2026년 7월 7일 · v1.0" sections={SECTIONS} />;
}
