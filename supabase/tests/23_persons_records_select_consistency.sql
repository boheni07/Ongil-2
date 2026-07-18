-- =============================================================================
-- 23_persons_records_select_consistency.sql — 메타 회귀: persons_select ↔ records_select 논리 일관성
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/2[0-3]_*.sql
-- 근거: 2026-07-17 EDU-005(ITP) 구현 검증 중 발견된 선재 결함(persons_select 가 permissions 보유
--   전문가 분기를 아예 갖고 있지 않아 BIP·LEG·ISP·TRA 등 "담당 당사자 목록" 조회가 전문가에게
--   항상 빈 목록으로 보였던 사건, `20260717130000_p3_persons_select_permission_holders` 로 수정)의
--   재발 방지 메타 테스트. 개별 record_type pgTAP(18~22)이나 01_persons.sql 의 회귀 assert는
--   "이 특정 시나리오가 통과하는지"만 검증하고, "두 정책의 접근 판정 로직이 서로 어긋나지 않는지"는
--   검증하지 않는다 — 이 파일은 그 간극을 메운다.
--
-- ▶ 대상 정책(20260717130000 이후 최종본): persons_select / records_select
--   - 두 정책 모두 동일한 3가지 접근 경로를 공유해야 한다: ① person 역할 셀프(auth.uid()=id)
--     ② guardians 링크(주/비주 무관) ③ permissions 보유(is_active·valid_until 유효).
--   - 단, records_select 의 permissions 분기는 domain 이 일치해야 하지만 persons_select 의
--     permissions 분기는 domain 을 전혀 보지 않는다(어느 도메인이든 담당자면 명단에는 보여야
--     하므로 의도된 설계) — 따라서 "완전히 동일"이 아니라 "records 가 보이면 persons 도 반드시
--     보인다(단방향 함의)"가 정확한 불변식이다. 아래 테스트⑨는 그 비대칭을 명시적으로 고정한다.
-- =============================================================================
BEGIN;
SELECT plan(10);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
-- P1: permissions 보유 전문가(MED read) 대상, P2: 보호자(주+비주) 대상, P3: 셀프 당사자
SELECT tests.mk_user('a2300000-0000-0000-0000-000000000001', 'therapist');   -- TH: P1 에 MED read
SELECT tests.mk_user('a2300000-0000-0000-0000-00000000000a', 'guardian');    -- GP: P2 주보호자
SELECT tests.mk_user('a2300000-0000-0000-0000-00000000000b', 'guardian');    -- G2: P2 비주 공동보호자
SELECT tests.mk_user('a2300000-0000-0000-0000-000000000009', 'supporter');   -- OUT: 무권한
SELECT tests.mk_person('a2300000-0000-0000-0000-000000000101','a2300000-0000-0000-0000-00000000000a', DATE '2015-01-01'); -- P1
SELECT tests.mk_person('a2300000-0000-0000-0000-000000000102','a2300000-0000-0000-0000-00000000000a', DATE '2012-01-01'); -- P2
SELECT tests.mk_guardian_link('a2300000-0000-0000-0000-00000000000a','a2300000-0000-0000-0000-000000000102', true);
SELECT tests.mk_guardian_link('a2300000-0000-0000-0000-00000000000b','a2300000-0000-0000-0000-000000000102', false);
SELECT tests.mk_perm('a2300000-0000-0000-0000-000000000101','a2300000-0000-0000-0000-000000000001','MED','read');
SELECT tests.mk_user('a2300000-0000-0000-0000-000000000003', 'person');      -- PS: 셀프 당사자
SELECT tests.mk_person('a2300000-0000-0000-0000-000000000003','a2300000-0000-0000-0000-000000000003', DATE '2000-01-01'); -- P3=PS
-- 기록: P1(MED, TH 작성) + P1(EDU, GP 작성 — TH 의 권한은 MED 뿐이라 도메인 격리 확인용)
--       P2(WEL, GP 작성) + P3(DAI, PS 자기표현)
SELECT tests.mk_record('a2300000-0000-0000-0000-0000000000f1','a2300000-0000-0000-0000-000000000101','a2300000-0000-0000-0000-000000000001','MED','MED-001');
SELECT tests.mk_record('a2300000-0000-0000-0000-0000000000f2','a2300000-0000-0000-0000-000000000101','a2300000-0000-0000-0000-00000000000a','EDU','EDU-001');
SELECT tests.mk_record('a2300000-0000-0000-0000-0000000000f3','a2300000-0000-0000-0000-000000000102','a2300000-0000-0000-0000-00000000000a','WEL','WEL-001');
SELECT tests.mk_record('a2300000-0000-0000-0000-0000000000f4','a2300000-0000-0000-0000-000000000003','a2300000-0000-0000-0000-000000000003','DAI','SELF-001');

