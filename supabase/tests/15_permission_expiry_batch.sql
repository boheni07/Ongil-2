-- =============================================================================
-- 15_permission_expiry_batch.sql — F-G-10 권한 자동 만료 배치 + D-7 사전 알림
--                                  + 분기 미사용 권한 감사 요약 + actor_type 핫픽스
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/15_*.sql
-- 검증 대상 마이그레이션:
--   - 20260715010000_p3_permission_expiry_batch
--       · process_permission_expiry()      (일 1회: 만료 비활성화 + D-7 사전 알림)
--       · send_permission_audit_summary()   (분기 1회: 90일 미사용 권한 요약)
--   - 20260715020000_p3_permission_logs_actor_type
--       · log_permission_change()           (actor_type 'system'/'user' 분기)
--
-- 원리: 두 배치 함수는 SECURITY DEFINER·cron 전용이라 postgres(BYPASSRLS·JWT 없음)에서
--       직접 호출한다. JWT 미설정 → auth.uid()=NULL → 트리거 로그 actor_type='system'.
--       valid_until 은 CURRENT_DATE 상대값으로 세팅해 실행 시점과 무관하게 재현된다.
-- =============================================================================
BEGIN;
SELECT plan(15);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
-- A: 만료 처리(①) 대상 person. 만료/미만료/무기한 세 권한으로 선택적 비활성화 검증.
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000a1', 'guardian');
SELECT tests.mk_person('e5000000-0000-0000-0000-0000000000a2','e5000000-0000-0000-0000-0000000000a1',
                       (CURRENT_DATE - INTERVAL '30 years')::date);
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000a3', 'teacher');   -- 만료 권한 grantee
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000a4', 'teacher');   -- 미만료 권한 grantee
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000a5', 'teacher');   -- 무기한 권한 grantee
SELECT tests.mk_perm('e5000000-0000-0000-0000-0000000000a2','e5000000-0000-0000-0000-0000000000a3',
                     'MED','read', (CURRENT_DATE - INTERVAL '1 day')::date, true);   -- 만료됨
SELECT tests.mk_perm('e5000000-0000-0000-0000-0000000000a2','e5000000-0000-0000-0000-0000000000a4',
                     'EDU','read', (CURRENT_DATE + INTERVAL '30 days')::date, true);  -- 미만료
SELECT tests.mk_perm('e5000000-0000-0000-0000-0000000000a2','e5000000-0000-0000-0000-0000000000a5',
                     'DAI','read', NULL, true);                                       -- 무기한

-- B: D-7 사전 알림(②) 대상 person. 주보호자 G_B + 비주보호자 G_Bnp.
--    X7 = 정확히 7일 후 만료(알림 대상), X5 = 5일 후 만료(알림 비대상).
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000b1', 'guardian');  -- 주보호자
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000b3', 'guardian');  -- 비주보호자
SELECT tests.mk_person('e5000000-0000-0000-0000-0000000000b2','e5000000-0000-0000-0000-0000000000b1',
                       (CURRENT_DATE - INTERVAL '30 years')::date);
SELECT tests.mk_guardian_link('e5000000-0000-0000-0000-0000000000b1','e5000000-0000-0000-0000-0000000000b2', true);
SELECT tests.mk_guardian_link('e5000000-0000-0000-0000-0000000000b3','e5000000-0000-0000-0000-0000000000b2', false);
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000b4', 'teacher');
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000b5', 'teacher');
SELECT tests.mk_perm('e5000000-0000-0000-0000-0000000000b2','e5000000-0000-0000-0000-0000000000b4',
                     'MED','read', (CURRENT_DATE + INTERVAL '7 days')::date, true);   -- D-7 대상
SELECT tests.mk_perm('e5000000-0000-0000-0000-0000000000b2','e5000000-0000-0000-0000-0000000000b5',
                     'EDU','read', (CURRENT_DATE + INTERVAL '5 days')::date, true);   -- 비대상

-- C: 미사용 권한 감사 요약(③) 대상 — 활성 권한이나 access_logs 없음.
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000c1', 'guardian');
SELECT tests.mk_person('e5000000-0000-0000-0000-0000000000c2','e5000000-0000-0000-0000-0000000000c1',
                       (CURRENT_DATE - INTERVAL '30 years')::date);
SELECT tests.mk_guardian_link('e5000000-0000-0000-0000-0000000000c1','e5000000-0000-0000-0000-0000000000c2', true);
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000c3', 'teacher');
SELECT tests.mk_perm('e5000000-0000-0000-0000-0000000000c2','e5000000-0000-0000-0000-0000000000c3',
                     'WEL','read', NULL, true);                                        -- 미사용(로그 없음)

-- D: 감사 요약 제외 대상 — 최근 90일 내 접근 기록 있음.
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000d1', 'guardian');
SELECT tests.mk_person('e5000000-0000-0000-0000-0000000000d2','e5000000-0000-0000-0000-0000000000d1',
                       (CURRENT_DATE - INTERVAL '30 years')::date);
