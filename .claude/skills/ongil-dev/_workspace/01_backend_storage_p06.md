# P0-6 — Storage 버킷 + 첨부파일 업로드/다운로드 (backend-db)

상태: **완료** · 검증 17/17 PASS · typecheck/lint/build 통과

## 만든/수정한 파일

| 경로 | 내용 |
|------|------|
| `supabase/prisma/migrations/20260709050000_p0_6_storage/migration.sql` | 버킷 생성 + storage.objects RLS + record_attachments RLS + 접근 판정 헬퍼 함수 |
| `apps/web/src/lib/reauth.ts` | MED/LEG step-up 재인증 토큰(HMAC, 5분 TTL) 발급/검증 |
| `apps/web/src/lib/supabase/from-request.ts` | 쿠키 세션 또는 Bearer 토큰 기반 요청 스코프 Supabase 클라이언트 |
| `apps/web/src/app/api/attachments/reauth/route.ts` | 비밀번호 재검증 → 재인증 토큰(쿠키 + JSON) 발급 |
| `apps/web/src/app/api/attachments/url/route.ts` | presigned URL 발급(1시간) + MED/LEG 재인증 게이트 |
| `apps/web/src/app/(app)/attachments/actions.ts` | 업로드 Server Action(검증 → Storage 업로드 → record_attachments INSERT, 실패 시 롤백) |
| `apps/web/src/app/(app)/attachments/page.tsx` | 최소 테스트 UI(업로드 / URL 발급 / 재인증) |
| `apps/web/src/lib/supabase/proxy.ts` | APP_PREFIXES 에 `/attachments` 추가(라우트 가드) |
| `apps/web/.env.local` | `SUPABASE_JWT_SECRET` 추가(재인증 토큰 서명) |

## 버킷/RLS 설계 판단

- **버킷**: `records-attachments`, `public=false`(presigned 전용), `file_size_limit=52428800`(50MiB), `allowed_mime_types=[image/png, image/jpeg, image/webp, application/pdf]`.
- **경로 강제**: `{person_id}/{record_id}/{filename}`. `storage.foldername(name)` 로 파싱해 세그먼트가 정확히 2개가 아니거나 uuid 캐스팅 실패 시 거부.
- **판정 로직 캡슐화**: `can_read_record`/`can_write_record`/`record_belongs_to_person`/`attachment_path_authorized` 를 **SECURITY DEFINER** 헬퍼로 작성. 이유 (1) storage.objects 정책 내에서 public 테이블 RLS 중첩 평가로 인한 가시성 문제 회피, (2) records(§4-2) read/write 기준을 한 곳에 모아 storage RLS 와 record_attachments RLS 가 동일 기준 공유.
  - read = records_select(§4-2): 당사자 본인 / 유효 도메인 read·write·edit 권한 / 보호자
  - write = records_insert(§4-2): 유효 도메인 write·edit 권한 / 보호자
- **record_belongs_to_person** 로 경로의 person_id–record_id 정합성까지 강제 → 타 당사자 경로에 끼워넣기 차단.
- **record_attachments RLS**(신설): SELECT = can_read_record, INSERT = can_write_record AND `uploaded_by = auth.uid()`, DELETE = can_write_record.

## 재인증(step-up) 방식 선택 이유

로컬 스택은 MFA(TOTP)가 비활성(config.toml `auth.mfa.totp` enroll/verify=false). 풀 MFA 구축은 이번 범위 과함. → **비밀번호 재입력 기반 stateless 토큰** 채택.

- `/api/attachments/reauth` 가 일회성 클라이언트(`persistSession:false`)로 비밀번호만 재검증(메인 세션 불간섭). 성공 시 `HMAC(userId:exp)` 서명 토큰(5분 TTL) 발급.
- 토큰은 httpOnly 쿠키(브라우저) + JSON `token`(스크립트/모바일) 이중 전달. `/api/attachments/url` 은 쿠키 또는 `x-reauth-token` 헤더에서 읽어 검증.
- userId 바인딩 + exp 만료로 재사용/교차사용 차단. 서버 상태 저장 불필요.
- **대안 검토**: Supabase MFA(TOTP) 활성화 → 온보딩 화면·enroll 흐름까지 필요해 P0 범위 초과로 보류(P1 정식 MFA 시 대체 가능).

## 방어선 계층

1. `record_attachments` SELECT RLS — 접근 불가면 행 자체 비가시(403)
2. 애플리케이션 레벨 도메인 판정 — MED/LEG 재인증 미충족 시 `{reauthRequired:true}` 403
3. `storage.objects` SELECT RLS — createSignedUrl 최종 통과 조건

## 검증 결과 (로컬 Supabase, 17/17 PASS)

seed: guardian(보호자)·therapist(MED edit 권한)·outsider(무권한) + person P/P2 + MED/DAI 기록. public 테이블 시드는 service_role GRANT 부재(Prisma 생성 테이블)로 postgres 슈퍼유저(`prisma db execute`)로 주입.

- (a) therapist→MED 업로드 성공, guardian→DAI 업로드 성공
- (b) outsider→MED 업로드 차단(RLS), outsider→MED signed URL 차단(Object not found)
- (c) therapist→DAI 경로 차단(write 없음), guardian→불일치 person/record 경로 차단
- record_attachments: therapist·guardian INSERT 성공 / outsider INSERT 차단 / outsider SELECT 0건 / therapist SELECT 1건
- (d) 재인증 없이 MED URL → 403 reauthRequired / 올바른 비밀번호 재인증 → 토큰 / 틀린 비밀번호 → 401 / 재인증 후 MED URL 3600s 발급
- (e) DAI URL 재인증 없이 즉시 발급 / outsider→MED URL 403

## 게이트

- `pnpm --filter @ongil/web typecheck` ✓
- `pnpm --filter @ongil/web lint` ✓
- `pnpm --filter @ongil/web build` ✓ (`/api/attachments/reauth`, `/api/attachments/url`, `/attachments` 라우트 생성 확인)

## 후속(범위 밖) 참고

- **service_role 테이블 GRANT 부재**: Prisma 생성 테이블이라 service_role 에 GRANT 가 없어 REST 로 관리 데이터 작업 불가(P0-4 가 authenticated 만 GRANT). Edge Function/cron/seed 가 REST service_role 로 public 테이블을 다루려면 별도 GRANT 마이그레이션 필요 — security-rls 와 조율 권장.
- 정식 MFA(TOTP) 온보딩, 썸네일/리사이징, 바이러스 스캔, 모바일 업로드 UI 는 이번 범위 제외(요청대로).
