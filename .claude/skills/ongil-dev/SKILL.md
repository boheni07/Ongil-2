---
name: ongil-dev
description: >
  온길 플랫폼 기능 개발 오케스트레이터 스킬. 기능 구현 요청 시 frontend-dev, mobile-dev,
  backend-db, security-rls, qa-verifier 에이전트 팀을 조율하여 완성된 기능을 전달한다.
  "구현해줘", "만들어줘", "화면 추가", "기능 추가", "온길 개발", "Phase 1", "P0 구현" 등
  개발 요청 키워드 시 반드시 이 스킬을 사용할 것.
  재실행: "다시 해줘", "수정해줘", "이 기능 보완해줘" 등 후속 요청에도 트리거.
---

# 온길 개발 오케스트레이터

## Phase 0: 컨텍스트 확인

```
1. _workspace/ 존재 여부 확인
2. 사용자 요청 분석 — 신규/부분수정/재실행 판별
3. 관련 docs/ 섹션 파악
4. 실행 계획 사용자 확인 (3줄 이내)
```

## Phase 1: 기능 범위 분석

요청된 기능에서 다음을 파악한다:

- **화면 ID** (`docs/02-ia.md` 참조) — 어떤 화면을 구현하는가?
- **워크플로우** (`docs/04-workflow.md` 참조) — 어떤 플로우가 포함되는가?
- **DB 변경** (`docs/05-erd.md` 참조) — 새 테이블/컬럼/RLS 필요한가?
- **에이전트 할당** — 어떤 에이전트가 필요한가?

## Phase 2: 에이전트 팀 구성 및 실행

### 실행 순서

**Step 1 — DB/보안 먼저 (병렬):**
```
backend-db 에이전트:
  - DB 스키마 확인/수정 (docs/05-erd.md 기반)
  - API 클라이언트 함수 작성 (packages/shared/src/api/)
  - Zod 스키마 (packages/validation/)
  → _workspace/01_backend_api_types.ts 저장

security-rls 에이전트 (DB 변경 있을 때):
  - RLS 정책 검토/추가
  - pgTAP 테스트
  → _workspace/02_rls_policies.sql 저장
```

**Step 2 — 프론트엔드 구현 (병렬, Step 1 완료 후):**
```
frontend-dev 에이전트:
  - 웹 화면 구현 (docs/03-uiux.md 기반)
  - 컴포넌트 작성
  → _workspace/03_web_screens_done.md 저장

mobile-dev 에이전트 (모바일 화면 있을 때):
  - 모바일 화면 구현
  → _workspace/04_mobile_screens_done.md 저장
```

**Step 3 — QA 검증:**
```
qa-verifier 에이전트:
  - 설계 대비 구현 갭 분석
  - RLS 시나리오 검증
  - 접근성 체크
  → _workspace/05_qa_report.md 저장

Match Rate < 80% → 해당 에이전트 수정 요청 → 재검증 (최대 3회)
Match Rate >= 80% → Phase 3 진행
```

## Phase 3: 완료 보고

다음 형식으로 보고:

```
## 구현 완료

**화면:** [구현된 화면 ID 목록]
**API:** [추가된 API 함수]
**RLS:** [추가/수정된 정책]

## QA 결과
Match Rate: XX%
갭: [갭 있으면 목록]

## 다음 Phase
[다음으로 구현할 P0/P1 항목]
```

## 에이전트 모델

모든 에이전트 호출 시 `model: "opus"` 파라미터 명시.

## 테스트 시나리오

### 정상 플로우
```
"보호자 권한 부여 위자드를 구현해줘"
→ backend-db: permissions API
→ security-rls: permissions RLS 검증
→ frontend-dev: GrantWizard 컴포넌트 (G-32)
→ qa-verifier: 4단계 플로우 + RLS 검증
```

### 에러 플로우
```
RLS 정책 누락 발견
→ qa-verifier가 security-rls에게 수정 요청
→ security-rls 수정 → qa-verifier 재검증
→ 2회 이상 실패 시 사용자에게 에스컬레이션
```

## 참조 문서

- `docs/01-prd.md` — 기능 요구사항
- `docs/02-ia.md` — 화면 구조, URL
- `docs/03-uiux.md` — 디자인 사양
- `docs/04-workflow.md` — 사용자 플로우
- `docs/05-erd.md` — 데이터 모델, RLS
