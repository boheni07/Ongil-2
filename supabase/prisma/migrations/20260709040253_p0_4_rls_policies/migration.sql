-- P0-4: RLS 정책 + 권한 관리 라이프사이클 + 기록 확인(Confirmation) 절차
-- 참조: docs/05-erd.md §4

-- =========================================================================
-- §4-1. persons 테이블
-- =========================================================================

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

-- 당사자 본인 또는 보호자만 SELECT
CREATE POLICY persons_select ON persons FOR SELECT
  USING (
    auth.uid() = primary_guardian_id
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = persons.id AND user_id = auth.uid()
    )
    OR (
      SELECT role FROM users WHERE id = auth.uid()
    ) = 'person'
    AND auth.uid()::text = id::text  -- 당사자는 자신의 레코드만
  );

-- 보호자만 INSERT
CREATE POLICY persons_insert ON persons FOR INSERT
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'guardian'
  );

-- =========================================================================
-- §4-2. records 테이블
-- =========================================================================

ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- 권한 있는 사용자만 SELECT
CREATE POLICY records_select ON records FOR SELECT
  USING (
    -- 당사자 본인
    (SELECT role FROM users WHERE id = auth.uid()) = 'person'
    AND auth.uid()::text = (SELECT id::text FROM persons WHERE id = records.person_id LIMIT 1)
    -- 또는 유효한 도메인 권한 보유
    OR EXISTS (
      SELECT 1 FROM permissions
      WHERE person_id = records.person_id
        AND grantee_id = auth.uid()
        AND domain = records.domain
        AND access_level IN ('read','write','edit')
        AND is_active = true
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    )
    -- 또는 보호자
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = records.person_id AND user_id = auth.uid()
    )
  );

-- 도메인 write/edit 권한 보유 시 INSERT
CREATE POLICY records_insert ON records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE person_id = records.person_id
        AND grantee_id = auth.uid()
        AND domain = records.domain
        AND access_level IN ('write','edit')
        AND is_active = true
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    )
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = records.person_id AND user_id = auth.uid()
    )
  );

-- 도메인 edit 권한 보유 시에만 UPDATE (write는 신규 작성까지, 기존 기록 수정은 edit부터)
CREATE POLICY records_update ON records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE person_id = records.person_id
        AND grantee_id = auth.uid()
        AND domain = records.domain
        AND access_level = 'edit'
        AND is_active = true
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    )
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = records.person_id AND user_id = auth.uid()
    )
  );

-- =========================================================================
-- §4-3. permissions 테이블
-- =========================================================================

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- 주보호자만 INSERT/UPDATE/DELETE
CREATE POLICY permissions_write ON permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = permissions.person_id
        AND user_id = auth.uid()
        AND is_primary = true
    )
  );

-- 본인 또는 보호자는 SELECT 가능
CREATE POLICY permissions_select ON permissions FOR SELECT
  USING (
    grantee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = permissions.person_id AND user_id = auth.uid()
    )
  );

-- =========================================================================
-- §4-4. permission_logs, access_logs (불변 감사 로그)
-- =========================================================================

-- INSERT ONLY (시스템 레벨에서만 트리거)
CREATE POLICY perm_logs_insert ON permission_logs FOR INSERT WITH CHECK (true);
ALTER TABLE permission_logs DISABLE ROW LEVEL SECURITY;  -- 시스템 서비스 역할에서만 접근

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY access_logs_insert ON access_logs FOR INSERT WITH CHECK (true);
-- SELECT는 주보호자만 허용
CREATE POLICY access_logs_select ON access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = access_logs.person_id
        AND user_id = auth.uid()
        AND is_primary = true
    )
  );

-- =========================================================================
-- §4-5. 권한 관리 라이프사이클
-- =========================================================================

-- ① permission_presets 시드 (테이블은 P0-3에서 이미 생성됨)
INSERT INTO permission_presets VALUES
  ('supporter','MED','read',180), ('supporter','DAI','write',180),
  ('teacher','EDU','edit',365), ('teacher','DAI','read',365), ('teacher','TRA','write',365),
  ('social_worker','MED','read',365), ('social_worker','WEL','edit',365),
  ('social_worker','TRA','write',365), ('social_worker','LEG','read',365),
  ('therapist','MED','edit',180), ('therapist','DAI','read',180);

-- ② 부여/수정/회수 시 permission_logs 자동 기록 — 트리거화
CREATE OR REPLACE FUNCTION log_permission_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO permission_logs(permission_id, action, actor_id, before_state, after_state)
    VALUES (NEW.id, 'grant', auth.uid(), NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO permission_logs(permission_id, action, actor_id, before_state, after_state)
    VALUES (NEW.id,
      CASE WHEN NEW.is_active = false AND OLD.is_active = true THEN 'revoke' ELSE 'update' END,
      auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_permission_audit
AFTER INSERT OR UPDATE ON permissions
FOR EACH ROW EXECUTE FUNCTION log_permission_change();

-- =========================================================================
-- §4-6. 기록 확인(Confirmation) 절차
-- =========================================================================

-- ② 확인 주체 자동 지정 — 트리거
CREATE OR REPLACE FUNCTION assign_record_confirmer()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_stage text; v_guardian uuid;
BEGIN
  IF NEW.requires_confirmation = true AND NEW.is_draft = false
     AND (OLD IS NULL OR OLD.is_draft = true) THEN
    SELECT get_life_stage(birth_date) INTO v_stage FROM persons WHERE id = NEW.person_id;
    IF v_stage = 'adult' THEN
      NEW.confirmer_id := NEW.person_id;   -- 본인 확인 (persons.id = 당사자 auth.uid())
    ELSE
      SELECT primary_guardian_id INTO v_guardian FROM persons WHERE id = NEW.person_id;
      NEW.confirmer_id := v_guardian;
    END IF;
    NEW.confirmed_at := NULL;
    -- notifications INSERT(type:'record_confirm', data:{record_id, status:'requested'})는
    -- 별도 AFTER 트리거 또는 Edge Function에서 처리 (Flow-SYS-03 재사용)
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_confirmer
BEFORE INSERT OR UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION assign_record_confirmer();

-- ③ 확인 처리 — confirmer 본인만 confirmed_at 설정 가능
CREATE OR REPLACE FUNCTION enforce_confirmation_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
    IF auth.uid() <> OLD.confirmer_id THEN
      RAISE EXCEPTION '확인 권한이 없습니다 (confirmer_id 불일치)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_confirmation_owner
BEFORE UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION enforce_confirmation_owner();

-- ④ 재확인 트리거 — 확인된 기록을 수정하면 확인 대기 상태로 되돌림
-- 주의: trg_confirmation_owner(③)보다 먼저 평가되어야 하므로, Postgres 트리거 실행 순서
-- (알파벳순)상 trg_confirmation_owner -> trg_reset_confirmation_on_edit 순으로 실행됨에 유의.
CREATE OR REPLACE FUNCTION reset_confirmation_on_edit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.requires_confirmation = true
     AND OLD.confirmed_at IS NOT NULL
     AND NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.confirmed_at := NULL;
    -- confirmer_id는 유지 (동일 확인 주체에게 재확인 요청)
    -- notifications INSERT(type:'record_confirm', data:{record_id, status:'requested'})는
    -- Edge Function에서 처리 (Flow-SYS-03 재사용)
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reset_confirmation_on_edit
BEFORE UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION reset_confirmation_on_edit();