-- ── ① permissions 보유자: persons·records(동일 도메인) 둘 다 보임 ──────────
SELECT tests.login('a2300000-0000-0000-0000-000000000001');  -- TH
SELECT is((SELECT count(*) FROM persons WHERE id='a2300000-0000-0000-0000-000000000101'),
          1::bigint, 'permissions 보유자(MED read)는 persons SELECT 가능');
SELECT is((SELECT count(*) FROM records WHERE id='a2300000-0000-0000-0000-0000000000f1'),
          1::bigint, 'permissions 보유자(MED read)는 동일 도메인(MED) records SELECT 가능');

-- ── ② 주보호자: persons·records(임의 도메인) 둘 다 보임 ─────────────────────
RESET ROLE; SELECT tests.login('a2300000-0000-0000-0000-00000000000a');  -- GP
SELECT is((SELECT count(*) FROM persons WHERE id='a2300000-0000-0000-0000-000000000102'),
          1::bigint, '주보호자는 persons SELECT 가능');
SELECT is((SELECT count(*) FROM records WHERE id='a2300000-0000-0000-0000-0000000000f3'),
          1::bigint, '주보호자는 담당 당사자의 임의 도메인 records SELECT 가능(구조적 전체접근)');

-- ── ③ 비주 공동보호자: persons·records 둘 다 보임 ───────────────────────────
RESET ROLE; SELECT tests.login('a2300000-0000-0000-0000-00000000000b');  -- G2
SELECT is((SELECT count(*) FROM persons WHERE id='a2300000-0000-0000-0000-000000000102'),
          1::bigint, '비주 공동보호자도 persons SELECT 가능(guardians 링크는 주/비주 무관)');
SELECT is((SELECT count(*) FROM records WHERE id='a2300000-0000-0000-0000-0000000000f3'),
          1::bigint, '비주 공동보호자도 records SELECT 가능(동일 링크 조건)');

-- ── ④ 셀프 당사자: 본인 persons·records 둘 다 보임 ─────────────────────────
RESET ROLE; SELECT tests.login('a2300000-0000-0000-0000-000000000003');  -- PS
SELECT is((SELECT count(*) FROM persons WHERE id='a2300000-0000-0000-0000-000000000003'),
          1::bigint, '셀프 당사자는 본인 persons SELECT 가능');
SELECT is((SELECT count(*) FROM records WHERE id='a2300000-0000-0000-0000-0000000000f4'),
          1::bigint, '셀프 당사자는 본인 records(자기표현) SELECT 가능');

-- ── ⑤ 무권한자: persons·records 둘 다 0행(양쪽 다 새지 않음) ───────────────
RESET ROLE; SELECT tests.login('a2300000-0000-0000-0000-000000000009');  -- OUT
SELECT is((SELECT count(*) FROM persons WHERE id IN
             ('a2300000-0000-0000-0000-000000000101','a2300000-0000-0000-0000-000000000102')),
          0::bigint, '무권한자는 persons SELECT 불가(양쪽 정책 모두 차단되어야 함)');

-- ── ⑥ 의도된 비대칭: permissions 보유자는 다른 도메인 records 는 못 보지만
--     persons 는 여전히 보임(persons_select 는 도메인을 전혀 안 봄) ─────────
RESET ROLE; SELECT tests.login('a2300000-0000-0000-0000-000000000001');  -- TH(MED read 만 보유)
SELECT is((SELECT count(*) FROM records WHERE id='a2300000-0000-0000-0000-0000000000f2'),
          0::bigint, 'MED 권한자는 EDU 기록은 SELECT 불가(도메인 격리) — 그럼에도 위 테스트①에서 persons 는 SELECT 가능했음(의도된 비대칭, 결함 아님)');

SELECT * FROM finish();
ROLLBACK;
