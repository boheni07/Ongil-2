import Link from "next/link";

export const metadata = { title: "이용 안내 · 온길" };

const DOMAINS = [
  { name: "의료 MED", desc: "진단·복용약·치료 이력·응급 대응 정보" },
  { name: "교육 EDU", desc: "개별화교육계획(IEP)·관찰기록·학습 성취" },
  { name: "복지 WEL", desc: "개별지원계획(ISP)·서비스 이용·자립 지원" },
  { name: "일상 DAI", desc: "활동 일지·식사·건강·자기표현 기록" },
  { name: "전환 TRA", desc: "진로 탐색·직업 훈련·자립 로드맵" },
  { name: "법률 LEG", desc: "후견·권익 옹호·법적 문서 보관" },
];

const ROLES = [
  {
    name: "당사자",
    desc: "자기표현 기록을 직접 남기고, 나에 관한 기록을 열람합니다.",
  },
  {
    name: "보호자",
    desc: "당사자를 등록하고 협력자를 초대하며, 도메인별 권한을 부여·회수합니다.",
  },
  {
    name: "활동지원사",
    desc: "일상 활동 지원 일지를 작성하고 인계인수 노트를 주고받습니다.",
  },
  {
    name: "특수교사",
    desc: "개별화교육계획(IEP)·행동중재계획(BIP)·개별화전환계획(ITP)을 작성합니다.",
  },
  {
    name: "사회복지사",
    desc: "개별지원계획(ISP)·사례회의록·전환계획·후견 관련 기록을 관리합니다.",
  },
  {
    name: "치료사",
    desc: "치료계획서·회기 일지·평가보고서를 기록하고 경과를 비교합니다.",
  },
];

