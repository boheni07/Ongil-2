# 온길 플랫폼 — CLAUDE.md

## 하네스: 온길 플랫폼 개발

**목표:** 장애인 생애주기 기록 플랫폼 온길을 Next.js + React Native + Supabase로 구축

**트리거:** 온길 기능 구현, 화면 추가, API 작성, DB 수정, RLS 정책 등 개발 요청 시 `ongil-dev` 스킬을 사용하라. 단순 질문(문서 읽기, 설명)은 직접 응답 가능.

## 핵심 문서 (docs/)

| 문서 | 내용 |
|------|------|
| `docs/01-prd.md` | PRD — 기능 요구사항, 우선순위 |
| `docs/02-ia.md` | IA — 전체 화면 구조, 88+81 화면 인벤토리 |
| `docs/03-uiux.md` | UIUX — 디자인 시스템, 컴포넌트 사양 |
| `docs/04-workflow.md` | Workflow — 사용자·기능별 플로우 |
| `docs/05-erd.md` | ERD — 13개 테이블 스키마, RLS 정책 |
| `docs/06-wbs.md` | WBS — Phase 0~3 작업분해, 의존성, 에이전트별 AI 실행 프롬프트 |

## 에이전트 팀 (.claude/agents/)

| 에이전트 | 역할 |
|---------|------|
| `orchestrator` | 전체 개발 조율 |
| `frontend-dev` | Next.js 웹 화면 |
| `mobile-dev` | React Native 모바일 |
| `backend-db` | Supabase DB + API |
| `security-rls` | RLS 정책 + PIPA |
| `qa-verifier` | 갭 분석 + 검증 |

## 기술 스택 요약

- **웹:** Next.js App Router · TypeScript strict · Tailwind CSS · shadcn/ui
- **모바일:** React Native (Expo)
- **DB:** Supabase (PostgreSQL + RLS) · Prisma ORM
- **공통:** TanStack Query · React Hook Form + Zod · pnpm workspaces

## 구현 현황

**미착수** — `apps/`, `packages/`, `supabase/`, `package.json` 등 실제 코드베이스가 리포지토리에 아직 없다. 지금까지 완료된 것은 설계 문서(`docs/`)와 정적 프로토타입(`prototypes/`)뿐이다. 실행 계획은 `docs/06-wbs.md` Phase 0(P0-1~P0-7)부터 시작한다.