SELECT tests.mk_guardian_link('e5000000-0000-0000-0000-0000000000d1','e5000000-0000-0000-0000-0000000000d2', true);
SELECT tests.mk_user('e5000000-0000-0000-0000-0000000000d3', 'teacher');
SELECT tests.mk_perm('e5000000-0000-0000-0000-0000000000d2','e5000000-0000-0000-0000-0000000000d3',
                     'TRA','read', NULL, true);
INSERT INTO access_logs(actor_id, person_id, action, accessed_at)
VALUES ('e5000000-0000-0000-0000-0000000000d3','e5000000-0000-0000-0000-0000000000d2','view', now());

-- ── 1차 실행(cron·JWT 없음 컨텍스트 = system) ────────────────────────────────
SELECT process_permission_expiry();
SELECT send_permission_audit_summary();

-- ── ① 만료 처리 ──────────────────────────────────────────────────────────────
-- T1. valid_until 지난 활성 권한은 비활성화된다.
SELECT is(
  (SELECT is_active FROM permissions
     WHERE person_id='e5000000-0000-0000-0000-0000000000a2'
       AND grantee_id='e5000000-0000-0000-0000-0000000000a3'),
  false, '만료된(valid_until < 오늘) 활성 권한은 비활성화된다');

-- T2. 미만료 권한은 건드리지 않는다.
SELECT is(
  (SELECT is_active FROM permissions
     WHERE person_id='e5000000-0000-0000-0000-0000000000a2'
       AND grantee_id='e5000000-0000-0000-0000-0000000000a4'),
  true, '미만료(valid_until 미래) 권한은 그대로 활성 유지');

-- T3. valid_until IS NULL(무기한) 권한은 건드리지 않는다.
SELECT is(
  (SELECT is_active FROM permissions
     WHERE person_id='e5000000-0000-0000-0000-0000000000a2'
       AND grantee_id='e5000000-0000-0000-0000-0000000000a5'),
  true, '무기한(valid_until NULL) 권한은 만료 처리에서 제외된다');

-- ── ② D-7 사전 알림 ──────────────────────────────────────────────────────────
-- T4. 정확히 7일 후 만료 권한 → 주보호자에게 알림 1건.
SELECT is(
  (SELECT count(*) FROM notifications n
     WHERE n.recipient_id='e5000000-0000-0000-0000-0000000000b1'
       AND n.type='permission_expiry_warning'
       AND n.data->>'permission_id' =
           (SELECT id::text FROM permissions
              WHERE person_id='e5000000-0000-0000-0000-0000000000b2'
                AND grantee_id='e5000000-0000-0000-0000-0000000000b4')),
  1::bigint, '정확히 7일 후 만료 권한에 대해 주보호자에게 사전 알림 1건 생성');

-- T5. 비주보호자(is_primary=false)에게는 사전 알림이 가지 않는다.
SELECT is(
  (SELECT count(*) FROM notifications n
     WHERE n.recipient_id='e5000000-0000-0000-0000-0000000000b3'
       AND n.type='permission_expiry_warning'),
  0::bigint, '비주보호자(is_primary=false)에게는 만료 사전 알림이 발송되지 않는다');

-- T6. 5일 후 만료(정확히 7일 아님) 권한에는 알림이 생성되지 않는다.
SELECT is(
  (SELECT count(*) FROM notifications n
     WHERE n.type='permission_expiry_warning'
       AND n.data->>'permission_id' =
           (SELECT id::text FROM permissions
              WHERE person_id='e5000000-0000-0000-0000-0000000000b2'
                AND grantee_id='e5000000-0000-0000-0000-0000000000b5')),
  0::bigint, 'D-7 이 아닌(5일 후 만료) 권한에는 사전 알림이 생성되지 않는다');

-- ── ③ 미사용 권한 감사 요약 ──────────────────────────────────────────────────
-- T7. 미사용 활성 권한 person → 주보호자에게 요약 1건.
SELECT is(
  (SELECT count(*) FROM notifications n
     WHERE n.recipient_id='e5000000-0000-0000-0000-0000000000c1'
       AND n.type='permission_audit_summary'
       AND n.data->>'person_id'='e5000000-0000-0000-0000-0000000000c2'),
  1::bigint, '90일 미사용 활성 권한이 있는 당사자의 주보호자에게 감사 요약 1건 생성');

-- T8. unused_count 는 실제 미사용 활성 권한 수(1)와 일치한다.
SELECT is(
  (SELECT n.data->>'unused_count' FROM notifications n
     WHERE n.recipient_id='e5000000-0000-0000-0000-0000000000c1'
       AND n.type='permission_audit_summary'
       AND n.data->>'person_id'='e5000000-0000-0000-0000-0000000000c2' LIMIT 1),
  '1', '감사 요약의 unused_count 는 미사용 활성 권한 수(1)와 일치한다');