export default function SupportPage() {
  return (
    <article className="w-full max-w-3xl rounded-2xl bg-card p-8 text-[15px] leading-relaxed text-foreground shadow-sm ring-1 ring-foreground/10 sm:p-10">
      <h1 className="text-2xl font-extrabold tracking-tight">이용 안내</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        온길을 처음 쓰시는 분을 위한 시작 안내입니다.
      </p>

      <nav
        aria-label="목차"
        className="mt-6 flex flex-col gap-1.5 rounded-[10px] bg-muted/50 p-4 text-sm"
      >
        <a href="#u1" className="text-primary-700 underline">1. 온길은 어떤 서비스인가요</a>
        <a href="#u2" className="text-primary-700 underline">2. 시작하기 — 가입부터 첫 기록까지</a>
        <a href="#u3" className="text-primary-700 underline">3. 역할별 이용 흐름</a>
        <a href="#u4" className="text-primary-700 underline">4. 6개 생애 도메인</a>
        <a href="#u5" className="text-primary-700 underline">5. 권한 관리 — 수준과 유효기간</a>
        <a href="#u6" className="text-primary-700 underline">6. 생애주기 5단계와 기록 확인</a>
        <a href="#u7" className="text-primary-700 underline">7. 내 정보는 어떻게 보호되나요</a>
      </nav>

      <section className="mt-8 flex flex-col gap-6">
        <div>
          <h2 id="u1" className="scroll-mt-20 text-lg font-bold">
            1. 온길은 어떤 서비스인가요
          </h2>
          <p className="mt-2">
            온길은 장애인의 생애 전체를 당사자 중심으로 기록하고 연결하는 생애주기
            플랫폼입니다. 병원·학교·복지관·가정에 흩어져 있던 기록을 한 사람을 중심으로
            모으고, 누가 어디까지 볼 수 있는지를 당사자와 보호자가 직접 정합니다.
          </p>
        </div>

        <div>
          <h2 id="u2" className="scroll-mt-20 text-lg font-bold">
            2. 시작하기 — 가입부터 첫 기록까지
          </h2>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
            <li>
              <strong>역할 선택</strong> — 가입 시 당사자·보호자·활동지원사·특수교사·
              사회복지사·치료사 중 본인의 역할을 고릅니다. 역할에 따라 이후 화면 구성이
              달라집니다.
            </li>
            <li>
              <strong>기본 정보와 동의</strong> — 이름·연락처를 입력하고, 건강·장애 관련
              민감정보 처리에 대한 별도 동의를 확인합니다.
            </li>
            <li>
              <strong>당사자 등록(보호자)</strong> — 보호자는 대시보드에서 당사자를
              등록합니다. 당사자 본인이 직접 가입해 스스로 계정을 쓰는 것도 가능합니다.
            </li>
            <li>
              <strong>협력자 초대와 권한 부여</strong> — 보호자가 활동지원사·교사·
              사회복지사·치료사를 초대하고, 도메인별 열람·작성 권한을 부여합니다.
            </li>
            <li>
              <strong>기록 작성</strong> — 각 역할이 자기 화면에서 기록을 남기면 타임라인에
              하나의 흐름으로 모입니다.
            </li>
          </ol>
        </div>

        <div>
          <h2 id="u3" className="scroll-mt-20 text-lg font-bold">
            3. 역할별 이용 흐름
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {ROLES.map((role, i) => (
                  <tr
                    key={role.name}
                    className={i < ROLES.length - 1 ? "border-b border-border" : undefined}
                  >
                    <th className="w-28 py-2 pr-4 text-left align-top font-bold">
                      {role.name}
                    </th>
                    <td className="py-2">{role.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 id="u4" className="scroll-mt-20 text-lg font-bold">
            4. 6개 생애 도메인
          </h2>
          <p className="mt-2">
            모든 기록은 아래 6개 도메인 중 하나에 속합니다. 권한도 도메인 단위로
            부여하므로, 예를 들어 치료사에게 의료 기록만 열어주고 법률 기록은 닫아 둘 수
            있습니다.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {DOMAINS.map((domain, i) => (
                  <tr
                    key={domain.name}
                    className={i < DOMAINS.length - 1 ? "border-b border-border" : undefined}
                  >
                    <th className="w-28 py-2 pr-4 text-left align-top font-bold">
                      {domain.name}
                    </th>
                    <td className="py-2">{domain.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 id="u5" className="scroll-mt-20 text-lg font-bold">
            5. 권한 관리 — 수준과 유효기간
          </h2>
          <p className="mt-2">
            권한은 <strong>대상자 · 도메인 · 수준 · 유효기간</strong> 네 가지로 정해집니다.
            보호자는 권한 관리 화면에서 매트릭스로 한눈에 확인하고 언제든 바꿀 수 있습니다.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th className="w-28 py-2 pr-4 text-left font-bold">없음</th>
                  <td className="py-2">해당 도메인 기록이 아예 보이지 않습니다.</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left font-bold">읽기</th>
                  <td className="py-2">기록을 열람만 할 수 있습니다.</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left font-bold">쓰기</th>
                  <td className="py-2">새 기록을 작성할 수 있습니다(기존 기록 수정은 불가).</td>
                </tr>
                <tr>
                  <th className="py-2 pr-4 text-left font-bold">편집</th>
                  <td className="py-2">
                    기존 기록까지 수정할 수 있습니다. 가장 넓은 권한이므로 유효기간을 반드시
                    함께 지정합니다.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="mt-3 list-disc pl-5">
            <li>유효기간이 지난 권한은 자동으로 만료되며, 만료 7일 전 미리 알려드립니다.</li>
            <li>권한 부여·수정·회수는 모두 기록으로 남아 나중에 확인할 수 있습니다.</li>
            <li>
              누가 언제 어떤 기록을 열람했는지는 접근 로그 화면에서 투명하게 확인할 수
              있습니다.
            </li>
          </ul>
        </div>

        <div>
          <h2 id="u6" className="scroll-mt-20 text-lg font-bold">
            6. 생애주기 5단계와 기록 확인
          </h2>
          <p className="mt-2">
            온길은 생년월일을 기준으로 영유아기(0~5세)·아동기(6~12세)·청소년 전환기
            (13~18세)·성인기(19~64세)·노년기(65세 이상) 5단계를 자동 계산합니다. 단계에
            따라 필요한 기록과 확인 주체가 달라집니다.
          </p>
          <ul className="mt-3 list-disc pl-5">
            <li>
              개별화교육계획·치료계획서 같은 공식 문서는 작성 후 <strong>확인 절차</strong>
              를 거칩니다. 승인이 아니라, 당사자·보호자가 내용을 인지했음을 남기는
              절차입니다.
            </li>
            <li>
              성인기부터는 확인 주체가 보호자에서 당사자 본인으로 넘어갑니다.
            </li>
            <li>
              청소년 전환기에는 개별화전환계획(ITP)·전환계획처럼 자립을 준비하는 기록이
              활성화됩니다.
            </li>
          </ul>
        </div>

        <div>
          <h2 id="u7" className="scroll-mt-20 text-lg font-bold">
            7. 내 정보는 어떻게 보호되나요
          </h2>
          <p className="mt-2">
            건강·장애 관련 정보는 개인정보보호법상 민감정보로, 별도 동의를 받아 처리하며
            암호화해 저장합니다. 데이터베이스 차원의 행 수준 접근 제어(RLS)를 적용해 권한
            없는 접근은 애초에 조회되지 않습니다. 자세한 내용은{" "}
            <Link href="/legal/privacy" className="text-primary-700 underline">
              개인정보처리방침
            </Link>
            을 확인해 주세요.
          </p>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/support/faq" className="text-primary-700 underline">
          자주 묻는 질문
        </Link>
        <Link href="/support/contact" className="text-primary-700 underline">
          문의하기
        </Link>
        <Link href="/signup" className="text-primary-700 underline">
          가입 화면으로 →
        </Link>
      </div>
    </article>
  );
}