## 변경 이력

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-07-07 | 초기 하네스 구성 | 전체 | 온길 플랫폼 개발 시작 |
| 2026-07-09 | 생애주기 3단계(life_stage) 계산 로직·화면 배지 설계 | `01-prd.md` §3-1, `05-erd.md` §2-2-1, `02-ia.md` §3-9, `03-uiux.md` §6-6, `04-workflow.md` Flow-SYS-06 | 아동기/청소년 전환기/성년기별 기록·동의 주체 분기 필요 |
| 2026-07-09 | 권한 매트릭스 권장안 및 관리 라이프사이클(부여·수정·회수·감사) 정식화 | `01-prd.md` §3-2~3-3, `05-erd.md` §4-5 | 역할별 기본 프리셋·감사 절차 부재 |
| 2026-07-09 | 보호자 기록 직접 작성·수정 화면(G-21) 추가, `records_update` RLS 정책 신설 | `02-ia.md`, `01-prd.md` F-G-04, `05-erd.md` §4-2, 프로토타입 `web/app-guardian.html` | 프로토타입 점검 중 보호자가 기록을 작성할 수 없는 설계 누락 발견 |
| 2026-07-09 | 기록 확인(Confirmation) 절차 신설 — "승인"이 아닌 "확인" | `01-prd.md` §3-4, `05-erd.md` §4-6, `02-ia.md` §3-10, `03-uiux.md` §6-7, `04-workflow.md` Flow-SYS-07, 프로토타입 guardian/person | 공식 문서(IEP·ISP·치료계획서) 제출 시 보호자·당사자 인지 절차 필요 |
| 2026-07-09 | 설계문서 정합성 점검·보완 (FR 번호 재정렬, `notification_preferences`·재확인 트리거 정의, Prisma 관계 보완, `record_type` JSONB 스키마 5종 추가) | 전체 `docs/` | 반복 수정으로 누적된 문서 간 불일치(§ 번호 오류, dangling reference) 해소 |
| 2026-07-09 | WBS 신설(`06-wbs.md`) — Phase 0~3 32개 작업, 의존성, 에이전트별 AI 프롬프트 | `docs/06-wbs.md` 신규, `01-prd.md` §7 Phase 0 테이블 수 정정(15→13) | 실제 코드베이스가 전무한 상태에서 실행 계획·일정이 부재 |
| 2026-07-09 | "구현 현황" 섹션을 "Phase 0 완료" → "미착수"로 정정 | `CLAUDE.md`, `01-prd.md` §7 Phase 0 제목 | 하네스 재감사 중 WBS의 "코드베이스 전무" 전제와 CLAUDE.md의 "완료" 표기가 상충하는 것을 발견 |
| 2026-07-10 | P1-3/4/5 백엔드 구현 — 검증 스키마(`records.ts`·`persons.ts`) + Server Action(`home`/`journal`/`dashboard`). 셀프 가입 당사자 모델(`persons.id=primary_guardian_id=auth.uid()`) 채택 | `packages/validation`, `apps/web/src/app/(app)/{home,journal,dashboard}/actions.ts` (신규), `05-erd.md` §4-1/§4-2(설계 기확정) | 당사자 자기표현·활동지원 일지·보호자 대시보드/당사자 등록 구현. person 역할 자가등록 RLS 갭 해소 전제 |
| 2026-07-10 | `invitations` 테이블 신설(Flow-1 이해관계자 초대) + `accept_invitation()` SECURITY DEFINER 전개 함수 | `05-erd.md` §2-12~2-13, `supabase/prisma/schema.prisma`, 마이그레이션 `p0_7_invitations`(테이블) | Flow-1이 요구하나 스키마 누락. invitations/consents RLS·GRANT는 security-rls 마이그레이션(`p0_7_consents_invitations_rls`)이 신뢰 소스 — invitations는 authenticated 한정, anon 미리보기는 service-role 경로로 처리(anon SELECT 시 테이블 덤프 위험) |
| 2026-07-11 | P1-8 RLS pgTAP 스위트 신설(`supabase/tests/00~08`, §4 전체 정책 커버) 중 `permission_logs` RLS 완전 비활성 + authenticated 전체 GRANT 결함 발견·핫픽스 | `05-erd.md` §4-4, 마이그레이션 `p1_permission_logs_rls_hotfix` | consents·guardians와 동일 계열의 실사용 보안 결함 — 임의 로그인 사용자가 전 당사자의 권한 변경 감사 로그를 열람·수정·삭제 가능했음. RLS 활성화 + 주보호자 한정 SELECT + UPDATE/DELETE 정책·GRANT 회수로 봉쇄 |
| 2026-07-13 | S-20/S-21(인수인계) 구현 라운드 중 `handover_notes`·`notifications` RLS 완전 비활성 + authenticated 전체 GRANT 결함 발견·핫픽스 + pgTAP 09 신설(20 asserts) | `05-erd.md` §4-10/§4-11, 마이그레이션 `p2_handover_notifications_rls`, `supabase/tests/09_handover_notifications.sql` | consents·guardians·permission_logs와 동일 계열 결함 — 임의 로그인 사용자가 전 당사자의 인수인계 노트·알림을 열람·위조·삭제 가능했음. RLS 활성화 + 본인 한정 SELECT + INSERT 권한검증(handover: DAI write/보호자, from 위조 차단)·컬럼 단위 GRANT(handover.acknowledged_at, notif.is_read/read_at + insert 안전컬럼)·DELETE 전면 차단으로 봉쇄 |
| 2026-07-15 | qa-verifier 갭분석이 `notification_preferences`·`permission_presets` RLS 완전 비활성 + authenticated 전체 GRANT 결함 발견(**이 프로젝트 6번째 반복 동일 계열 결함**)·핫픽스 + pgTAP 16 신설(12 asserts) + **메타 회귀 테스트 pgTAP 17 신설**(전 테이블 RLS 강제, 1 assert)로 근본 원인 차단 | `05-erd.md` §4-13/§4-14/§4-메타, 마이그레이션 `p3_notif_prefs_presets_rls`, `supabase/tests/16_notification_preferences_permission_presets_rls.sql`·`17_meta_all_tables_rls_enabled.sql` | guardians·consents·permission_logs·handover_notes/notifications에 이은 6번째 동일 결함 — 임의 로그인 사용자가 타인 알림 채널 설정을 변조(보안 알림 무력화)하거나 위자드 참조 프리셋을 UPDATE(과다권한 주입)/DELETE(위자드 파손) 가능했음. notif_prefs는 RLS+본인 한정(user_id 컬럼 GRANT 제외로 소유권 이관 차단)·DELETE 차단, presets는 "읽기=인증 전체/쓰기=service_role" 패턴으로 봉쇄. `pg_class.relrowsecurity` 순회 메타 단정으로 신규 테이블의 7번째 재발을 근본 차단(과거 6건 모두 이 테스트가 있었으면 조기 발견됐음) |
| 2026-07-15 | F-AUTH-02 카카오/네이버 OAuth **설계 확정**(실 구현은 후속 라운드로 분리) — provider별 상이한 통합 경로(카카오=OIDC / 네이버=커스텀 브리지), (auth_provider, oauth_subject) 신뢰 소스·이메일 미제공 placeholder 정책, Flow-0-S(A-04/A-05 스킵·A-08 동의 즉시 INSERT), A-11 무화면 콜백, users 스키마 변경안, 소셜 버튼 컴포넌트 | `01-prd.md` §5-1-1(신규), `04-workflow.md` Flow-0-S(신규), `05-erd.md` §2-1, `02-ia.md` §3-2 A-11·각주, `03-uiux.md` §6-8(신규) | Supabase 네이티브 provider 미지원으로 provider별 통합 경로 비대칭 — 설계 검토 없이 구현 착수 시 카카오/네이버 방식 혼동 위험. role=person 셀프 가입 인바리언트(persons.id=primary_guardian_id=auth.uid()) 유지 명시 |
| 2026-07-15 | F-G-10 권한 자동 만료 배치(일 1회)·D-7 사전 알림·분기별 미사용 권한 감사 요약을 pg_cron+plpgsql로 구현(`05-erd.md` §4-5③⑤). 검토 중 `permission_logs.actor_id`가 cron 배치(SECURITY DEFINER, auth.uid() NULL) 경로에서 항상 NULL이 되어 사람 미개입과 구분 안 되는 결함 발견·`actor_type`('user'/'system') 컬럼으로 핫픽스 | 마이그레이션 `p3_permission_expiry_batch`, `p3_permission_logs_actor_type`, `supabase/prisma/schema.prisma` | 과다권한 요약(PRD 언급)은 판정 기준 미정의로 이번 범위 제외, 후속 작업. security-rls 에이전트는 사용량 한도로 실행 실패 — 메인 세션이 대신 체크리스트 검토 후 actor_type 핫픽스 직접 적용 |
| 2026-07-15 | F-G-10 정식 security-rls 검토(위 라운드 재검증) — **결함 없음** 결론 + pgTAP 15 신설(`supabase/tests/15_permission_expiry_batch.sql`, 15 asserts). REVOKE ALL FROM PUBLIC(authenticated 직접호출 차단)·D-7 주보호자 스코프·80일 재발송 창(분기 최소간격 90일>80 안전)·actor_type 'user'/'system' 분기·대량 UPDATE의 cache 무효화 트리거(pg_net 비동기 큐라 배치 트랜잭션 미차단) 전부 검증 | `supabase/tests/15_permission_expiry_batch.sql`(신규) | 이전 라운드가 사용량 한도로 비공식 수동검토에 그쳐 정식 재검토. 관찰(비결함, 미수정): ①D-7 사전알림은 `valid_until = today+7` 정확일치라 cron 다운타임 시 캐치업 없음(PRD "정확히 7일" 스펙과 합치) ②배치가 invalidate_permission_cache 를 행마다 발동→행당 vault 복호화 2회, 예상 규모(당사자 수백)에선 무해하나 대규모 시 statement-level/시크릿 캐시 검토 여지. 로컬 psql/pg_prove 미설치로 실행검증은 미수행(정적 검토) |