-- T9. 최근 90일 내 접근 기록이 있는 권한만 있는 당사자는 요약에서 제외된다.
SELECT is(
  (SELECT count(*) FROM notifications n
     WHERE n.recipient_id='e5000000-0000-0000-0000-0000000000d1'
       AND n.type='permission_audit_summary'),
  0::bigint, '최근 90일 내 접근(access_logs) 있는 권한만 보유한 당사자는 미사용 요약에서 제외된다');

-- ── actor_type 핫픽스: 배치(system) revoke ───────────────────────────────────
-- T10. cron 배치(JWT 없음)가 일으킨 만료 revoke 로그는 actor_type='system'.
SELECT is(
  (SELECT count(*) FROM permission_logs pl
     JOIN permissions p ON p.id = pl.permission_id
     WHERE p.person_id='e5000000-0000-0000-0000-0000000000a2'
       AND p.grantee_id='e5000000-0000-0000-0000-0000000000a3'
       AND pl.action='revoke' AND pl.actor_type='system'),
  1::bigint, '배치(cron·JWT 없음) 발 만료 revoke 는 actor_type=system 으로 기록된다');

-- ── 2차 실행(idempotency / 재발송 방지) ──────────────────────────────────────
SELECT process_permission_expiry();
SELECT send_permission_audit_summary();

-- T11. 재실행해도 D-7 사전 알림은 중복 생성되지 않는다(NOT EXISTS 가드).
SELECT is(
  (SELECT count(*) FROM notifications n
     WHERE n.recipient_id='e5000000-0000-0000-0000-0000000000b1'
       AND n.type='permission_expiry_warning'
       AND n.data->>'permission_id' =
           (SELECT id::text FROM permissions
              WHERE person_id='e5000000-0000-0000-0000-0000000000b2'
                AND grantee_id='e5000000-0000-0000-0000-0000000000b4')),
  1::bigint, '재실행해도 만료 사전 알림은 중복 생성되지 않는다(idempotent)');

-- T12. 재실행해도 감사 요약은 80일 창 가드로 중복 생성되지 않는다.
SELECT is(
  (SELECT count(*) FROM notifications n
     WHERE n.recipient_id='e5000000-0000-0000-0000-0000000000c1'
       AND n.type='permission_audit_summary'
       AND n.data->>'person_id'='e5000000-0000-0000-0000-0000000000c2'),
  1::bigint, '재실행해도 미사용 권한 감사 요약은 80일 창 가드로 중복 생성되지 않는다');

-- ── actor_type 핫픽스: 사람(user) 컨텍스트 ───────────────────────────────────
-- JWT sub 를 설정한 뒤 직접 UPDATE → auth.uid() 채워짐 → 로그 actor_type='user'.
-- auth.uid() 두 구현(claims json / claim.sub) 모두 채워 구현 무관하게 재현(00_helpers 원리).
-- 역할은 postgres 유지(BYPASSRLS) — 여기서 검증하려는 건 RLS 가 아니라 actor_type 분기.
SELECT set_config('request.jwt.claims',
  json_build_object('sub','e5000000-0000-0000-0000-0000000000a1','role','authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub','e5000000-0000-0000-0000-0000000000a1', true);
UPDATE permissions SET access_level='edit', updated_at=now()
  WHERE person_id='e5000000-0000-0000-0000-0000000000a2'
    AND grantee_id='e5000000-0000-0000-0000-0000000000a4';
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);

-- T13. 사람(로그인) 컨텍스트의 UPDATE 는 actor_type='user' 로 기록된다.
SELECT is(
  (SELECT count(*) FROM permission_logs pl
     JOIN permissions p ON p.id = pl.permission_id
     WHERE p.person_id='e5000000-0000-0000-0000-0000000000a2'
       AND p.grantee_id='e5000000-0000-0000-0000-0000000000a4'
       AND pl.action='update' AND pl.actor_type='user'),
  1::bigint, '사람(로그인·JWT 있음) 컨텍스트 UPDATE 는 actor_type=user 로 기록된다');

-- ── REVOKE 검증: cron 전용 함수는 authenticated 직접 호출 불가 ────────────────
-- T14.
SELECT is(
  has_function_privilege('authenticated', 'process_permission_expiry()', 'EXECUTE'),
  false, 'process_permission_expiry() 는 authenticated 가 직접 호출 불가(REVOKE ALL FROM PUBLIC)');

-- T15.
SELECT is(
  has_function_privilege('authenticated', 'send_permission_audit_summary()', 'EXECUTE'),
  false, 'send_permission_audit_summary() 는 authenticated 가 직접 호출 불가(REVOKE ALL FROM PUBLIC)');

SELECT * FROM finish();
ROLLBACK;
