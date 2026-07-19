-- P3: person-avatars 공개 버킷 + storage.objects RLS
-- 당사자 등록(G-01) 프로필 사진 업로드용. persons.avatar_url이 PersonSlider.tsx에서
-- <img src>로 직접 렌더되므로(presigned URL이 아님) 공개 버킷으로 만들어 안정된
-- 공개 URL을 그대로 저장한다.
--
-- 경로 규칙: {업로더 user_id}/{timestamp}-{filename}. 당사자 등록 시점엔 아직 persons
-- 행이 없어 person_id로 스코프할 수 없으므로, 업로드 주체(보호자) 자신의 폴더로 제한한다.
-- public=true 버킷의 GET은 /object/public/ 경로로 RLS 없이 서빙되지만(공개 URL 렌더용),
-- SDK 기반 list()/download() 등 인증 경로도 동일 정책으로 커버해 둔다.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'person-avatars',
  'person-avatars',
  true,
  5242880, -- 5 MiB
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY person_avatars_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'person-avatars');

CREATE POLICY person_avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'person-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY person_avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'person-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'person-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY person_avatars_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'person-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
