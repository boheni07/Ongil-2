-- =============================================================================
-- 04_audit_logs.sql — §4-4 permission_logs / access_logs
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/0[1-8]_*.sql
-- 검증: trg_permission_audit 자동기록 / access_logs INSERT-only 불변 / 주보호자 SELECT
--   (20260709040253_p0_4_rls_policies)
--
-- ⚠️ 정정 이력: permission_logs는 원래 `DISABLE ROW LEVEL SECURITY` 상태였고
--     authenticated가 SELECT/INSERT/UPDATE/DELETE GRANT를 보유해, 임의 인증 사용자가
--     전 당사자의 권한변경 감사로그를 열람·수정·삭제할 수 있는 취약 상태였다(docs/05-erd.md
--     §4-4 참고). 20260710020000_p1_permission_logs_rls_hotfix가 RLS를 활성화하고
--     SELECT를 주보호자로 한정 + UPDATE/DELETE GRANT를 회수했다. 아래 두 테스트는 핫픽스
--     적용 후의 정상(방어된) 동작을 검증한다.
-- =============================================================================
BEGIN;
SELECT plan(9);

SELECT tests.mk_user('a4000000-0000-0000-0000-00000000000a', 'guardian');   -- GP primary
SELECT tests.mk_user('a4000000-0000-0000-0000-00000000000b', 'guardian');   -- G2 non-primary
SELECT tests.mk_person('a4000000-0000-0000-0000-00000000000c','a4000000-0000-0000-0000-00000000000a', DATE '2013-01-01');
SELECT tests.mk_guardian_link('a4000000-0000-0000-0000-00000000000a','a4000000-0000-0000-0000-00000000000c', true);
SELECT tests.mk_guardian_link('a4000000-0000-0000-0000-00000000000b','a4000000-0000-0000-0000-00000000000c', false);
SELECT tests.mk_user('a4000000-0000-0000-0000-000000000001', 'supporter');  -- GR grantee / OUT 겸용
-- access_logs 시드 1건(PG 대상)
INSERT INTO access_logs(person_id, actor_id, action) VALUES
  ('a4000000-0000-0000-0000-00000000000c','a4000000-0000-0000-0000-000000000001','view');

-- ── permission_logs: 감사 트리거 자동기록 ───────────────────────────────────
SELECT tests.login('a4000000-0000-0000-0000-00000000000a');  -- GP 가 권한 부여
INSERT INTO permissions(person_id,grantee_id,domain,access_level,updated_at)
  VALUES ('a4000000-0000-0000-0000-00000000000c','a4000000-0000-0000-0000-000000000001','MED','read',now());
RESET ROLE;
-- seed.sql(로컬 개발 목업)이 이미 다른 permission_logs 'grant' 행을 여럿 남기므로 전체 카운트가
-- 아니라 이 테스트가 만든 permission 행에만 범위를 좁혀 확인한다(2026-07-18 CTO팀 갭분석 발견 —
-- 이전에는 이 지점까지 실행이 도달한 적이 없어 놓쳤던 시드 데이터 오염 문제).
SELECT is(
  (SELECT count(*) FROM permission_logs pl
     JOIN permissions p ON p.id = pl.permission_id
     WHERE pl.action='grant'
       AND p.person_id='a4000000-0000-0000-0000-00000000000c'
       AND p.grantee_id='a4000000-0000-0000-0000-000000000001'
       AND p.domain='MED'),
  1::bigint, 'permissions INSERT 시 trg_permission_audit 가 grant 로그를 자동 기록');

-- 핫픽스 검증 #1: 관련 없는 authenticated(주보호자 아님)는 permission_logs를 볼 수 없음
SELECT tests.login('a4000000-0000-0000-0000-000000000001');  -- grantee(무관 사용자 취급)
SELECT is((SELECT count(*) FROM permission_logs),
          0::bigint, '주보호자가 아닌 authenticated는 permission_logs를 열람할 수 없음(핫픽스 후)');

-- 핫픽스 검증 #2: 주보호자조차 permission_logs를 DELETE할 수 없음(불변 감사 원칙, GRANT 회수)
RESET ROLE; SELECT tests.login('a4000000-0000-0000-0000-00000000000a');  -- GP primary(관련 주보호자)
WITH d AS (DELETE FROM permission_logs RETURNING 1)
SELECT is((SELECT count(*) FROM d),
          0::bigint, 'permission_logs는 주보호자도 DELETE 불가(UPDATE/DELETE GRANT 회수, 핫픽스 후)');

-- ── access_logs: INSERT-only 불변 + 주보호자 SELECT ─────────────────────────
RESET ROLE; SELECT tests.login('a4000000-0000-0000-0000-000000000001');  -- 임의 인증 사용자
SELECT lives_ok(
  $$ INSERT INTO access_logs(person_id, actor_id, action)
     VALUES ('a4000000-0000-0000-0000-00000000000c','a4000000-0000-0000-0000-000000000001','view') $$,
  'access_logs 는 임의 인증 사용자가 INSERT 가능(WITH CHECK true — 시스템 기록)');

RESET ROLE; SELECT tests.login('a4000000-0000-0000-0000-00000000000a');  -- GP primary
SELECT ok((SELECT count(*) FROM access_logs WHERE person_id='a4000000-0000-0000-0000-00000000000c') >= 1,
          '주보호자는 자기 당사자 access_logs SELECT 가능');

RESET ROLE; SELECT tests.login('a4000000-0000-0000-0000-00000000000b');  -- G2 non-primary
SELECT is((SELECT count(*) FROM access_logs WHERE person_id='a4000000-0000-0000-0000-00000000000c'),
          0::bigint, '공동보호자(비주)는 access_logs 를 볼 수 없음(주보호자만)');

RESET ROLE; SELECT tests.login('a4000000-0000-0000-0000-000000000001');  -- grantee/외부
SELECT is((SELECT count(*) FROM access_logs WHERE person_id='a4000000-0000-0000-0000-00000000000c'),
          0::bigint, '권한 사용자/외부인은 access_logs 를 볼 수 없음');

-- 불변성: DELETE/UPDATE 정책 부재 → 0행 (RLS on, 정책 없음)
RESET ROLE; SELECT tests.login('a4000000-0000-0000-0000-00000000000a');  -- 주보호자조차
WITH d AS (DELETE FROM access_logs WHERE person_id='a4000000-0000-0000-0000-00000000000c' RETURNING 1)
SELECT is((SELECT count(*) FROM d), 0::bigint, 'access_logs 는 DELETE 정책 부재 → 삭제 불가(불변)');
WITH u AS (UPDATE access_logs SET action='delete' WHERE person_id='a4000000-0000-0000-0000-00000000000c' RETURNING 1)
SELECT is((SELECT count(*) FROM u), 0::bigint, 'access_logs 는 UPDATE 정책 부재 → 수정 불가(불변)');

SELECT * FROM finish();
ROLLBACK;
