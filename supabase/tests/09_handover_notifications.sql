-- =============================================================================
-- 09_handover_notifications.sql — §4-10 handover_notes / §4-11 notifications
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/0[1-9]_*.sql
-- 검증: RLS 활성(20260713000000_p2_handover_notifications_rls) 후의 정상(방어된) 동작
--   - handover_notes: 발신/수신 본인만 SELECT, DAI write·보호자만 INSERT, 발신자 위조 차단,
--     수신자 미확인 건만 ack(컬럼 GRANT 로 acknowledged_at 외 변조 차단), 이미 확인 건 재수정 불가, DELETE 불가
--   - notifications: 수신자 본인만 SELECT, 안전 컬럼만 INSERT/UPDATE, 타인 알림 조작 불가, DELETE 불가
--
-- ⚠️ 정정 이력: 두 테이블 모두 원래 RLS 미활성 + authenticated 전권 GRANT 상태로,
--     임의 인증 사용자가 전 당사자의 인계인수·알림을 열람·위조·삭제 가능했다(consents·guardians·
--     permission_logs 와 동일 계열 결함). p2 마이그레이션이 RLS 활성 + 본인 한정 + 컬럼 GRANT 로 봉쇄.
-- =============================================================================
BEGIN;
SELECT plan(20);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
SELECT tests.mk_user('a9000000-0000-0000-0000-00000000000a', 'guardian');    -- GP 주보호자
SELECT tests.mk_person('a9000000-0000-0000-0000-00000000000c','a9000000-0000-0000-0000-00000000000a', DATE '2013-01-01');
SELECT tests.mk_guardian_link('a9000000-0000-0000-0000-00000000000a','a9000000-0000-0000-0000-00000000000c', true);
SELECT tests.mk_user('a9000000-0000-0000-0000-000000000001', 'supporter');   -- S1 발신자(DAI write 권한)
SELECT tests.mk_user('a9000000-0000-0000-0000-000000000002', 'supporter');   -- S2 수신자
SELECT tests.mk_user('a9000000-0000-0000-0000-000000000003', 'supporter');   -- OUT 무관/무권한
SELECT tests.mk_perm('a9000000-0000-0000-0000-00000000000c','a9000000-0000-0000-0000-000000000001','DAI','write');

-- =========================================================================
-- handover_notes
-- =========================================================================

-- H1. DAI write 권한자(S1)는 자기 명의로 인계인수 작성 가능
SELECT tests.login('a9000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$ INSERT INTO handover_notes(id, person_id, from_user_id, to_user_id, content)
     VALUES ('a9000000-0000-0000-0000-0000000000f1','a9000000-0000-0000-0000-00000000000c',
             'a9000000-0000-0000-0000-000000000001','a9000000-0000-0000-0000-000000000002','인계 내용') $$,
  'DAI write 권한 발신자는 인계인수 작성 가능');

-- H2. 권한 없는 사용자(OUT)는 인계인수 작성 불가(RLS WITH CHECK 위반, 42501)
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000003');
SELECT throws_ok(
  $$ INSERT INTO handover_notes(person_id, from_user_id, to_user_id, content)
     VALUES ('a9000000-0000-0000-0000-00000000000c','a9000000-0000-0000-0000-000000000003',
             'a9000000-0000-0000-0000-000000000002','침입 시도') $$,
  '42501', NULL, '권한(DAI write/보호자) 없는 사용자는 인계인수 작성 불가');

-- H3. 발신자 위조(from_user_id != auth.uid()) 불가 — S1 이 남의 명의로 작성 시도
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000001');
SELECT throws_ok(
  $$ INSERT INTO handover_notes(person_id, from_user_id, to_user_id, content)
     VALUES ('a9000000-0000-0000-0000-00000000000c','a9000000-0000-0000-0000-000000000002',
             'a9000000-0000-0000-0000-000000000003','명의 도용') $$,
  '42501', NULL, '발신자(from_user_id) 위조 불가 — 본인 명의로만 작성');

-- H4. 보호자(GP)는 구조적으로 인계인수 작성 가능
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-00000000000a');
SELECT lives_ok(
  $$ INSERT INTO handover_notes(id, person_id, from_user_id, to_user_id, content)
     VALUES ('a9000000-0000-0000-0000-0000000000f4','a9000000-0000-0000-0000-00000000000c',
             'a9000000-0000-0000-0000-00000000000a','a9000000-0000-0000-0000-000000000002','보호자 인계') $$,
  '보호자는 담당 당사자의 인계인수 작성 가능');

-- H5. 수신자(S2)는 자기 수신 건(S1발·GP발 2건) 열람 가능
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*) FROM handover_notes WHERE person_id='a9000000-0000-0000-0000-00000000000c'),
          2::bigint, '수신자는 자기 앞으로 온 인계인수를 열람 가능');

-- H6. 발신자(S1)는 자기 발신 건(1건)만 열람 가능
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000001');
SELECT is((SELECT count(*) FROM handover_notes WHERE person_id='a9000000-0000-0000-0000-00000000000c'),
          1::bigint, '발신자는 자기가 보낸 인계인수만 열람 가능');

-- H7. 무관 사용자(OUT)는 인계인수 열람 불가
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000003');
SELECT is((SELECT count(*) FROM handover_notes WHERE person_id='a9000000-0000-0000-0000-00000000000c'),
          0::bigint, '발신/수신 당사자가 아니면 인계인수 열람 불가');

