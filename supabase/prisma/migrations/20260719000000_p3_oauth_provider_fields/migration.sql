-- P3: F-AUTH-02 카카오/네이버 OAuth — users 스키마 변경(docs/05-erd.md §2-1, docs/01-prd.md §5-1-1).
-- Wave M-5(docs/11-livinglab-mega-workshop.md) — 설계 확정(2026-07-15) 후 4일 방치되던 실제
-- 구현 착수. 이 마이그레이션은 스키마만 다루고, 콜백 Route Handler·UI는 별도 파일에서 구현한다.
--
-- 계정 동일성 신뢰 소스는 email이 아니라 (auth_provider, oauth_subject)다 — 소셜 이메일이
-- 기존 이메일 계정과 일치해도 자동 연결(account linking)하지 않는다(탈취 방지).

CREATE TYPE "AuthProvider" AS ENUM ('email', 'kakao', 'naver');

ALTER TABLE public.users
  ADD COLUMN auth_provider "AuthProvider" NOT NULL DEFAULT 'email',
  ADD COLUMN oauth_subject text,
  ADD COLUMN email_verified boolean NOT NULL DEFAULT true;

-- PostgreSQL UNIQUE는 NULL을 서로 다른 값으로 취급하므로 auth_provider='email'
-- (oauth_subject IS NULL) 다중 행은 이 제약에 걸리지 않는다.
ALTER TABLE public.users
  ADD CONSTRAINT users_provider_subject_unique UNIQUE (auth_provider, oauth_subject);

-- 로그인 시 (auth_provider, oauth_subject) 정확 일치 조회용 부분 인덱스.
CREATE INDEX idx_users_oauth ON public.users (auth_provider, oauth_subject)
  WHERE oauth_subject IS NOT NULL;

-- 컬럼 단위 GRANT 원칙(2026-07-18 users 권한 상승 핫픽스에서 확립된 관행) 재확인 —
-- authenticated는 이 3개 컬럼에 대해 어떤 GRANT도 받지 않는다(테이블 단위 UPDATE는 이미
-- REVOKE된 상태이고, 본인 갱신 허용 컬럼은 deactivated_at 하나뿐이었다 — p3_users_column_grant_hotfix
-- 참고). auth_provider/oauth_subject/email_verified는 서버(service_role) 전용 콜백 경로에서만
-- 쓰이므로 authenticated에 열어줄 이유가 없다. 명시적으로 아무 GRANT도 추가하지 않는다.
