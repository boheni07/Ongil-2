-- =============================================================================
-- 21_guardianship_report_leg001.sql — LEG-001(후견감독보고서) 전용 회귀 테스트
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/21_*.sql
-- 검증: LEG 도메인 write 권한자 INSERT·무권한자 차단·requires_confirmation=true confirmer 배정
--   (성인기/노년기→본인) + "연령가드는 앱 레이어 전용" 경계 확인.
-- ※ LEG-001 의 연령가드(성인기·노년기 만 19세 이상만)는 apps/web/.../records/leg/actions.ts 의
--   createGuardianshipReport() 가 isSelfConfirmingStage() 로 검사하는 앱 레이어 체크일 뿐(2026-07-17
--   라운드에 발견·수정된 P1 갭 — 최초엔 이 가드가 없었다), records_insert RLS·트리거는 record_type/
--   생애주기를 전혀 참조하지 않는다. 아래 테스트③은 그 경계를 DB 레벨에서 명시적으로 검증한다 —
--   대상 연령대 밖(아동기) 당사자에게도 DB는 INSERT를 허용하며, confirmer는 실제 생애주기 기준
--   (아동기→주보호자)으로 배정된다. 이는 결함이 아니라 설계된 책임 분리(연령가드=앱, 권한=RLS)다.
-- =============================================================================
BEGIN;
SELECT plan(5);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
SELECT tests.mk_user('b2100000-0000-0000-0000-000000000001', 'person');     -- PA 성인기 셀프 당사자(대상 연령대)
SELECT tests.mk_person('b2100000-0000-0000-0000-000000000001','b2100000-0000-0000-0000-000000000001', DATE '1995-01-01');
SELECT tests.mk_user('b2100000-0000-0000-0000-00000000000a', 'guardian');   -- GP 주보호자(아동기 PC 의 confirmer)
SELECT tests.mk_person('b2100000-0000-0000-0000-00000000000c','b2100000-0000-0000-0000-00000000000a', DATE '2016-01-01'); -- PC 아동기(대상 연령대 밖)
SELECT tests.mk_user('b2100000-0000-0000-0000-000000000002', 'social_worker'); -- SW LEG write 권한자
SELECT tests.mk_user('b2100000-0000-0000-0000-000000000003', 'social_worker'); -- OUT 무권한
SELECT tests.mk_perm('b2100000-0000-0000-0000-000000000001','b2100000-0000-0000-0000-000000000002','LEG','write');
SELECT tests.mk_perm('b2100000-0000-0000-0000-00000000000c','b2100000-0000-0000-0000-000000000002','LEG','write');

-- ── 작성 권한 ────────────────────────────────────────────────────────────────
SELECT tests.login('b2100000-0000-0000-0000-000000000002');  -- SW
SELECT lives_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b2100000-0000-0000-0000-000000000001','LEG','LEG-001',
             '{"report_kind":"periodic"}','b2100000-0000-0000-0000-000000000002',now()) $$,
  'LEG write 권한자(social_worker)는 후견감독보고서(LEG-001) INSERT 가능');

RESET ROLE; SELECT tests.login('b2100000-0000-0000-0000-000000000003');  -- OUT
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b2100000-0000-0000-0000-000000000001','LEG','LEG-001','{}','b2100000-0000-0000-0000-000000000003',now()) $$,
  '42501', NULL, 'LEG 권한 없는 자는 후견감독보고서(LEG-001) INSERT 불가(RLS)');

-- ── confirmer 자동 배정(requires_confirmation=true) ─────────────────────────
RESET ROLE;
SELECT tests.mk_record('b2100000-0000-0000-0000-0000000000f1','b2100000-0000-0000-0000-000000000001',
  'b2100000-0000-0000-0000-000000000002','LEG','LEG-001', true, false);
SELECT is((SELECT confirmer_id FROM records WHERE id='b2100000-0000-0000-0000-0000000000f1'),
          'b2100000-0000-0000-0000-000000000001'::uuid,
          '성인기(대상 연령대) 당사자의 LEG-001 confirmer 는 본인으로 자동 지정');

-- ── 연령가드 경계 확인(③④): DB는 대상 연령대 밖(아동기)에도 INSERT를 허용 ──
SELECT lives_ok(
  $$ INSERT INTO records(id,person_id,domain,record_type,content,author_id,requires_confirmation,updated_at)
     VALUES ('b2100000-0000-0000-0000-0000000000f2','b2100000-0000-0000-0000-00000000000c',
             'LEG','LEG-001','{}','b2100000-0000-0000-0000-000000000002',true,now()) $$,
  'DB 레벨에서는 대상 연령대 밖(아동기) 당사자에게도 LEG-001 INSERT 허용됨(연령가드는 createGuardianshipReport 앱 레이어 전용)');
SELECT is((SELECT confirmer_id FROM records WHERE id='b2100000-0000-0000-0000-0000000000f2'),
          'b2100000-0000-0000-0000-00000000000a'::uuid,
          '위 경우 confirmer 는 트리거가 실제 생애주기(아동기)로 판단해 주보호자로 배정(의도된 대상 여부와 무관)');

SELECT * FROM finish();
ROLLBACK;
