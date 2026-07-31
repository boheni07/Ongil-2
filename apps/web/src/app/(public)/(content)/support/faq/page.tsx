import Link from "next/link";

export const metadata = { title: "자주 묻는 질문 · 온길" };

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "가입할 때 역할은 어떻게 고르나요?",
    a: (
      <>
        본인이 실제로 하는 일에 맞춰 고르시면 됩니다. 기록의 주인이라면 <b>당사자</b>,
        당사자를 대리해 계정과 권한을 관리한다면 <b>보호자</b>, 현장에서 기록을 남기는
        분이라면 활동지원사·특수교사·사회복지사·치료사 중 해당 역할을 선택합니다. 역할에
        따라 홈 화면과 작성 가능한 기록이 달라집니다.
      </>
    ),
  },
  {
    q: "가입 후에 역할을 바꿀 수 있나요?",
    a: (
      <>
        역할은 권한 체계의 기준이 되므로 이용자가 직접 바꿀 수 없습니다. 잘못 선택하셨다면{" "}
        <Link href="/support/contact" className="text-primary-700 underline">
          문의하기
        </Link>
        를 통해 알려주세요.
      </>
    ),
  },
  {
    q: "당사자 본인도 계정을 만들 수 있나요?",
    a: (
      <>
        가능합니다. 당사자가 직접 가입하면 본인이 자기 기록의 주체가 되며, 자기표현 기록을
        스스로 남기고 나에 관한 기록을 열람할 수 있습니다. 보호자가 대신 등록해 둔 경우에도
        나중에 당사자 계정을 연결할 수 있습니다.
      </>
    ),
  },
  {
    q: "협력자에게 권한은 어떻게 주나요?",
    a: (
      <>
        보호자가 당사자별 권한 관리 화면에서 부여합니다. 부여 단위는 <b>도메인</b>(의료·교육·
        복지·일상·전환·법률)이며, 수준은 없음 / 읽기 / 쓰기 / 편집 네 가지입니다. 역할별
        권장 기본값을 한 번에 적용하는 버튼도 있어 처음에도 어렵지 않습니다.
      </>
    ),
  },
  {
    q: "권한에 유효기간이 꼭 있어야 하나요?",
    a: (
      <>
        기존 기록까지 고칠 수 있는 <b>편집</b> 수준은 유효기간이 필수입니다. 읽기·쓰기도
        서비스 계약기간이나 학년도처럼 실제 관계가 유지되는 기간으로 정해 두시길 권합니다.
        만료 7일 전에 미리 알려드리고, 기간이 지나면 자동으로 회수됩니다.
      </>
    ),
  },
  {
    q: "누가 내 기록을 봤는지 확인할 수 있나요?",
    a: (
      <>
        접근 로그 화면에서 누가 언제 어떤 기록을 열람했는지 확인할 수 있습니다. 권한을
        부여·수정·회수한 이력도 함께 남아 나중에 되짚어볼 수 있습니다.
      </>
    ),
  },
  {
    q: "권한을 회수하면 그동안 쌓인 기록은 어떻게 되나요?",
    a: (
      <>
        기록은 당사자의 것이므로 그대로 남습니다. 회수된 협력자가 더 이상 그 도메인을 열람할
        수 없게 될 뿐입니다.
      </>
    ),
  },
  {
    q: "건강·장애 정보는 안전하게 보관되나요?",
    a: (
      <>
        건강·장애 관련 정보는 개인정보보호법상 민감정보로 분류되어 별도 동의를 받아 처리하며,
        암호화해 저장합니다. 데이터베이스 차원의 행 수준 접근 제어(RLS)를 적용해 권한 없는
        조회는 애초에 결과가 나오지 않습니다. 자세한 내용은{" "}
        <Link href="/legal/privacy" className="text-primary-700 underline">
          개인정보처리방침
        </Link>
        을 참고해 주세요.
      </>
    ),
  },
  {
    q: "생애주기 단계는 무엇이고 어떻게 정해지나요?",
    a: (
      <>
        생년월일을 기준으로 영유아기(0~5세)·아동기(6~12세)·청소년 전환기(13~18세)·성인기
        (19~64세)·노년기(65세 이상) 5단계가 자동으로 계산됩니다. 단계에 따라 활성화되는
        기록과 확인 주체가 달라집니다.
      </>
    ),
  },
  {
    q: "기록 확인은 승인과 무엇이 다른가요?",
    a: (
      <>
        확인은 승인이 아닙니다. 개별화교육계획·개별지원계획·치료계획서 같은 공식 문서가
        작성되었을 때, 당사자와 보호자가 그 내용을 <b>인지했음</b>을 남기는 절차입니다. 확인
        여부가 기록의 효력을 좌우하지는 않지만, 함께 알고 있다는 사실을 투명하게 남깁니다.
      </>
    ),
  },
  {
    q: "성인이 되면 확인 주체가 바뀌나요?",
    a: (
      <>
        성인기(19세 이상)부터는 확인 주체가 보호자에서 당사자 본인으로 넘어갑니다. 청소년
        전환기에는 자립을 준비하는 개별화전환계획(ITP)·전환계획 기록이 함께 활성화됩니다.
      </>
    ),
  },
  {
    q: "담당자가 바뀔 때 인계는 어떻게 하나요?",
    a: (
      <>
        인계인수 노트 기능으로 다음 담당자에게 전달할 내용을 남길 수 있습니다. 새 담당자에게는
        보호자가 별도로 권한을 부여해야 기록에 접근할 수 있습니다.
      </>
    ),
  },
  {
    q: "모바일 앱도 있나요?",
    a: (
      <>
        웹과 함께 모바일 앱을 제공하며, 역할별 홈·기록 작성·알림함 등 주요 기능을 동일하게
        쓸 수 있습니다.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <article className="w-full max-w-3xl rounded-2xl bg-card p-8 text-[15px] leading-relaxed text-foreground shadow-sm ring-1 ring-foreground/10 sm:p-10">
      <h1 className="text-2xl font-extrabold tracking-tight">자주 묻는 질문</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        질문을 눌러 답변을 펼쳐보세요.
      </p>

      <section className="mt-8 flex flex-col gap-2.5">
        {FAQS.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-[10px] bg-muted/50 px-4 py-3 open:bg-muted"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-bold">
              <span>{faq.q}</span>
              <span
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              >
                ⌄
              </span>
            </summary>
            <div className="mt-2.5 border-t border-border pt-2.5">{faq.a}</div>
          </details>
        ))}
      </section>

      <p className="mt-8 rounded-[10px] bg-primary-50/60 p-4 text-sm dark:bg-primary-900/20">
        찾으시는 답이 없다면{" "}
        <Link href="/support/contact" className="text-primary-700 underline">
          문의하기
        </Link>
        로 알려주세요. 이용 방법 전반은{" "}
        <Link href="/support" className="text-primary-700 underline">
          이용 안내
        </Link>
        에 정리돼 있습니다.
      </p>

      <div className="mt-6 text-center">
        <Link href="/signup" className="text-sm text-primary-700 underline">
          가입 화면으로 →
        </Link>
      </div>
    </article>
  );
}
