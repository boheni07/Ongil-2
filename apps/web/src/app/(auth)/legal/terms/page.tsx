import Link from "next/link";

export const metadata = { title: "이용약관 · 온길" };

export default function TermsPage() {
  return (
    <article className="w-full max-w-3xl rounded-2xl bg-card p-8 text-[15px] leading-relaxed text-foreground shadow-sm ring-1 ring-foreground/10 sm:p-10">
      <h1 className="text-2xl font-extrabold tracking-tight">이용약관</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        시행일: 2026년 7월 7일 · 버전 v1.0
      </p>

      <nav
        aria-label="목차"
        className="mt-6 flex flex-col gap-1.5 rounded-[10px] bg-muted/50 p-4 text-sm"
      >
        <a href="#t1" className="text-primary-700 underline">제1조 (목적)</a>
        <a href="#t2" className="text-primary-700 underline">제2조 (정의)</a>
        <a href="#t3" className="text-primary-700 underline">제3조 (약관의 효력 및 변경)</a>
        <a href="#t4" className="text-primary-700 underline">제4조 (서비스의 제공)</a>
        <a href="#t5" className="text-primary-700 underline">제5조 (회원의 의무)</a>
        <a href="#t6" className="text-primary-700 underline">제6조 (기록의 소유와 권한)</a>
      </nav>

      <section className="mt-8 flex flex-col gap-6">
        <div>
          <h2 id="t1" className="scroll-mt-20 text-lg font-bold">
            제1조 (목적)
          </h2>
          <p className="mt-2">
            본 약관은 온길(이하 &ldquo;회사&rdquo;)이 제공하는 장애인 생애주기 기록
            플랫폼 서비스(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여 회사와 회원 간의
            권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
          </p>
        </div>
        <div>
          <h2 id="t2" className="scroll-mt-20 text-lg font-bold">
            제2조 (정의)
          </h2>
          <ul className="mt-2 list-disc pl-5">
            <li>&ldquo;당사자&rdquo;란 서비스에 기록되는 생애 정보의 주체가 되는 이용자를 말합니다.</li>
            <li>&ldquo;보호자&rdquo;란 당사자를 대리하여 계정과 권한을 관리하는 이용자를 말합니다.</li>
            <li>&ldquo;협력자&rdquo;란 활동지원사·특수교사·사회복지사·치료사 등 기록에 참여하는 이용자를 말합니다.</li>
          </ul>
        </div>
        <div>
          <h2 id="t3" className="scroll-mt-20 text-lg font-bold">
            제3조 (약관의 효력 및 변경)
          </h2>
          <p className="mt-2">
            본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써
            효력이 발생합니다. 회사는 관련 법령을 위배하지 않는 범위에서 약관을 개정할
            수 있으며, 개정 시 적용일자 및 사유를 명시하여 최소 7일 전에 공지합니다.
          </p>
        </div>
        <div>
          <h2 id="t4" className="scroll-mt-20 text-lg font-bold">
            제4조 (서비스의 제공)
          </h2>
          <p className="mt-2">회사는 다음의 서비스를 제공합니다.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th className="w-28 py-2 pr-4 text-left font-bold">기록 관리</th>
                  <td className="py-2">6개 도메인(의료·교육·복지·일상·전환·법률) 생애 기록</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left font-bold">권한 관리</th>
                  <td className="py-2">도메인·수준·기간별 열람 권한 부여 및 접근 로그</td>
                </tr>
                <tr>
                  <th className="py-2 pr-4 text-left font-bold">협력 연결</th>
                  <td className="py-2">보호자·협력자 간 초대 및 인수인계</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 id="t5" className="scroll-mt-20 text-lg font-bold">
            제5조 (회원의 의무)
          </h2>
          <p className="mt-2">
            회원은 관계 법령, 본 약관의 규정, 이용 안내 및 서비스와 관련하여 공지한
            주의사항을 준수하여야 하며, 타인의 기록에 무단으로 접근하거나 이를 유출하여서는
            안 됩니다.
          </p>
        </div>
        <div>
          <h2 id="t6" className="scroll-mt-20 text-lg font-bold">
            제6조 (기록의 소유와 권한)
          </h2>
          <p className="mt-2">
            서비스에 기록된 모든 생애 정보의 소유권은 당사자에게 있습니다. 협력자의 열람
            및 기록은 당사자 또는 보호자가 부여한 권한 범위 내에서만 이루어집니다.
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
