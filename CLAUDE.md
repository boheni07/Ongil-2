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
