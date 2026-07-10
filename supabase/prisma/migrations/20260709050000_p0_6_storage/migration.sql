-- P0-6: Storage 버킷(records-attachments) + storage.objects RLS + record_attachments RLS
-- 참조: docs/04-workflow.md Flow-SYS-04, docs/05-erd.md §4-2 / §2-7 / §6
--
-- 설계 판단:
-- 1. 경로 규칙 `records-attachments/{person_id}/{record_id}/{filename}` 을 storage.objects RLS로 강제한다.
--    storage.foldername(name) 은 파일명을 제외한 폴더 세그먼트 text[] 를 돌려주므로
--    [1]=person_id, [2]=record_id 로 파싱한다. 정확히 2개 세그먼트가 아니거나 uuid 캐스팅이
--    실패하면 접근을 거부한다(잘못된 경로 차단).
-- 2. records/permissions/guardians 를 참조하는 접근 판정을 SECURITY DEFINER 헬퍼 함수로 캡슐화한다.
--    이유: (a) storage.objects 정책 안에서 public 테이블의 RLS 중첩 평가로 인한 미묘한 가시성 문제를
--    피하고 결정적으로 동작시키기 위함, (b) records(§4-2)의 read/write 판정 로직을 한 곳에 모아
--    record_attachments 테이블 RLS 와 storage RLS 가 동일 기준을 공유하게 하기 위함.
--    함수는 auth.uid() 를 인자로 명시적으로 받아 호출자 신원을 고정한다.
-- 3. read 판정(can_read_record) = records_select(§4-2): 당사자 본인 / 유효 도메인 권한(read|write|edit) / 보호자.
--    write 판정(can_write_record) = records_insert(§4-2): 유효 도메인 권한(write|edit) / 보호자.

-- =========================================================================
-- 1. records-attachments 버킷 생성 (비공개, 50MiB, 이미지/PDF 제한)
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'records-attachments',
  'records-attachments',
  false,                                  -- 비공개: presigned URL 로만 접근
  52428800,                               -- 50 MiB (문서 file_size_limit="50MiB")
  ARRAY['image/png','image/jpeg','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =========================================================================
-- 2. 접근 판정 헬퍼 함수 (SECURITY DEFINER — RLS 우회, uid 명시 전달)
-- =========================================================================

-- records_select(§4-2) 와 동일: 당사자 본인 / 유효 도메인 read·write·edit 권한 / 보호자
CREATE OR REPLACE FUNCTION public.can_read_record(p_record_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM records r
    WHERE r.id = p_record_id
      AND (
        ((SELECT role FROM users WHERE id = p_uid) = 'person' AND p_uid = r.person_id)
        OR EXISTS (
          SELECT 1 FROM permissions pm
          WHERE pm.person_id = r.person_id
            AND pm.grantee_id = p_uid
            AND pm.domain = r.domain
            AND pm.access_level IN ('read','write','edit')
            AND pm.is_active = true
            AND (pm.valid_until IS NULL OR pm.valid_until >= CURRENT_DATE)
        )
        OR EXISTS (
          SELECT 1 FROM guardians g
          WHERE g.person_id = r.person_id AND g.user_id = p_uid
        )
      )
  );
$$;

-- records_insert(§4-2) 와 동일: 유효 도메인 write·edit 권한 / 보호자
CREATE OR REPLACE FUNCTION public.can_write_record(p_record_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM records r
    WHERE r.id = p_record_id
      AND (
        EXISTS (
          SELECT 1 FROM permissions pm
          WHERE pm.person_id = r.person_id
            AND pm.grantee_id = p_uid
            AND pm.domain = r.domain
            AND pm.access_level IN ('write','edit')
            AND pm.is_active = true
            AND (pm.valid_until IS NULL OR pm.valid_until >= CURRENT_DATE)
        )
        OR EXISTS (
          SELECT 1 FROM guardians g
          WHERE g.person_id = r.person_id AND g.user_id = p_uid
        )
      )
  );
$$;

-- record 가 실제로 해당 person 에 속하는지 (경로의 person_id/record_id 정합성 검증)
CREATE OR REPLACE FUNCTION public.record_belongs_to_person(p_record_id uuid, p_person_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM records WHERE id = p_record_id AND person_id = p_person_id
  );
$$;

-- storage 경로 파싱 + 정합성 + read/write 권한 종합 판정
CREATE OR REPLACE FUNCTION public.attachment_path_authorized(p_name text, p_uid uuid, p_write boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  parts    text[];
  v_person uuid;
  v_record uuid;
BEGIN
  IF p_uid IS NULL THEN
    RETURN false;
  END IF;

  parts := storage.foldername(p_name);           -- {person_id, record_id}
  IF parts IS NULL OR array_length(parts, 1) <> 2 THEN
    RETURN false;                                 -- 정확히 2뎁스 폴더가 아니면 거부
  END IF;

  BEGIN
    v_person := parts[1]::uuid;
    v_record := parts[2]::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;                                 -- uuid 아닌 세그먼트 → 거부
  END;

  IF NOT public.record_belongs_to_person(v_record, v_person) THEN
    RETURN false;                                 -- person_id/record_id 조합 불일치 → 거부
  END IF;

  IF p_write THEN
    RETURN public.can_write_record(v_record, p_uid);
  ELSE
    RETURN public.can_read_record(v_record, p_uid);
  END IF;
END;
$$;

-- =========================================================================
-- 3. storage.objects RLS (records-attachments 버킷 한정)
-- =========================================================================
-- storage.objects 는 Supabase 부트스트랩 시 이미 RLS ENABLE + authenticated GRANT 상태다.

CREATE POLICY records_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'records-attachments'
    AND public.attachment_path_authorized(name, auth.uid(), false)
  );

CREATE POLICY records_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'records-attachments'
    AND public.attachment_path_authorized(name, auth.uid(), true)
  );

CREATE POLICY records_attachments_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'records-attachments'
    AND public.attachment_path_authorized(name, auth.uid(), true)
  )
  WITH CHECK (
    bucket_id = 'records-attachments'
    AND public.attachment_path_authorized(name, auth.uid(), true)
  );

CREATE POLICY records_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'records-attachments'
    AND public.attachment_path_authorized(name, auth.uid(), true)
  );

-- =========================================================================
-- 4. record_attachments 테이블 RLS (§2-7 — 지금까지 정책 없었음)
-- =========================================================================
-- authenticated 는 P0-4 rls_grants 에서 이미 SELECT/INSERT/UPDATE/DELETE GRANT 보유.

ALTER TABLE record_attachments ENABLE ROW LEVEL SECURITY;

-- record 를 읽을 수 있는 사람만 첨부 메타데이터 SELECT
CREATE POLICY record_attachments_select ON record_attachments
  FOR SELECT
  USING (public.can_read_record(record_id, auth.uid()));

-- record 에 write/edit 권한 보유자만 INSERT, 그리고 uploaded_by 는 본인이어야 함
CREATE POLICY record_attachments_insert ON record_attachments
  FOR INSERT
  WITH CHECK (
    public.can_write_record(record_id, auth.uid())
    AND uploaded_by = auth.uid()
  );

-- write/edit 권한 보유자만 DELETE (스토리지 객체 삭제와 정합)
CREATE POLICY record_attachments_delete ON record_attachments
  FOR DELETE
  USING (public.can_write_record(record_id, auth.uid()));
