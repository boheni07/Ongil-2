import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { RoleTabs } from "@/components/landing/RoleTabs";

// 히어로/최종 CTA 공용 브랜드 그라디언트 (docs/03-uiux.md §8-1, primary-900→700→600).
const HERO_GRADIENT = "linear-gradient(135deg, #064E3B, #0F6E56, #1D9E75)";

const DOMAINS = [
  {
    name: "의료 MED",
    desc: "진단·복용약·치료 이력·응급 대응 정보",
    card: "bg-domain-med-bg text-domain-med-text",
    dot: "bg-domain-med-accent",
  },
  {
    name: "교육 EDU",
    desc: "개별화교육계획(IEP)·관찰기록·학습 성취",
    card: "bg-domain-edu-bg text-domain-edu-text",
    dot: "bg-domain-edu-accent",
  },
  {
    name: "복지 WEL",
    desc: "개별지원계획(ISP)·서비스 이용·자립 지원",
    card: "bg-domain-wel-bg text-domain-wel-text",
    dot: "bg-domain-wel-accent",
  },
  {
    name: "일상 DAI",
    desc: "활동 일지·식사·건강·자기표현 기록",
    card: "bg-domain-dai-bg text-domain-dai-text",
    dot: "bg-domain-dai-accent",
  },
  {
    name: "전환 TRA",
    desc: "진로 탐색·직업 훈련·자립 로드맵",
    card: "bg-domain-tra-bg text-domain-tra-text",
    dot: "bg-domain-tra-accent",
  },
  {
    name: "법률 LEG",
    desc: "후견·권익 옹호·법적 문서 보관",
    card: "bg-domain-leg-bg text-domain-leg-text",
    dot: "bg-domain-leg-accent",
  },
];

const VALUES = [
  {
    icon: "🧭",
    title: "당사자 중심 기록",
    desc: "모든 기록의 주인은 당사자입니다. 데이터의 소유·열람·공유 권한을 당사자와 보호자가 직접 관리합니다.",
  },
  {
    icon: "🔗",
    title: "협력자 연결",
    desc: "보호자·활동지원사·특수교사·사회복지사·치료사가 한 사람의 생애를 함께 기록하고 인계합니다.",
  },
  {
    icon: "🛡️",
    title: "안전한 공유",
    desc: "도메인·수준·기간별 세분화된 권한 부여로, 열람 로그까지 투명하게 관리합니다.",
  },
];

const FEATURES = [
  {
    icon: "🗂️",
    title: "생애주기 타임라인",
    desc: "도메인별 레인 뷰와 시간순 스트림 뷰로 흩어진 기록을 하나의 흐름으로 봅니다. 응급 정보는 항상 최상단에 고정, 이정표는 황금 테두리로 강조됩니다.",
  },
  {
    icon: "🔐",
    title: "세분화된 권한 관리",
    desc: "도메인·읽기/쓰기/편집·유효 기간까지 매트릭스로 제어합니다. 누가 언제 무엇을 열람했는지 접근 로그로 투명하게 확인합니다.",
  },
  {
    icon: "🧩",
    title: "역할 맞춤 위자드",
    desc: "복잡한 IEP·ISP·일지 작성을 단계별로 나눠, 한 단계에 하나의 결정만. 임시저장으로 언제든 이어서 작성할 수 있습니다.",
  },
];

const SECURITY = [
  {
    title: "🔒 행 수준 접근 제어",
    desc: "데이터베이스 RLS 정책으로 권한 없는 접근을 원천 차단합니다.",
  },
  {
    title: "📜 PIPA 동의 관리",
    desc: "필수·선택 동의를 분리 수집하고, 언제든 선택 철회할 수 있습니다.",
  },
  {
    title: "👁️ 투명한 접근 로그",
    desc: "모든 열람 기록을 남겨 당사자와 보호자가 직접 확인합니다.",
  },
];

