import Link from "next/link";

export const metadata = { title: "문의하기 · 온길" };

export default function ContactPage() {
  return (
    <article className="w-full max-w-3xl rounded-2xl bg-card p-8 text-[15px] leading-relaxed text-foreground shadow-sm ring-1 ring-foreground/10 sm:p-10">
      <h1 className="text-2xl font-extrabold tracking-tight">문의하기</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        이메일로 문의를 받고 있습니다. 내용에 따라 아래 창구로 보내주세요.
      </p>

      <section className="mt-8 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold">문의 채널</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th className="w-32 py-2 pr-4 text-left align-top font-bold">
                    서비스 이용
                  </th>
                  <td className="py-2">
                    <a
                      href="mailto:support@ongil.example"
                      className="text-primary-700 underline"
                    >
                      support@ongil.example
                    </a>
                    <br />
                    가입·역할·권한 부여 등 이용 중 겪는 어려움
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left align-top font-bold">
                    개인정보·기록
                  </th>
                  <td className="py-2">
                    <a
                      href="mailto:privacy@ongil.example"
                      className="text-primary-700 underline"
                    >
                      privacy@ongil.example
                    </a>
                    <br />
                    열람·정정·삭제·처리정지 요구, 동의 철회
                  </td>
                </tr>
                <tr>
                  <th className="py-2 pr-4 text-left align-top font-bold">
                    제휴·기관 도입
                  </th>
                  <td className="py-2">
                    <a
                      href="mailto:partner@ongil.example"
                      className="text-primary-700 underline"
                    >
                      partner@ongil.example
                    </a>
                    <br />
                    복지관·학교·치료기관 단위 도입 상담
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold">운영 시간</h2>
          <p className="mt-2">
            평일 09:00~18:00 (점심 12:00~13:00, 주말·공휴일 휴무). 운영 시간 외에 보내주신
            문의는 다음 영업일에 순차적으로 답변드립니다.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold">문의 시 함께 적어주시면 좋은 내용</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>가입하신 역할(당사자·보호자·활동지원사·특수교사·사회복지사·치료사)</li>
            <li>문제가 발생한 화면 이름과 시각</li>
            <li>웹/모바일 중 어디에서 발생했는지</li>
          </ul>
          <p className="mt-3 rounded-[10px] bg-muted/50 p-4 text-sm">
            건강·장애 관련 민감정보나 비밀번호는 이메일 본문에 적지 말아 주세요. 확인이
            필요한 경우 안전한 경로로 별도 안내드립니다.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold">문의 전에 확인해 보세요</h2>
          <p className="mt-2">
            가입·권한·기록 확인 절차에 대한 질문은{" "}
            <Link href="/support/faq" className="text-primary-700 underline">
              자주 묻는 질문
            </Link>
            에서 바로 답을 찾으실 수 있습니다. 전반적인 이용 방법은{" "}
            <Link href="/support" className="text-primary-700 underline">
              이용 안내
            </Link>
            에 정리돼 있습니다.
          </p>
        </div>
      </section>

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-primary-700 underline">
          ← 처음 화면으로
        </Link>
      </div>
    </article>
  );
}
