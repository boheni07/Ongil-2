-- =============================================================================
-- 17_meta_all_tables_rls_enabled.sql — 메타 회귀: public 스키마 모든 테이블 RLS 강제
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/1[0-9]_*.sql
-- 근거: docs/01-prd.md NF-SEC-01("모든 테이블에 행 수준 보안 정책 강제")
-- 작성: security-rls
--
-- ▶ 목적: 이 프로젝트는 "테이블 생성 시 ENABLE ROW LEVEL SECURITY 누락 + authenticated 전권 GRANT"
--   결함이 6회 반복됐다(guardians·consents·permission_logs·handover_notes·notifications·
--   notification_preferences/permission_presets). 개별 테이블 테스트만으로는 "새로 추가된 테이블"의
--   동일 결함을 사전에 못 잡는다. 이 메타 단정은 pg_class.relrowsecurity 를 순회하여 public 스키마의
--   모든 실테이블이 RLS on 인지 검사한다 → 신규 테이블이 RLS 없이 들어오면 즉시 실패한다.
--
--   ✔ 회고 검증: 과거 6개 결함 각각의 핫픽스 직전 상태(relrowsecurity=false)였다면 아래 is_empty 가
--     해당 테이블명을 출력하며 실패했을 것 — 즉 이 테스트가 있었으면 6건 모두 조기 발견됐다.
--
-- ▶ 제외 대상: `_prisma_migrations`(Prisma 마이그레이션 관리 테이블 — anon/authenticated 에 GRANT 가
--   없어 클라이언트에 노출되지 않는 내부 도구 테이블). 그 외 `_` 접두 내부 테이블도 동일 사유로 제외.
-- =============================================================================
BEGIN;
SELECT plan(1);

SELECT is_empty(
  $$
    SELECT n.nspname || '.' || c.relname AS table_without_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'              -- 일반 테이블만(뷰/시퀀스/파티션 부모 등 제외)
      AND c.relname NOT LIKE '\_%'     -- _prisma_migrations 등 내부 도구 테이블 제외
      AND c.relrowsecurity = false     -- RLS 미활성 = 결함
    ORDER BY 1
  $$,
  'public 스키마의 모든 (노출) 테이블은 RLS 활성 상태여야 한다 (NF-SEC-01)'
);

SELECT * FROM finish();
ROLLBACK;