const STEPS = [
  {
    no: "1",
    title: "역할 선택 · 가입",
    desc: "당사자·보호자·협력자 중 나의 역할을 선택하고 가입합니다.",
  },
  {
    no: "2",
    title: "연결 · 권한 설정",
    desc: "당사자와 연결하고, 도메인별 열람 권한을 설정합니다.",
  },
  {
    no: "3",
    title: "기록 · 공유",
    desc: "각자의 자리에서 기록하고, 생애 타임라인으로 함께 봅니다.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white text-accent-stone">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-primary-800 focus:shadow-lg"
      >
        본문으로 건너뛰기
      </a>
      <LandingNavbar />

      <main id="main-content" className="flex flex-1 flex-col">
        {/* S1. Hero — docs/03-uiux.md §8-1 */}
        <section
          className="-mt-[64px] px-6 pt-[128px] pb-[100px] text-white sm:px-10"
          style={{ background: HERO_GRADIENT }}
          aria-labelledby="hero-heading"
        >
          <div className="mx-auto grid max-w-[1120px] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="text-center lg:text-left">
              <p className="mb-3 text-[13px] font-bold tracking-wide text-accent-amber">
                장애인 생애주기 기록 플랫폼
              </p>
              <h1
                id="hero-heading"
                className="mb-5 text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl lg:text-[52px]"
              >
                생애 전체를,
                <br />
                함께 기록합니다
              </h1>
              <p className="mx-auto mb-8 max-w-[520px] text-lg text-white/90 lg:mx-0">
                장애인의 의료·교육·복지·일상·전환·법률 기록을 당사자 중심으로
                안전하게 관리하는 생애주기 플랫폼
              </p>
              <div className="flex flex-wrap justify-center gap-3.5 lg:justify-start">
                <Button
                  render={<Link href="/signup" />}
                  size="lg"
                  className="h-auto rounded-[10px] bg-accent-amber px-7 py-4 text-base font-bold text-primary-900 hover:bg-accent-amber/90"
                >
                  지금 시작하기 →
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto rounded-[10px] border-[1.5px] border-white/60 bg-transparent px-7 py-4 text-base font-bold text-white hover:bg-white/10 hover:text-white"
                >
                  데모 보기
                </Button>
              </div>
            </div>
            <PhoneMockup />
          </div>
        </section>

        {/* S2. 신뢰 지표 */}
        <section className="px-6 py-16 sm:px-10" aria-label="핵심 지표">
          <div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-6 text-center md:grid-cols-4">
            {[
              { num: "6", label: "생애 도메인 통합 기록" },
              { num: "6", label: "협력 역할 연결" },
              { num: "100%", label: "당사자 데이터 주권" },
              { num: "PIPA", label: "개인정보보호법 준수" },
            ].map((t) => (
              <div
                key={t.label}
                className="rounded-[14px] border border-[#eee] bg-white px-4 py-7"
              >
                <div className="text-4xl font-extrabold tracking-tight text-primary-600">
                  {t.num}
                </div>
                <div className="mt-1.5 text-sm text-[#6b6b66]">{t.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* S3. 플랫폼 소개 */}
        <section
          id="s-intro"
          className="scroll-mt-20 bg-primary-50 px-6 py-[88px] sm:px-10"
          aria-labelledby="intro-heading"
        >
          <div className="mx-auto max-w-[1120px]">
            <div className="text-center">
              <p className="mb-3 text-[13px] font-bold tracking-wide text-primary-600">
                플랫폼 소개
              </p>
              <h2
                id="intro-heading"
                className="mb-3.5 text-[32px] font-extrabold tracking-tight"
              >
                흩어진 기록을, 하나의 생애로
              </h2>
              <p className="mx-auto max-w-[640px] text-base text-[#6b6b66]">
                병원·학교·복지관·가정에 흩어진 기록을 당사자를 중심으로 모으고,
                필요한 사람에게 필요한 만큼만 안전하게 공유합니다.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {VALUES.map((v) => (
                <div
                  key={v.title}
                  className="rounded-[14px] border border-[#eef0ee] bg-white p-8"
                >
                  <div
                    aria-hidden="true"
                    className="mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-primary-100 text-[26px] text-primary-700"
                  >
                    {v.icon}
                  </div>
                  <h3 className="mb-2.5 text-[19px] font-bold">{v.title}</h3>
                  <p className="text-sm text-[#6b6b66]">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* S4. 6개 도메인 */}
        <section
          id="s-domain"
          className="scroll-mt-20 px-6 py-[88px] sm:px-10"
          aria-labelledby="domain-heading"
        >
          <div className="mx-auto max-w-[1120px]">
            <div className="text-center">
              <p className="mb-3 text-[13px] font-bold tracking-wide text-primary-600">
                6개 생애 도메인
              </p>
              <h2
                id="domain-heading"
                className="mb-3.5 text-[32px] font-extrabold tracking-tight"
              >
                삶의 모든 영역을 담습니다
              </h2>
              <p className="mx-auto max-w-[640px] text-base text-[#6b6b66]">
                의료부터 법률까지, 생애 전반의 기록을 색상으로 구분해 한눈에
                관리합니다.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {DOMAINS.map((d) => (
                <div
                  key={d.name}
                  className={"rounded-[14px] p-[26px] " + d.card}
                >
                  <h3 className="mb-2 flex items-center gap-2 text-lg font-extrabold">
                    <span
                      aria-hidden="true"
                      className={
                        "inline-block h-3 w-3 rounded-[4px] " + d.dot
                      }
                    />
                    {d.name}
                  </h3>
                  <p className="text-[13px] opacity-85">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* S5. 역할별 서비스 */}
        <section
          id="s-role"
          className="scroll-mt-20 bg-primary-50 px-6 py-[88px] sm:px-10"
          aria-labelledby="role-heading"
        >
          <div className="mx-auto max-w-[1120px] text-center">
            <p className="mb-3 text-[13px] font-bold tracking-wide text-primary-600">
              역할별 서비스
            </p>
            <h2
              id="role-heading"
              className="mb-3.5 text-[32px] font-extrabold tracking-tight"
            >
              각자의 자리에서, 함께
            </h2>
            <p className="mx-auto max-w-[640px] text-base text-[#6b6b66]">
              6개 역할이 각자에게 최적화된 화면으로 한 사람의 생애를 기록합니다.
            </p>
            <RoleTabs />
          </div>
        </section>

        {/* S6. 기능 하이라이트 */}
        <section
          className="px-6 py-[88px] sm:px-10"
          aria-labelledby="feature-heading"
        >
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-14 text-center">
              <p className="mb-3 text-[13px] font-bold tracking-wide text-primary-600">
                주요 기능
              </p>
              <h2
                id="feature-heading"
                className="text-[32px] font-extrabold tracking-tight"
              >
                기록을 넘어, 연결로
              </h2>
            </div>
            <div className="flex flex-col gap-[72px]">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="grid items-center gap-12 md:grid-cols-2"
                >
                  <div className={i % 2 === 1 ? "md:order-2" : undefined}>
                    <h3 className="mb-3 text-2xl font-extrabold">{f.title}</h3>
                    <p className="text-[#6b6b66]">{f.desc}</p>
                  </div>
                  <div
                    className={
                      "flex h-[260px] items-center justify-center rounded-[14px] border border-[#e6efe9] bg-primary-50 text-5xl " +
                      (i % 2 === 1 ? "md:order-1" : "")
                    }
                    aria-hidden="true"
                  >
                    {f.icon}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* S7. 보안 (다크) */}
        <section
          id="s-security"
          className="scroll-mt-20 bg-primary-800 px-6 py-[88px] text-white sm:px-10"
          aria-labelledby="security-heading"
        >
          <div className="mx-auto max-w-[1120px]">
            <div className="text-center">
              <p className="mb-3 text-[13px] font-bold tracking-wide text-accent-amber">
                보안 · 개인정보
              </p>
              <h2
                id="security-heading"
                className="mb-3.5 text-[32px] font-extrabold tracking-tight text-white"
              >
                가장 민감한 기록을, 가장 안전하게
              </h2>
              <p className="mx-auto max-w-[640px] text-base text-white/80">
                개인정보보호법(PIPA)을 준수하며, 당사자의 데이터 주권을 기술로
                보장합니다.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {SECURITY.map((s) => (
                <div
                  key={s.title}
                  className="rounded-[14px] border border-white/10 bg-white/5 p-[26px]"
                >
                  <h3 className="mb-2 text-[17px] font-bold">{s.title}</h3>
                  <p className="text-[13px] text-white/75">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* S8. 이용 절차 */}
        <section
          className="px-6 py-[88px] sm:px-10"
          aria-labelledby="steps-heading"
        >
          <div className="mx-auto max-w-[1120px] text-center">
            <p className="mb-3 text-[13px] font-bold tracking-wide text-primary-600">
              이용 절차
            </p>
            <h2
              id="steps-heading"
              className="text-[32px] font-extrabold tracking-tight"
            >
              3단계로 시작하세요
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.no} className="px-4 py-7 text-center">
                  <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary-600 text-xl font-extrabold text-white">
                    {s.no}
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
                  <p className="text-sm text-[#6b6b66]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* S9. 최종 CTA */}
        <section
          className="px-6 py-[88px] text-center text-white sm:px-10"
          style={{ background: HERO_GRADIENT }}
          aria-labelledby="cta-heading"
        >
          <div className="mx-auto max-w-[1120px]">
            <h2
              id="cta-heading"
              className="mb-4 text-[38px] font-extrabold tracking-tight"
            >
              내 삶의 모든 길이,
              <br />
              여기 있습니다
            </h2>
            <p className="mb-8 text-[17px] text-white/90">
              지금 온길과 함께 생애주기 기록을 시작하세요.
            </p>
            <Button
              render={<Link href="/signup" />}
              size="lg"
              className="h-auto rounded-[10px] bg-accent-amber px-7 py-4 text-base font-bold text-primary-900 hover:bg-accent-amber/90"
            >
              무료로 시작하기 →
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-accent-stone px-6 pt-14 pb-10 text-[#cfceca] sm:px-10">
        <div className="mx-auto grid max-w-[1120px] gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-3 text-xl font-extrabold tracking-tight text-white">
              온길
            </div>
            <p className="max-w-[280px] text-[13px]">
              장애인의 생애 전체를 당사자 중심으로 기록하고 연결하는 생애주기
              플랫폼
            </p>
          </div>
          <nav aria-label="서비스">
            <h3 className="mb-3.5 text-sm text-white">서비스</h3>
            <a href="#s-intro" className="mb-2.5 block text-[13px] hover:text-white">
              플랫폼 소개
            </a>
            <a href="#s-domain" className="mb-2.5 block text-[13px] hover:text-white">
              6개 도메인
            </a>
            <a href="#s-role" className="mb-2.5 block text-[13px] hover:text-white">
              역할별 서비스
            </a>
          </nav>
          <nav aria-label="지원">
            <h3 className="mb-3.5 text-sm text-white">지원</h3>
            <a href="#" className="mb-2.5 block text-[13px] hover:text-white">
              이용 안내
            </a>
            <a href="#" className="mb-2.5 block text-[13px] hover:text-white">
              자주 묻는 질문
            </a>
            <a href="#" className="mb-2.5 block text-[13px] hover:text-white">
              문의하기
            </a>
          </nav>
          <nav aria-label="약관">
            <h3 className="mb-3.5 text-sm text-white">약관</h3>
            <Link href="/legal/terms" className="mb-2.5 block text-[13px] hover:text-white">
              이용약관
            </Link>
            <Link
              href="/legal/privacy"
              className="mb-2.5 block text-[13px] hover:text-white"
            >
              개인정보처리방침
            </Link>
          </nav>
        </div>
        <div className="mx-auto mt-9 flex max-w-[1120px] flex-wrap justify-between gap-2 border-t border-white/10 pt-[22px] text-xs text-[#9d9c96]">
          <span>© 2026 온길(Ongil). All rights reserved.</span>
          <span>내 삶의 모든 길이 여기 있습니다</span>
        </div>
      </footer>
    </div>
  );
}
