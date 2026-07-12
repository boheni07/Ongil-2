-- =============================================================================
-- 07_invitations.sql — §4-8 invitations RLS + accept_invitation() SECURITY DEFINER
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/0[1-8]_*.sql
-- 검증: invitations_select/insert/update(status 컬럼) + anon 전면차단 + accept_invitation 전개
--   (20260709999999_p0_7_invitations + 20260710000000_p0_7_consents_invitations_rls)
-- =============================================================================
BEGIN;
SELECT plan(12);

SELECT tests.mk_user('a7000000-0000-0000-0000-00000000000a', 'guardian',  'g@inv.dev');       -- GUARD 초대자
SELECT tests.mk_user('a7000000-0000-0000-0000-000000000001', 'therapist', 'invitee@inv.dev'); -- INVITEE
SELECT tests.mk_user('a7000000-0000-0000-0000-000000000002', 'supporter', 'out@inv.dev');     -- OUT
SELECT tests.mk_person('a7000000-0000-0000-0000-00000000000c','a7000000-0000-0000-0000-00000000000a', DATE '2013-01-01'); -- PG

-- 시드 초대: INV1(accept 용) / INV3(decline·컬럼제한 용) / INV4(잘못된 이메일 accept 용)
INSERT INTO invitations(id, token, person_id, inviter_id, invitee_email, role, domain_grants, valid_until, status) VALUES
 ('a7000000-0000-0000-0000-0000000000f1','a7000000-0000-0000-0000-0000000000d1','a7000000-0000-0000-0000-00000000000c','a7000000-0000-0000-0000-00000000000a','invitee@inv.dev','therapist','[{"domain":"MED","access_level":"read"}]', CURRENT_DATE + 7, 'pending'),
 ('a7000000-0000-0000-0000-0000000000f3','a7000000-0000-0000-0000-0000000000d3','a7000000-0000-0000-0000-00000000000c','a7000000-0000-0000-0000-00000000000a','invitee@inv.dev','therapist','[{"domain":"EDU","access_level":"read"}]', CURRENT_DATE + 7, 'pending'),
 ('a7000000-0000-0000-0000-0000000000f4','a7000000-0000-0000-0000-0000000000d4','a7000000-0000-0000-0000-00000000000c','a7000000-0000-0000-0000-00000000000a','invitee@inv.dev','therapist','[{"domain":"WEL","access_level":"read"}]', CURRENT_DATE + 7, 'pending');

-- ── INSERT: 보호자 본인 명의만 ──────────────────────────────────────────────
SELECT tests.login('a7000000-0000-0000-0000-00000000000a');  -- GUARD
SELECT lives_ok(
  $$ INSERT INTO invitations(inviter_id, invitee_email, role, domain_grants)
     VALUES ('a7000000-0000-0000-0000-00000000000a','x@inv.dev','supporter','[{"domain":"DAI","access_level":"write"}]') $$,
  '보호자는 자기 명의 invitation INSERT 가능');

RESET ROLE; SELECT tests.login('a7000000-0000-0000-0000-000000000002');  -- supporter OUT
SELECT throws_ok(
  $$ INSERT INTO invitations(inviter_id, invitee_email, role, domain_grants)
     VALUES ('a7000000-0000-0000-0000-000000000002','y@inv.dev','supporter','[{"domain":"DAI","access_level":"write"}]') $$,
  '42501', NULL, '비보호자는 invitation INSERT 불가(role=guardian 아님)');

-- ── SELECT: 초대자 또는 초대받은 이메일 ─────────────────────────────────────
RESET ROLE; SELECT tests.login('a7000000-0000-0000-0000-00000000000a');  -- 초대자 GUARD
SELECT is((SELECT count(*) FROM invitations WHERE id='a7000000-0000-0000-0000-0000000000f1'),
          1::bigint, '초대자 본인은 자기가 보낸 초대 SELECT 가능');

RESET ROLE; SELECT tests.login('a7000000-0000-0000-0000-000000000001');  -- INVITEE(이메일 일치)
SELECT is((SELECT count(*) FROM invitations WHERE id='a7000000-0000-0000-0000-0000000000f1'),
          1::bigint, '초대받은 당사자(이메일 일치)는 초대 SELECT 가능');

RESET ROLE; SELECT tests.login('a7000000-0000-0000-0000-000000000002');  -- OUT(무관)
SELECT is((SELECT count(*) FROM invitations WHERE id='a7000000-0000-0000-0000-0000000000f1'),
          0::bigint, '무관한 사용자는 초대를 볼 수 없음');

-- anon 전면 차단(REVOKE ALL FROM anon) — 카탈로그 권한으로 검증(role 스위칭 취약성 회피)
RESET ROLE;
SELECT ok(NOT has_table_privilege('anon','invitations','SELECT'),
          '미인증(anon)은 invitations SELECT 권한 없음(REVOKE ALL FROM anon)');

-- ── UPDATE: 초대받은 본인 + status 컬럼만 ───────────────────────────────────
RESET ROLE; SELECT tests.login('a7000000-0000-0000-0000-000000000001');  -- INVITEE
SELECT lives_ok(
  $$ UPDATE invitations SET status='declined' WHERE id='a7000000-0000-0000-0000-0000000000f3' $$,
  '초대받은 본인은 status 를 declined 로 UPDATE 가능(거절)');
SELECT throws_ok(
  $$ UPDATE invitations SET domain_grants='[{"domain":"LEG","access_level":"edit"}]' WHERE id='a7000000-0000-0000-0000-0000000000f4' $$,
  '42501', NULL, 'status 외 컬럼(domain_grants) UPDATE 는 컬럼 권한으로 차단(권한상승 방지)');

-- ── accept_invitation(): SECURITY DEFINER 권한 전개 ─────────────────────────
RESET ROLE; SELECT tests.login('a7000000-0000-0000-0000-000000000001');  -- INVITEE
SELECT lives_ok(
  $$ SELECT accept_invitation('a7000000-0000-0000-0000-0000000000d1') $$,
  '초대받은 본인은 accept_invitation() 으로 초대 수락 가능');
RESET ROLE;
SELECT is((SELECT count(*) FROM permissions
           WHERE person_id='a7000000-0000-0000-0000-00000000000c' AND grantee_id='a7000000-0000-0000-0000-000000000001' AND domain='MED'),
          1::bigint, 'accept_invitation 이 domain_grants 를 permissions 로 전개(MED read 생성)');
SELECT is((SELECT status::text FROM invitations WHERE id='a7000000-0000-0000-0000-0000000000f1'),
          'accepted', 'accept_invitation 후 초대 status=accepted');

-- 잘못된 이메일 사용자의 수락 시도 → 예외
SELECT tests.login('a7000000-0000-0000-0000-000000000002');  -- OUT(이메일 불일치)
SELECT throws_ok(
  $$ SELECT accept_invitation('a7000000-0000-0000-0000-0000000000d4') $$,
  'P0001', NULL, '이메일 불일치 사용자의 accept_invitation 은 예외로 차단');

SELECT * FROM finish();
ROLLBACK;
