-- P0-7: invitations 테이블(이해관계자 초대, Flow-1) + accept_invitation() 전개 함수
-- 참조: docs/05-erd.md §2-12, docs/04-workflow.md Flow-1
--
-- 적용 순서: 이 마이그레이션(테이블 생성)이 20260710000000_p0_7_consents_invitations_rls
-- (security-rls의 RLS/GRANT)보다 먼저 적용되도록 디렉터리 타임스탬프를 한 틱 앞으로 둔다
-- (20260709999999). invitations의 RLS 정책·GRANT·consents RLS는 그 마이그레이션이 신뢰 소스다.
-- 여기서는 (1) 테이블/enum/제약/인덱스/FK, (2) accept_invitation() 함수만 정의한다.
--
-- 설계 판단:
-- 1. role은 초대 가능한 5개 역할(당사자 person 제외)만 허용하므로 UserRole enum을 재사용하지
--    않고 CHECK 제약이 있는 TEXT로 둔다(permission_presets.role과 동일 선례). 값 집합이
--    UserRole의 진부분집합이라 enum 재사용 시 person도 통과되어 버린다.
-- 2. status만 닫힌 4값 집합이라 InvitationStatus enum으로 둔다.
-- 3. domain_grants는 [{ domain, access_level }, ...] 형태 JSONB. 수락 시 permissions로 전개된다.

-- =========================================================================
-- 1. invitations 테이블
-- =========================================================================

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID,
    "inviter_id" UUID,
    "invitee_email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "domain_grants" JSONB NOT NULL,
    "valid_until" DATE,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "accepted_at" TIMESTAMPTZ,
    "accepted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invitations_role_check"
      CHECK ("role" IN ('guardian','supporter','teacher','social_worker','therapist'))
);

-- CreateIndex (token은 UNIQUE 제약이 인덱스를 겸함)
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");
CREATE INDEX "idx_invitations_email" ON "invitations"("invitee_email");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_fkey"
  FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_fkey"
  FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- invitations의 RLS 활성화 / 정책 / GRANT(anon REVOKE, authenticated SELECT·INSERT·UPDATE)는
-- 20260710000000_p0_7_consents_invitations_rls 마이그레이션(security-rls)이 담당한다.
-- consents RLS도 동일 마이그레이션이 담당한다.

-- =========================================================================
-- 2. accept_invitation() — 초대 수락 시 permissions 전개 (SECURITY DEFINER)
-- =========================================================================
-- permissions_write RLS(§4-3)는 주보호자만 INSERT를 허용하므로, 초대받은 이해관계자는
-- 자신에게 권한을 부여할 수 없다. 초대 수락은 정당한 권한 부여 경로이므로, 검증 로직을
-- DB에 캡슐화한 SECURITY DEFINER 함수로 처리한다. 함수는 (1) 호출자 이메일 == invitee_email,
-- (2) status='pending', (3) 미만료를 확인한 뒤에만 전개한다. auth.uid()는 함수 내에서도
-- 호출자 JWT를 가리키므로 permissions 감사 트리거(log_permission_change)의 actor 기록도 정상 동작.
--
-- 거절(decline)은 별도 함수 없이 invitations_update RLS(security-rls: invitee 이메일 일치 +
-- pending→declined 전이만 허용)에 기대어 서버 액션에서 직접 UPDATE한다. 권한 전개가 없어
-- SECURITY DEFINER가 불필요하기 때문이다.

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv        invitations%ROWTYPE;
  v_uid        uuid := auth.uid();
  v_email      text;
  v_grant      jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT email INTO v_email FROM users WHERE id = v_uid;

  SELECT * INTO v_inv FROM invitations
  WHERE token = p_token AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '유효하지 않거나 이미 처리된 초대입니다.';
  END IF;

  IF v_inv.invitee_email IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION '초대 대상 이메일과 로그인 계정이 일치하지 않습니다.';
  END IF;

  IF v_inv.valid_until IS NOT NULL AND v_inv.valid_until < CURRENT_DATE THEN
    UPDATE invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION '만료된 초대입니다.';
  END IF;

  -- domain_grants([{ domain, access_level }, ...])를 permissions로 전개
  FOR v_grant IN SELECT * FROM jsonb_array_elements(v_inv.domain_grants)
  LOOP
    INSERT INTO permissions (person_id, grantee_id, domain, access_level, granted_by, valid_until)
    VALUES (
      v_inv.person_id,
      v_uid,
      (v_grant->>'domain')::"Domain",
      (v_grant->>'access_level')::"AccessLevel",
      v_inv.inviter_id,
      v_inv.valid_until
    )
    ON CONFLICT (person_id, grantee_id, domain) DO UPDATE SET
      access_level = EXCLUDED.access_level,
      is_active    = true,
      valid_until  = EXCLUDED.valid_until,
      granted_by   = EXCLUDED.granted_by,
      updated_at   = now();
  END LOOP;

  UPDATE invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = v_uid
  WHERE id = v_inv.id;

  RETURN v_inv.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;