-- H8. 수신자라도 acknowledged_at 외 컬럼(content) 변조 불가 — 컬럼 단위 GRANT(42501)
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000002');
SELECT throws_ok(
  $$ UPDATE handover_notes SET content='변조' WHERE id='a9000000-0000-0000-0000-0000000000f1' $$,
  '42501', NULL, '수신자도 acknowledged_at 외 컬럼은 변조 불가(컬럼 GRANT)');

-- H9. 수신자는 자기 수신·미확인 건을 확인(ack) 처리 가능
SELECT lives_ok(
  $$ UPDATE handover_notes SET acknowledged_at = now() WHERE id='a9000000-0000-0000-0000-0000000000f1' $$,
  '수신자는 미확인 인계인수를 확인 처리 가능');

-- H10. 이미 확인된 건은 재수정 불가(USING acknowledged_at IS NULL → 0행)
WITH u AS (UPDATE handover_notes SET acknowledged_at = now()
              WHERE id='a9000000-0000-0000-0000-0000000000f1' RETURNING 1)
SELECT is(
  (SELECT count(*) FROM u),
  0::bigint, '이미 확인된 인계인수는 재확인(재수정) 불가');

-- H11. 타인 수신 건은 확인 불가(USING to_user_id 불일치 → 0행) — OUT 이 GP발 미확인 건 ack 시도
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000003');
WITH u AS (UPDATE handover_notes SET acknowledged_at = now()
              WHERE id='a9000000-0000-0000-0000-0000000000f4' RETURNING 1)
SELECT is(
  (SELECT count(*) FROM u),
  0::bigint, '타인 수신 인계인수는 확인 처리 불가');

-- H12. 인계인수는 DELETE 불가(REVOKE, 42501) — 발신자조차
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000001');
SELECT throws_ok(
  $$ DELETE FROM handover_notes WHERE id='a9000000-0000-0000-0000-0000000000f1' $$,
  '42501', NULL, '인계인수는 DELETE 불가(위조·은폐 방지, GRANT 회수)');

-- =========================================================================
-- notifications
-- =========================================================================

-- 시드: S2 앞으로 온 알림 1건(postgres 역할 = BYPASSRLS 상태에서 삽입)
RESET ROLE;
INSERT INTO notifications(id, recipient_id, type, title, body)
  VALUES ('a9000000-0000-0000-0000-0000000000e1','a9000000-0000-0000-0000-000000000002','handover','인계인수 도착','확인 요망');

-- N1. 수신자(S2)는 자기 알림 열람 가능
SELECT tests.login('a9000000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*) FROM notifications WHERE recipient_id='a9000000-0000-0000-0000-000000000002'),
          1::bigint, '수신자는 자기 알림을 열람 가능');

-- N2. 무관 사용자(OUT)는 타인 알림 열람 불가
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000003');
SELECT is((SELECT count(*) FROM notifications WHERE recipient_id='a9000000-0000-0000-0000-000000000002'),
          0::bigint, '수신자 본인이 아니면 알림 열람 불가');

-- N3. 안전 컬럼(recipient_id,type,title,body,data)으로는 알림 발신 가능
SELECT lives_ok(
  $$ INSERT INTO notifications(recipient_id, type, title, body)
     VALUES ('a9000000-0000-0000-0000-000000000002','reminder','리마인더','본문') $$,
  '허용 컬럼만으로 알림 발신 가능(WITH CHECK true)');

-- N4. 비허용 컬럼(is_read) INSERT 불가 — 컬럼 GRANT(42501)
SELECT throws_ok(
  $$ INSERT INTO notifications(recipient_id, type, title, is_read)
     VALUES ('a9000000-0000-0000-0000-000000000002','reminder','조작',true) $$,
  '42501', NULL, 'is_read 등 상태 컬럼은 INSERT 불가(컬럼 GRANT)');

-- N5. 수신자는 자기 알림의 읽음 상태(is_read, read_at)만 갱신 가능
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000002');
SELECT lives_ok(
  $$ UPDATE notifications SET is_read=true, read_at=now() WHERE id='a9000000-0000-0000-0000-0000000000e1' $$,
  '수신자는 자기 알림을 읽음 처리 가능');

-- N6. 비허용 컬럼(title) UPDATE 불가 — 컬럼 GRANT(42501)
SELECT throws_ok(
  $$ UPDATE notifications SET title='변조' WHERE id='a9000000-0000-0000-0000-0000000000e1' $$,
  '42501', NULL, '읽음 컬럼 외(title 등)는 UPDATE 불가(컬럼 GRANT)');

-- N7. 타인 알림은 읽음 처리 불가(USING recipient_id 불일치 → 0행)
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000003');
WITH u AS (UPDATE notifications SET is_read=true
              WHERE id='a9000000-0000-0000-0000-0000000000e1' RETURNING 1)
SELECT is(
  (SELECT count(*) FROM u),
  0::bigint, '타인 알림은 읽음 처리 불가');

-- N8. 알림은 DELETE 불가(REVOKE, 42501) — 수신자 본인조차
RESET ROLE; SELECT tests.login('a9000000-0000-0000-0000-000000000002');
SELECT throws_ok(
  $$ DELETE FROM notifications WHERE id='a9000000-0000-0000-0000-0000000000e1' $$,
  '42501', NULL, '알림은 DELETE 불가(삭제 기능 부재, GRANT 회수)');

SELECT * FROM finish();
ROLLBACK;
