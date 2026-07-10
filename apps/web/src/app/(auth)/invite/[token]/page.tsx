import Link from "next/link";
import { getInvitationByToken } from "@/app/(auth)/actions";
import { InviteActions } from "@/components/auth/InviteActions";
import {
  AuthCard,
  AuthDesc,
  AuthLogo,
  AuthTitle,
} from "@/components/auth/AuthShell";

const ROLE_LABEL: Record<string, string> = {
  person: "당사자",
  guardian: "보호자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

/** domain_grants.domain은 DB Domain enum(대문자: MED/EDU/WEL/DAI/TRA/LEG)으로 저장된다. */
const DOMAIN_LABEL: Record<string, string> = {
  MED: "의료 MED",
  EDU: "교육 EDU",
  WEL: "복지 WEL",
  DAI: "일상 DAI",
  TRA: "전환 TRA",
  LEG: "법률 LEG",
};

const ACCESS_LABEL: Record<string, string> = {
  read: "읽기",
  write: "읽기 · 쓰기",
  edit: "읽기 · 쓰기 · 편집",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <AuthCard>
        <AuthLogo />
        <AuthTitle>유효하지 않은 초대</AuthTitle>
        <AuthDesc>
          유효하지 않거나 만료된 초대입니다. 초대하신 분께 다시 요청해 주세요.
        </AuthDesc>
        <div className="mt-6">
          <Link href="/login" className="text-sm text-primary-700 underline">
            로그인으로 이동
          </Link>
        </div>
      </AuthCard>
    );
  }

  const validUntil = invitation.validUntil
    ? new Date(invitation.validUntil).toISOString().slice(0, 10)
    : null;

  return (
    <AuthCard>
      <AuthLogo />
      <AuthTitle>초대를 받으셨습니다</AuthTitle>
      <AuthDesc>아래 내용을 확인하고 초대를 수락하세요</AuthDesc>

      <div className="mt-5 rounded-[10px] bg-primary-50 p-4 text-sm leading-relaxed text-foreground">
        {invitation.personName ? (
          <>
            <b>{invitation.personName}</b> 님의 기록에 협력자로 초대했습니다
          </>
        ) : (
          <>기록에 협력자로 초대했습니다</>
        )}
      </div>

      <div className="mt-4 rounded-[10px] border border-border p-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">
          부여될 권한 미리보기
        </h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">연결 역할</dt>
            <dd className="font-medium text-foreground">
              {ROLE_LABEL[invitation.role] ?? invitation.role}
            </dd>
          </div>
          {invitation.domainGrants.map((g) => (
            <div key={g.domain} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">
                {DOMAIN_LABEL[g.domain] ?? g.domain}
              </dt>
              <dd className="font-medium text-foreground">
                {ACCESS_LABEL[g.access_level] ?? g.access_level}
              </dd>
            </div>
          ))}
          {validUntil && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">유효 기간</dt>
              <dd className="font-medium text-foreground">{validUntil} 까지</dd>
            </div>
          )}
        </dl>
      </div>

      <InviteActions token={invitation.token} />
    </AuthCard>
  );
}
