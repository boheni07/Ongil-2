import Link from "next/link";
import {
  hasPersonProfile,
  getRecentSelfExpressions,
  getPersonBirthDate,
} from "@/app/(app)/home/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { computeLifeStage } from "@/lib/lifecycle";
import { CreateProfileForm } from "./CreateProfileForm";

/**
 * P-01 오늘 기록 홈(당사자 전용). 프로필이 없으면 CreateProfileForm, 있으면 히어로 + 대형 CTA +
 * 최근 7일 자기표현 이모지 스트립. 서버 컴포넌트.
 */

const MOOD_EMOJI: Record<string, string> = {
  good: "😊",
  neutral: "😐",
  sad: "😢",
  angry: "😡",
};

function formatKoreanDate(d: Date): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
}

export async function PersonHome({ userName }: { userName: string | null }) {
  const hasProfile = await hasPersonProfile();
  if (!hasProfile) {
    return <CreateProfileForm />;
  }

  const [recent, birthDate] = await Promise.all([
    getRecentSelfExpressions(),
    getPersonBirthDate(),
  ]);
  const name = userName ?? "당신";

  return (
    <div className="flex flex-1 flex-col">
      <section className="rounded-2xl bg-gradient-to-b from-primary-50 to-white p-6 ring-1 ring-primary-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-person-base font-semibold text-primary-700">
            {formatKoreanDate(new Date())}
          </p>
          {birthDate && <StageBadge lifeStage={computeLifeStage(birthDate)} simple />}
        </div>
        <h1 className="mt-2 text-3xl leading-snug font-extrabold text-foreground">
          안녕하세요, {name}님!
          <br />
          오늘 하루는 어땠어요?
        </h1>
      </section>

      <Link
        href="/home/express"
        className="mt-6 flex min-h-[112px] items-center gap-4 rounded-2xl bg-accent-amber px-6 py-6 text-left shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <span aria-hidden="true" className="text-[56px] leading-none">
          ✏️
        </span>
        <span className="flex flex-col">
          <span className="text-2xl font-extrabold text-accent-stone">오늘 이야기하기</span>
          <span className="mt-1 text-person-base text-accent-stone/80">기분·밥·활동을 눌러서 알려주세요</span>
        </span>
      </Link>

      {/* 프로토타입 web-person.html .tiles — 56px 아이콘의 대형 정사각 타일 버튼 2개.
          당사자 모드는 접근성 우선(큰 터치타겟) 원칙이라 밑줄 텍스트 링크로 축소하지 않는다
          (2026-07-19, 프로토타입 대조로 발견한 후퇴를 되돌림). */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Link
          href="/records"
          className="flex flex-col items-center gap-2 rounded-2xl border-[3px] border-primary-100 bg-primary-50 px-4 py-6 text-center transition-colors active:bg-primary-100"
        >
          <span aria-hidden="true" className="text-[56px] leading-none">
            📖
          </span>
          <span className="text-person-base font-bold text-accent-stone">내 기록 보기</span>
        </Link>
        <Link
          href="/settings/privacy"
          className="flex flex-col items-center gap-2 rounded-2xl border-[3px] border-primary-100 bg-primary-50 px-4 py-6 text-center transition-colors active:bg-primary-100"
        >
          <span aria-hidden="true" className="text-[56px] leading-none">
            ⚙️
          </span>
          <span className="text-person-base font-bold text-accent-stone">설정</span>
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-person-base font-bold text-accent-stone">최근 7일 기록</h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-person-base text-accent-pebble ring-1 ring-foreground/10">
            아직 기록이 없어요. 위 버튼을 눌러 오늘 이야기를 남겨보세요.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {recent.map((day, i) => {
              const d = new Date(day.recordDate);
              return (
                <li
                  key={`${day.recordDate}-${i}`}
                  className="flex min-h-[88px] w-[88px] flex-col items-center justify-center gap-1 rounded-2xl bg-white ring-1 ring-foreground/10"
                >
                  <span aria-hidden="true" className="text-4xl leading-none">
                    {day.mood ? MOOD_EMOJI[day.mood] ?? "•" : "•"}
                  </span>
                  <span className="text-sm font-medium text-accent-pebble">
                    {d.getMonth() + 1}/{d.getDate()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
