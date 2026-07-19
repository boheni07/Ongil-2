-- P3: F-AUTH-02 — handle_new_user()가 OAuth 메타데이터(auth_provider/oauth_subject/
-- email_verified)를 public.users로 함께 복사하도록 갱신한다. 기존 이메일 가입 경로는
-- 이 메타데이터 키들을 아예 넘기지 않으므로 COALESCE 기본값(email/NULL/true)으로
-- 기존 동작을 그대로 유지한다 — 회귀 없음.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public."UserRole";
  v_full_name text;
  v_auth_provider public."AuthProvider";
  v_oauth_subject text;
  v_email_verified boolean;
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

  BEGIN
    v_auth_provider := COALESCE((NEW.raw_user_meta_data->>'auth_provider')::public."AuthProvider", 'email');
  EXCEPTION WHEN invalid_text_representation THEN
    v_auth_provider := 'email';
  END;
  v_oauth_subject := NULLIF(NEW.raw_user_meta_data->>'oauth_subject', '');
  v_email_verified := COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, true);

  INSERT INTO public.users
    (id, email, role, full_name, auth_provider, oauth_subject, email_verified, created_at, updated_at)
  VALUES
    (NEW.id, NEW.email, v_role, v_full_name, v_auth_provider, v_oauth_subject, v_email_verified, now(), now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
