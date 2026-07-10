-- P0-5: auth.users → public.users 동기화 트리거 + public.users RLS
-- 참조: docs/01-prd.md F-AUTH-01/03/04, docs/05-erd.md §2-1
--
-- 설계 판단:
-- 1. handle_new_user()는 SECURITY DEFINER로 실행된다. auth.users에 대한 트리거는
--    supabase_auth_admin 컨텍스트에서 발생하며, public.users에 쓰기 위해서는
--    함수 소유자(postgres) 권한으로 실행되어야 하기 때문이다.
-- 2. role은 NOT NULL 컬럼이고 이 플랫폼에서 무의미한 기본값(person? guardian?)을
--    임의로 넣는 것은 위험하므로, role이 없거나 UserRole enum에 속하지 않으면
--    public.users row 생성을 건너뛰고 WARNING만 남긴다. 즉 auth.users 자체의
--    가입은 절대 실패시키지 않는다("실패하지 않고 합리적으로 처리"). 정상 경로에서는
--    회원가입 Server Action(signup)이 항상 options.data.role을 채우므로 이 분기는
--    실제로는 방어적 안전장치일 뿐이다.
-- 3. ON CONFLICT (id) DO NOTHING으로 트리거 재실행/중복 INSERT에 안전하게 만든다.
-- 4. public.users에는 지금까지 RLS가 없었다(§4 정책 목록에 없었음). authenticated
--    role은 이미 GRANT SELECT/INSERT/UPDATE/DELETE를 보유하고 있어(P0-4 rls_grants),
--    RLS 없이는 모든 로그인 사용자가 모든 사용자 행을 읽고 쓸 수 있는 상태였다.
--    이번 마이그레이션에서 "본인 행만 SELECT" 정책만 추가한다(요청 범위 최소화).
--    INSERT/UPDATE/DELETE 정책은 의도적으로 추가하지 않는다 — 프로필 갱신 API는
--    후속 단계(P1)에서 role 등 민감 컬럼 보호를 설계한 뒤 추가한다. SECURITY DEFINER
--    트리거는 RLS를 우회하므로 신규 가입 흐름은 이 제한과 무관하게 동작한다.

-- =========================================================================
-- 1. auth.users → public.users 동기화 트리거
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public."UserRole";
  v_full_name text;
BEGIN
  BEGIN
    v_role := (NEW.raw_user_meta_data->>'role')::public."UserRole";
  EXCEPTION WHEN invalid_text_representation THEN
    v_role := NULL;
  END;

  IF v_role IS NULL THEN
    RAISE WARNING 'handle_new_user: auth user % has missing/invalid role metadata (%) — skipping public.users row; signup flow should always supply a valid role',
      NEW.id, NEW.raw_user_meta_data->>'role';
    RETURN NEW;
  END IF;

  v_full_name := NULLIF(NEW.raw_user_meta_data->>'full_name', '');
  IF v_full_name IS NULL THEN
    v_full_name := split_part(COALESCE(NEW.email, ''), '@', 1);
  END IF;
  IF v_full_name IS NULL OR v_full_name = '' THEN
    v_full_name := 'Unknown';
  END IF;

  INSERT INTO public.users (id, email, role, full_name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, v_role, v_full_name, now(), now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 2. public.users RLS — 본인 행만 SELECT
-- =========================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users FOR SELECT
  USING (auth.uid() = id);
