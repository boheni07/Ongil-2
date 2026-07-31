import Link from "next/link";

export const metadata = { title: "개인정보처리방침 · 온길" };

export default function PrivacyPage() {
  return (
    <article className="w-full max-w-3xl rounded-2xl bg-card p-8 text-[15px] leading-relaxed text-foreground shadow-sm ring-1 ring-foreground/10 sm:p-10">
      <h1 className="text-2xl font-extrabold tracking-tight">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        시행일: 2026년 7월 7일 · 버전 v1.0
      </p>

      <nav
        aria-label="목차"
        className="mt-6 flex flex-col gap-1.5 rounded-[10px] bg-muted/50 p-4 text-sm"
      >
        <a href="#p1" className="text-primary-700 underline">1. 수집하는 개인정보 항목</a>
        <a href="#p2" className="text-primary-700 underline">2. 개인정보의 이용 목적</a>
        <a href="#p3" className="text-primary-700 underline">3. 민감정보의 처리</a>
        <a href="#p4" className="text-primary-700 underline">4. 개인정보의 보유 및 파기</a>
        <a href="#p5" className="text-primary-700 underline">5. 정보주체의 권리</a>
        <a href="#p6" className="text-primary-700 underline">6. 개인정보 보호책임자</a>
      </nav>

      <section className="mt-8 flex flex-col gap-6">
        <div>
          <h2 id="p1" className="scroll-mt-20 text-lg font-bold">
            1. 수집하는 개인정보 항목
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th className="w-28 py-2 pr-4 text-left font-bold">필수</th>
                  <td className="py-2">이름, 이메일, 휴대폰 번호, 역할 정보, 비밀번호</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left font-bold">민감정보</th>
                  <td className="py-2">건강·장애 관련 기록(의료·교육·복지 도메인)</td>
                </tr>
                <tr>
                  <th className="py-2 pr-4 text-left font-bold">자동 수집</th>
                  <td className="py-2">접속 로그, 열람 이력, 기기 정보</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 id="p2" className="scroll-mt-20 text-lg font-bold">
            2. 개인정보의 이용 목적
          </h2>
          <p className="mt-2">
            회원 식별 및 인증, 생애주기 기록 서비스 제공, 협력자 간 권한 부여 및 연결,
            접근 로그를 통한 보안 관리를 위하여 개인정보를 이용합니다.
          </p>
        </div>
        <div>
          <h2 id="p3" className="scroll-mt-20 text-lg font-bold">
            3. 민감정보의 처리
          </h2>
          <p className="mt-2">
            회사는 개인정보보호법 제23조에 따라 건강·장애 관련 민감정보를 별도의 동의를
            받아 처리하며, 해당 정보는 암호화하여 저장하고 행 수준 접근 제어(RLS)를 통해
            권한 없는 접근을 차단합니다.
          </p>
        </div>
        <div>
          <h2 id="p4" className="scroll-mt-20 text-lg font-bold">
            4. 개인정보의 보유 및 파기
          </h2>
          <p className="mt-2">
            회원 탈퇴 시 개인정보는 지체 없이 파기함을 원칙으로 하되, 관계 법령에 따라
            보존이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
        </div>
        <div>
          <h2 id="p5" className="scroll-mt-20 text-lg font-bold">
            5. 정보주체의 권리
          </h2>
          <ul className="mt-2 list-disc pl-5">
            <li>정보주체는 언제든지 자신의 개인정보를 열람·정정·삭제·처리정지 요구할 수 있습니다.</li>
            <li>동의한 선택 항목은 언제든 개별적으로 철회할 수 있습니다.</li>
          </ul>
        </div>
        <div>
          <h2 id="p6" className="scroll-mt-20 text-lg font-bold">
            6. 개인정보 보호책임자
          </h2>
          <p className="mt-2">
            성명: 온길 개인정보보호책임자 / 연락처: privacy@ongil.example / 문의 시 지체
            없이 답변드립니다.
          </p>
        </div>
      </section>

      <div className="mt-8 text-center">
        <Link href="/signup" className="text-sm text-primary-700 underline">
          ← 가입 화면으로
        </Link>
      </div>
    </article>
  );
}
