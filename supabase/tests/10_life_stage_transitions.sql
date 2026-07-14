-- =============================================================================
-- 10_life_stage_transitions.sql — process_life_stage_transitions() (Flow-SYS-05/06)
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/10_*.sql
-- 검증: 20260714000000_p2_life_stage_transitions 마이그레이션의 전환 처리 함수
--   - 성년 전환(만 18세): is_adult=false→true 승격 + 주보호자에게 life_stage_adult 알림
--   - idempotency: 이미 승격된 성년은 재실행해도 중복 승격/알림 없음(is_adult=false 가드)
--   - 청소년 전환기(만 14세인 기간 전체): 주보호자 + 담당 특수교사(EDU 활성권한)에게
--     life_stage_youth, NOT EXISTS 가드로 1인당 평생 1회만 발송(생일 당일 이후 캐치업도 가능)
--   - idempotency: 같은 기간 내 재실행해도 청소년 전환기 알림도 중복 생성되지 않음
--
-- 참고: 함수는 SECURITY DEFINER 이며 cron 전용이라 postgres 역할(BYPASSRLS)에서 직접 호출한다.
--       birth_date 는 CURRENT_DATE 기준 상대값으로 세팅해 실행 시점과 무관하게 재현된다.
-- =============================================================================
BEGIN;
SELECT plan(10);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
-- A: 오늘이 만 18세 생일, is_adult=false (성년 전환 대상)
SELECT tests.mk_user('b0000000-0000-0000-0000-0000000000a1', 'guardian');            -- A 주보호자
SELECT tests.mk_person('b0000000-0000-0000-0000-0000000000a2','b0000000-0000-0000-0000-0000000000a1',
                       (CURRENT_DATE - INTERVAL '18 years')::date);

-- C: 오늘이 만 14세 생일 (청소년 전환기 진입 대상) + 담당 특수교사 T(EDU write 활성)
SELECT tests.mk_user('b0000000-0000-0000-0000-0000000000c1', 'guardian');            -- C 주보호자
SELECT tests.mk_person('b0000000-0000-0000-0000-0000000000c2','b0000000-0000-0000-0000-0000000000c1',
                       (CURRENT_DATE - INTERVAL '14 years')::date);
SELECT tests.mk_user('b0000000-0000-0000-0000-0000000000c3', 'teacher');             -- 담당 특수교사
SELECT tests.mk_perm('b0000000-0000-0000-0000-0000000000c2','b0000000-0000-0000-0000-0000000000c3','EDU','write');

-- D: 만 14세이나 생일이 오늘이 아님(10일 전 생일) — 캐치업 대상(여전히 만 14세인 기간이므로 발송됨)
SELECT tests.mk_user('b0000000-0000-0000-0000-0000000000d1', 'guardian');            -- D 주보호자
SELECT tests.mk_person('b0000000-0000-0000-0000-0000000000d2','b0000000-0000-0000-0000-0000000000d1',
                       (CURRENT_DATE - INTERVAL '14 years' - INTERVAL '10 days')::date);

-- ── 1차 실행 ─────────────────────────────────────────────────────────────────
SELECT process_life_stage_transitions();

-- T1. A 가 성년으로 승격됨
SELECT is(
  (SELECT is_adult FROM persons WHERE id='b0000000-0000-0000-0000-0000000000a2'),
  true, '만 18세 도달 당사자는 is_adult=true 로 승격된다');

-- T2. A 주보호자에게 성년 전환 알림 1건 생성
SELECT is(
  (SELECT count(*) FROM notifications
     WHERE recipient_id='b0000000-0000-0000-0000-0000000000a1'
       AND type='life_stage_adult'
       AND data->>'person_id'='b0000000-0000-0000-0000-0000000000a2'),
  1::bigint, '성년 전환 시 주보호자에게 life_stage_adult 알림 발송');

-- T3. C 주보호자에게 청소년 전환기 알림 1건 생성
SELECT is(
  (SELECT count(*) FROM notifications
     WHERE recipient_id='b0000000-0000-0000-0000-0000000000c1'
       AND type='life_stage_youth'
       AND data->>'person_id'='b0000000-0000-0000-0000-0000000000c2'),
  1::bigint, '만 14세 생일 당일 주보호자에게 life_stage_youth 알림 발송');

-- T4. 담당 특수교사(T)에게도 청소년 전환기 알림 1건 생성
SELECT is(
  (SELECT count(*) FROM notifications
     WHERE recipient_id='b0000000-0000-0000-0000-0000000000c3'
       AND type='life_stage_youth'
       AND data->>'person_id'='b0000000-0000-0000-0000-0000000000c2'),
  1::bigint, '만 14세 생일 당일 담당 특수교사에게 life_stage_youth 알림 발송');

-- T5. 만 14세 생일이 오늘은 아니지만(10일 전) 여전히 만 14세인 D 도 캐치업으로 1건 발송
SELECT is(
  (SELECT count(*) FROM notifications
     WHERE recipient_id='b0000000-0000-0000-0000-0000000000d1'
       AND type='life_stage_youth'
       AND data->>'person_id'='b0000000-0000-0000-0000-0000000000d2'),
  1::bigint, '생일 당일이 아니어도 만 14세 기간 내면 캐치업으로 알림 발송');

-- ── 2차 실행(idempotency) ────────────────────────────────────────────────────
SELECT process_life_stage_transitions();

-- T6. A 는 여전히 성년(중복 승격 없음)
SELECT is(
  (SELECT is_adult FROM persons WHERE id='b0000000-0000-0000-0000-0000000000a2'),
  true, '재실행 후에도 성년 상태 유지');

-- T7. A 주보호자의 성년 전환 알림은 여전히 1건(중복 알림 없음 — is_adult=false 가드)
SELECT is(
  (SELECT count(*) FROM notifications
     WHERE recipient_id='b0000000-0000-0000-0000-0000000000a1'
       AND type='life_stage_adult'
       AND data->>'person_id'='b0000000-0000-0000-0000-0000000000a2'),
  1::bigint, '재실행해도 성년 전환 알림은 중복 생성되지 않는다(idempotent)');

-- T8. C 주보호자의 청소년 전환기 알림도 여전히 1건(NOT EXISTS 가드로 중복 방지)
SELECT is(
  (SELECT count(*) FROM notifications
     WHERE recipient_id='b0000000-0000-0000-0000-0000000000c1'
       AND type='life_stage_youth'
       AND data->>'person_id'='b0000000-0000-0000-0000-0000000000c2'),
  1::bigint, '재실행해도 청소년 전환기 알림(보호자)은 중복 생성되지 않는다(idempotent)');

-- T9. D 주보호자의 청소년 전환기 알림도 여전히 1건(캐치업분 재실행해도 중복 없음)
SELECT is(
  (SELECT count(*) FROM notifications
     WHERE recipient_id='b0000000-0000-0000-0000-0000000000d1'
       AND type='life_stage_youth'
       AND data->>'person_id'='b0000000-0000-0000-0000-0000000000d2'),
  1::bigint, '캐치업으로 발송된 청소년 전환기 알림도 재실행 시 중복 생성되지 않는다');

-- T10. 함수는 authenticated 에게 EXECUTE 권한이 없다(cron 전용)
SELECT is(
  has_function_privilege('authenticated', 'process_life_stage_transitions()', 'EXECUTE'),
  false, 'process_life_stage_transitions() 는 authenticated 가 직접 호출 불가');

SELECT * FROM finish();
ROLLBACK;
