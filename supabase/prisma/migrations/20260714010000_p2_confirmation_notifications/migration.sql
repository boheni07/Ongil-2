-- P2: 기록 확인(Confirmation) 알림 트리거 — Flow-SYS-07(확인 요청·완료 알림)
-- 참조: docs/04-workflow.md Flow-SYS-07, docs/05-erd.md §4-6, §4-11
-- 작성: backend-db
--
-- 배경: 확인 대상 기록의 confirmer 배정/확인 완료 시 notifications INSERT 가
--   코드베이스 어디에도 없었다. IEP/ISP/치료계획서 등 여러 서버 액션이 모두 records 에
--   INSERT 하므로, 각 진입점을 고치는 대신 records 의 AFTER 트리거 2개로 일괄 구현한다.
--   (기존 확인 트리거 3종: trg_assign_confirmer / trg_confirmation_owner /
--    trg_reset_confirmation_on_edit 는 20260709040253_p0_4_rls_policies 참조.)
--
-- ⚠️ 반려/거부 개념 없음 — "확인"만 존재한다. status 는 'requested'/'confirmed' 2종.
--
-- 실행 순서: 이 두 트리거는 AFTER 이므로 BEFORE 트리거 3종(assign/owner/reset)이
--   confirmer_id·confirmed_at 를 확정한 "이후"의 최종값을 읽는다. AFTER 그룹 내에서도
--   알파벳 뒤로 밀기 위해 trg_zz_ 접두사를 쓴다(요청·완료는 confirmed_at 상태가
--   상호배타적이라 서로 동시에 발화하지 않는다).
--
-- notifications 는 RLS WITH CHECK(true) + 안전 컬럼(recipient_id,type,title,body,data)
--   INSERT GRANT(20260713000000_p2_handover_notifications_rls)로 열려 있어, 트리거를
--   호출자(authenticated) 권한 그대로 실행해도 정상 삽입된다 → SECURITY DEFINER 불필요.

-- =========================================================================
-- ① 확인 요청 알림 — confirmer 에게 발송
-- =========================================================================
-- INSERT: 확인 대상(requires_confirmation)이면서 confirmer 가 배정된 신규 기록 → 항상.
-- UPDATE: confirmer 가 새로 배정(draft→확정: NULL→값)됐거나, 확정 기록의 재확인 초기화
--         (OLD.confirmed_at 존재 → NEW.confirmed_at NULL, reset_confirmation_on_edit)로
--         다시 확인 대기가 된 경우에만 발화. 그 외 무관한 UPDATE 는 중복 알림 방지 위해 스킵.
CREATE OR REPLACE FUNCTION notify_confirmation_request()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.confirmer_id IS NOT DISTINCT FROM OLD.confirmer_id
       AND NOT (OLD.confirmed_at IS NOT NULL AND NEW.confirmed_at IS NULL) THEN
      RETURN NULL;  -- 무관한 UPDATE: 요청 알림 재발송 방지
    END IF;
  END IF;

  INSERT INTO notifications(recipient_id, type, title, body, data)
  VALUES (
    NEW.confirmer_id,
    'record_confirm',
    '기록 확인 요청',
    '확인이 필요한 기록이 있습니다.',
    jsonb_build_object('record_id', NEW.id, 'status', 'requested')
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_zz_notify_confirmation_request
AFTER INSERT OR UPDATE ON records
FOR EACH ROW
WHEN (NEW.requires_confirmation = true
      AND NEW.confirmed_at IS NULL
      AND NEW.confirmer_id IS NOT NULL)
EXECUTE FUNCTION notify_confirmation_request();

-- =========================================================================
-- ② 확인 완료 알림 — 작성자(author)에게 발송
-- =========================================================================
-- confirmed_at 이 NULL → 값으로 바뀌는 순간(=confirmer 가 확인 완료)만 발화.
CREATE OR REPLACE FUNCTION notify_confirmation_done()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO notifications(recipient_id, type, title, body, data)
  VALUES (
    NEW.author_id,
    'record_confirm',
    '기록 확인 완료',
    '요청하신 기록이 확인되었습니다.',
    jsonb_build_object('record_id', NEW.id, 'status', 'confirmed')
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_zz_notify_confirmation_done
AFTER UPDATE ON records
FOR EACH ROW
WHEN (NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
      AND NEW.confirmed_at IS NOT NULL)
EXECUTE FUNCTION notify_confirmation_done();
