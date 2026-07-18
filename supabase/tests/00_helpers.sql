-- =============================================================================
-- 00_helpers.sql — pgTAP 확장 + 테스트 헬퍼 (온길 RLS 회귀 스위트 부트스트랩)
-- 참조: docs/05-erd.md §4 / 실제 마이그레이션 supabase/prisma/migrations/*
-- =============================================================================
--
-- ▶ 이 파일은 "테스트 전용 setup 스크립트"다(pgTAP 테스트 파일이 아님).
--   01~08 테스트 파일보다 "먼저, 그리고 커밋되도록" 1회 실행해야 한다.
--   (헬퍼 함수/스키마가 트랜잭션 롤백에 사라지지 않고 이후 테스트 파일들에서
--    보이도록 하기 위함. 각 테스트 파일은 BEGIN…ROLLBACK 으로 격리된다.)
--
-- ▶ 실행 방법 (이 리포는 스키마를 Prisma 로 관리한다 — `supabase/migrations/` 가 아니라
--   `supabase/prisma/migrations/` 를 쓰므로 `supabase db reset` 만으로는 스키마가 서지 않는다):
--
--     # 1) 로컬 DB 기동 + Prisma 스키마 적용
--     supabase start
--     cd supabase/prisma && npx prisma migrate deploy && cd ../..
--
--     # 2) pgTAP + 헬퍼 설치 (이 파일 — 1회, 커밋 유지)
--     psql "$DATABASE_URL" -f supabase/tests/00_helpers.sql
--
--     # 3) RLS 테스트 실행 (01~08 만; 00 은 setup 이므로 제외)
--     pg_prove -d "$DATABASE_URL" supabase/tests/0[1-8]_*.sql
--
--   ($DATABASE_URL 예: postgresql://postgres:postgres@127.0.0.1:54322/postgres)
--
--   대안: 헬퍼가 이미 설치돼 있으면 `supabase test db` 도 01~08 을 실행할 수 있으나,
--   그 명령은 Prisma 마이그레이션을 적용하지 않으므로 위 (1)(2) 선행이 필요하다.
--
-- ▶ 임퍼소네이션 원리:
--   pgTAP 테스트는 postgres(슈퍼유저·BYPASSRLS)로 실행되어 기본적으로 RLS 를 우회한다.
--   실제 RLS 를 발동시키려면 (a) request.jwt.claims 를 대상 사용자 sub 로 설정하고
--   (b) `SET LOCAL ROLE authenticated` 로 역할을 낮춰야 한다. tests.login(uuid) 이 둘 다 한다.
--   시딩(INSERT)은 postgres 역할일 때 수행해야 RLS 우회로 원하는 픽스처를 만들 수 있다.
--   테스트 중 사용자를 바꾸려면: `RESET ROLE;`(→ 세션유저 postgres 복귀) 후 tests.login(다음uuid).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

CREATE SCHEMA IF NOT EXISTS tests;

-- ── 사용자로 가장(로그인) ────────────────────────────────────────────────────
-- postgres 역할일 때만 호출한다(REVOKE 로 authenticated 는 실행 불가 → prod 임퍼소네이션 차단).
-- auth.uid() 의 두 구현(request.jwt.claims->>'sub' / request.jwt.claim.sub)을 모두 채운다.
CREATE OR REPLACE FUNCTION tests.login(p_uid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
                     true);
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  SET LOCAL ROLE authenticated;
END;
$$;

-- ── 시딩 헬퍼(모두 postgres 역할에서 호출) ───────────────────────────────────
CREATE OR REPLACE FUNCTION tests.mk_user(p_id uuid, p_role text, p_email text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  -- email 은 users.email UNIQUE 제약이 걸려 있다. 과거 left(p_id::text,8) 로 앞 8자만 잘라 썼는데,
  -- 이 스위트의 픽스처 UUID들은 관례상 앞부분을 의도적으로 공유한다(예: 'bbbbbbbb-...-b1'과
  -- 'bbbbbbbb-...-b2'는 첫 8자가 둘 다 'bbbbbbbb') — 그래서 서로 다른 두 사용자를 만들 때
  -- unique violation 이 나 테스트 파일이 중간에 죽는 결함이 있었다(2026-07-18, CTO팀 갭분석 발견).
  -- p_id 전체는 애초에 PK 로 유일하므로 그대로 이메일 로컬파트에 써서 충돌을 원천 차단한다.
  INSERT INTO public.users(id, email, role, full_name, updated_at)
  VALUES (p_id,
          COALESCE(p_email, p_id::text || '@test.dev'),
          p_role::public."UserRole",
          'T-' || left(p_id::text,8),
          now())
  ON CONFLICT (id) DO NOTHING;
  RETURN p_id;
END;
$$;

-- 당사자(person) 레코드 생성. 성년/미성년은 birth_date 로 결정된다(get_life_stage).
CREATE OR REPLACE FUNCTION tests.mk_person(p_id uuid, p_guardian uuid, p_birth date)
RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.persons(id, primary_guardian_id, full_name, birth_date, updated_at)
  VALUES (p_id, p_guardian, 'P-' || left(p_id::text,8), p_birth, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION tests.mk_guardian_link(p_user uuid, p_person uuid, p_primary boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.guardians(user_id, person_id, is_primary)
  VALUES (p_user, p_person, p_primary)
  ON CONFLICT (user_id, person_id) DO UPDATE SET is_primary = EXCLUDED.is_primary;
END;
$$;

CREATE OR REPLACE FUNCTION tests.mk_perm(
  p_person uuid, p_grantee uuid, p_domain text, p_level text,
  p_valid_until date DEFAULT NULL, p_active boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.permissions(person_id, grantee_id, domain, access_level, is_active, valid_until, updated_at)
  VALUES (p_person, p_grantee, p_domain::public."Domain", p_level::public."AccessLevel", p_active, p_valid_until, now())
  ON CONFLICT (person_id, grantee_id, domain)
    DO UPDATE SET access_level = EXCLUDED.access_level,
                  is_active    = EXCLUDED.is_active,
                  valid_until  = EXCLUDED.valid_until,
                  updated_at   = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION tests.mk_record(
  p_id uuid, p_person uuid, p_author uuid, p_domain text, p_type text,
  p_requires_confirm boolean DEFAULT false, p_is_draft boolean DEFAULT false,
  p_content jsonb DEFAULT '{"note":"seed"}')
RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.records(id, person_id, author_id, domain, record_type, content,
                             is_draft, requires_confirmation, updated_at)
  VALUES (p_id, p_person, p_author, p_domain::public."Domain", p_type, p_content,
          p_is_draft, p_requires_confirm, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN p_id;
END;
$$;

-- prod 임퍼소네이션 위험 차단: tests.* 함수는 오직 소유자(postgres)만 실행.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tests FROM PUBLIC;
REVOKE ALL ON SCHEMA tests FROM PUBLIC;

-- 설치 확인용 메시지
DO $$ BEGIN RAISE NOTICE 'pgTAP + tests.* 헬퍼 설치 완료'; END $$;
