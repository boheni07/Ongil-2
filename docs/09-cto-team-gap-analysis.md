# CTO팀 전 항목·분야별 갭분석 — 결과보고서 및 작업계획서

> 작성일: 2026-07-18 | 성격: **CTO팀 합동 갭분석 결과 문서** — §4(결과보고서)·§5(작업계획서)가 실제 반영 대상.
> 방식: CTO팀(기술 관점 10인)이 각자 분야에서 실제 코드베이스를 실측 조사해 갭을 보고 → PM이 취합 → CTO팀 전문기술 회의에서 우선순위·해법을 협의 → 결과보고서·작업계획서로 확정.
> 근거 데이터: 이번 세션 전체(2026-07-17~18)의 실측 결과 — 마이그레이션 22개, pgTAP 테스트 18개, 웹 라우트 52개, 모바일 화면 45개, `docs/01~08` 전체 문서 정합성 검토(Match Rate 93%), `persons_select` RLS 갭 발견·수정 사례 등을 근거로 한다. 추측이 아니라 grep·실제 파일 대조로 확인한 사실만 담는다.

---

## 0. 팀 구성

| 역할 | 관점 |
|---|---|
| PM (제품 총괄) | 전 분야 취합, 우선순위 판단, 일정 |
| PL (프로젝트 리드) | 실행 순서, 의존관계, 담당 배정 |
| 아키텍처 전문가 | 모듈 경계, 반복 패턴, 장기 확장성 |
| DB 전문가 | 스키마·마이그레이션 이력, 정책 변경 시 연쇄 영향 |
| SW 시니어 개발자 | 코드 중복·재사용, 유지보수 부담 |
| UIUX 전문가(디자이너·퍼블리셔) | 플랫폼 간(웹/모바일) 화면 파리티, 디자인 시스템 일관성 |
| 프론트엔드 개발자 | 웹/모바일 구현 상태, 공통화 시점 |
| 백엔드 개발자 | Server Action 컨벤션, 알림·부가기능 중복 |
| 보안 전문가 | RLS 정책 교차 검증, 회귀 테스트 커버리지 |
| 품질관리자(QA) | 테스트 하네스 건강도, E2E 검증 공백 |

---

## 1. 분야별 갭 분석 (실측)

### 1-1. 아키텍처 전문가

- 모노레포 구조(`apps/web`, `apps/mobile`, `packages/shared`, `packages/validation`, pnpm workspaces) 자체는 건전 — 도메인 경계가 명확하고 타입 계약이 패키지 레벨에서 공유된다.
- **person_id 소프트 링크가 이미 3곳에서 반복되는 중**: TRA-001↔EDU-005, TRA-001↔EDU-001.`transition_plan`, WEL-004(ISP)↔WEL-006(사례회의록). 각각 `getLatestXxxSummary()` 형태로 개별 구현돼 있어(예: `getLatestItpSummary`) 공통 추상화가 없다. 지금은 무해하지만 4번째 사례부터는 "느슨한 연결"들이 산발적으로 관리되는 구조가 될 위험.
- `record_type`이 CHECK 제약 없는 자유 text라는 설계는 EDU-005·WEL-006을 마이그레이션 없이 신속히 추가할 수 있게 한 핵심 요인이었으나(장점), `RECORD_TYPE_LABEL`에 없는 오타 값이 들어가도 DB가 막지 않는다는 트레이드오프가 있다(단점, 지금까지 실제 오타 사례는 없었음).

### 1-2. DB 전문가

- 마이그레이션 22개 전부 `prisma migrate deploy`로 정상 적용 확인(2026-07-18 재현 테스트 완료).
- **`persons_select` 갭이 9일간(07-09 최초 정의~07-18 발견) 방치됐다** — `records_select`가 갱신될 때마다 연관된 `persons_select`도 함께 재검토하는 교차 체크리스트가 없었다는 방증. 같은 종류의 "정책 A를 고치면서 정책 B를 놓치는" 패턴이 재발할 소지가 있다.
- `report_kind`(LEG-001)·`fba_basis`(EDU-003) 같은 JSONB 필드 추가는 마이그레이션 없이 이뤄져 스키마 변경 이력에서 추적이 어렵다 — 현재 규모(레코드 수백 건)에선 성능 문제 없지만, 대규모 조회 시 JSONB 내부 필드 인덱싱 여부를 점검할 시점을 미리 정해두지 않았다.

### 1-3. SW 시니어 개발자

- 코드 품질 실측: `TODO`/`FIXME` 0건, `as any` 0건 — 전반적으로 클린하다.
- **`getXxxClients`/`createXxx`/`listXxxRecords`/`getXxxDetail` 골격이 8개 이상 도메인(BIP·LEG·TRA·ISP·ITP·case-notes 등)에 거의 동일한 구조로 반복 구현돼 있다.** 지금까지는 "검증된 패턴 재사용"으로 긍정적으로 평가돼 왔지만, 공통 로직(권한 조회 → persons 조인 → 최신 레코드 파생)을 뽑아낼 시점이 다가오고 있다.

### 1-4. UIUX 전문가(디자이너·퍼블리셔)

- 웹 52라우트 vs 모바일 45화면(실측). **최근 신규 화면 6개(BIP 2·LEG 3·ITP 2·사례회의록 2, 일부 중복 라우트 포함) 전부 모바일에 단 하나도 반영되지 않았다** — `grep`으로 모바일 소스 전체를 뒤져도 EDU-003/EDU-005/WEL-006/LEG-001/002 관련 코드가 0건.
- 웹 쪽 디자인 시스템 준수(domain-* 컬러 토큰 재사용)는 신규 화면들도 일관되게 지키고 있어 양호.

### 1-5. 프론트엔드 개발자

- 위 SW 시니어·UIUX 지적과 동일한 코드 중복·모바일 파리티 갭을 실무 관점에서 재확인.
- "목록 화면에 다른 도메인 딥링크 필터 추가"(ISP→서비스현황, ISP→사례회의록) 패턴이 이미 2곳 생겼다 — 3번째 사례부터는 공통 훅(`useDeepLinkFilter` 류)으로 뽑을 시점.

### 1-6. 백엔드 개발자

- Server Action 컨벤션(assertXxx 역할 게이트, RLS 최종 위임, `logAccess` 호출) 일관성 양호.
- **알림 발송(`notifications` 테이블 insert)이 서로 다른 3개 파일(`handovers/actions.ts`, `records/eval/actions.ts`, `records/case-notes/actions.ts`)에 best-effort try/catch로 각각 중복 구현돼 있다**(실측 grep 확인) — 공통 유틸(`notifyRecipients()` 류)로 통합할 시점.

### 1-7. 보안 전문가

- `persons_select` 갭의 재발 방지책 부재를 근본 문제로 지적: "records 접근을 허용하는 모든 permissions 분기가 persons에도 동일하게 존재하는가"를 검증하는 정책 간 교차 메타 테스트가 없다(`pgTAP 17`이 "전 테이블 RLS 활성화"는 강제하지만 "정책 간 논리적 일관성"까지는 강제하지 않음).
- **EDU-003(BIP)·EDU-005(ITP)·WEL-006(사례회의록)·LEG-001/002 — 오늘까지 신설된 5개 record_type 중 어느 것도 전용 pgTAP 테스트가 없다**(실측: `supabase/tests/*.sql` 전체에서 해당 문자열 0건). 이번 세션의 검증은 전부 라이브 psql 세션 시뮬레이션이었고 회귀 스위트에 영구히 남지 않았다.
- F-LEG-11(학대의심 신고 에스컬레이션)은 여전히 법률 자문 대기 — 현재 프로덕션 미배포 단계라 즉각적 리스크는 낮음.

### 1-8. 품질관리자(QA)

- pgTAP 하네스 자체가 fixture 이메일 충돌(동일 8자리 UUID 프리픽스 충돌)로 전체 스위트 완주가 안 되는 기존 결함이 미해결 상태로 남아있다 — 이 상태에서는 신규 record_type용 pgTAP을 추가해도 "정말 통과하는지"를 CI 수준에서 자동 확인할 수 없다.
- 이번 세션의 검증은 전부 DB/코드 레벨(psql 세션 시뮬레이션, 문서-코드 대조)이었고, **실제 브라우저로 사용자 시나리오를 끝까지 밟아본 E2E 검증은 세션 전체에서 단 한 번도 없었다.**
- F-AUTH-02(카카오/네이버 OAuth)는 설계만 확정, `/auth/callback/:provider` 라우트 자체가 아직 없음(기존에 이미 확인된 P3-7 갭, 변동 없음).

---

## 2. PM 취합

8개 유효 발견사항으로 정리:

| # | 발견사항 | 보고자 |
|---|---|---|
| G-1 | 모바일 파리티 완전 결여(신규 5종 record_type 전부 미이식) | UIUX·프론트엔드 |
| G-2 | 신규 5종 record_type에 pgTAP 회귀 테스트 전무 | 보안·QA |
| G-3 | pgTAP 하네스 자체 결함(fixture 이메일 충돌)으로 전체 스위트 미완주 | QA |
| G-4 | `persons_select`류 정책 교차 검증 체크리스트 부재(재발 방지책 없음) | DB·보안 |
| G-5 | 코드 중복 패턴 3곳(getXxxClients 골격, 딥링크 필터, 알림 발송) | 아키텍처·SW시니어·백엔드 |
| G-6 | 실제 브라우저 E2E 검증 전무(세션 전체가 DB/코드 레벨) | QA |
| G-7 | F-AUTH-02(OAuth) 미구현 — 기존 갭, 변동 없음 | QA |
| G-8 | F-LEG-11(학대신고) 법률자문 대기 — 기존 갭, 변동 없음 | 보안 |

우선순위 판단이 필요한 항목(G-1~G-6)을 CTO팀 회의로 넘긴다. G-7·G-8은 이미 별도 트랙으로 확정돼 있어 재논의하지 않는다.

---

## 3. CTO팀 전문기술 회의

**안건 1 — pgTAP 하네스 결함(G-3)을 P1으로 올릴 것인가**
- 보안 전문가: "회귀 테스트가 자동으로 안 도는 상태에서 신규 기능을 계속 추가하는 건 위험이 계속 누적되는 구조다. 지금 당장 고쳐야 한다."
- PM: "맞는 말이지만 아직 프로덕션 배포 전이고, 이번 세션에서도 라이브 psql 세션으로 실질적 검증은 다 마쳤다. 하네스 자체를 고치는 건 비용 대비 지금 시급하진 않다."
- QA: "절충안 — 하네스를 완전히 고치는 건 큰 작업이니 미루더라도, 최소한 '다음에 신규 record_type을 또 추가하기 전까지는' 반드시 고쳐야 한다는 조건을 걸자."
- **합의**: G-3은 P2로 확정하되, **다음 신규 record_type 착수 조건**으로 못 박는다(G-2와 묶어서 처리).

**안건 2 — 모바일 파리티(G-1)를 5종 한 번에 갈 것인가, 우선순위를 매길 것인가**
- UIUX 전문가: "5종을 한 번에 만드는 건 범위가 너무 크다. 실사용 빈도 기준으로 나누자."
- PL: "동의. EDU-003(BIP)은 기존 모바일 IEP·관찰기록 화면과 인접해 있어 구현 비용이 낮다. WEL-006(사례회의록)·LEG-001/002는 사회복지사가 주로 데스크톱에서 쓰는 워크플로우라 모바일 우선순위가 상대적으로 낮다."
- 프론트엔드 개발자: "EDU-005(ITP)도 EDU-003과 같은 특수교사 화면 그룹에 있으니 BIP와 같이 가면 효율적이다."
- **합의**: 1차로 **EDU-003(BIP)·EDU-005(ITP)** 모바일 이식, 2차로 WEL-006·LEG-001/002(사회복지사 대상, 우선순위 낮음).

**안건 3 — 코드 중복(G-5)을 지금 리팩토링할 것인가**
- 아키텍처 전문가: "person_id 소프트 링크가 3곳이면 아직은 참을 만하다. 4번째 사례가 생기기 전에만 공통화하면 된다."
- SW 시니어 개발자: "getXxxClients 골격도 마찬가지 — 지금 8개 도메인이 전부 똑같이 생겼다는 건 오히려 안정적으로 검증된 패턴이라는 뜻이다. 억지로 지금 추상화하면 오히려 유연성을 잃는다(YAGNI)."
- 백엔드 개발자: "알림 발송 중복(3곳)은 성격이 다르다 — 로직 자체가 짧고 단순해서 공통 유틸로 뽑아도 리스크가 거의 없다. 이건 지금 해도 된다."
- **합의**: person_id 링크·getXxxClients 골격은 **지금 리팩토링하지 않는다**(질서있는 반복, 4번째 사례 시점에 재논의). 알림 발송 중복만 **지금 공통 유틸로 통합**(리스크 낮고 이득이 명확).

**안건 4 — 정책 교차 검증 체크리스트(G-4)**
- 보안 전문가: "`persons_select` 사고의 재발 방지책이 필요하다. `pgTAP 17`(전 테이블 RLS 강제)과 같은 급의 메타 테스트를 하나 더 만들자 — '이 person에 대해 records 접근이 허용되는 사용자는 반드시 persons도 접근 가능해야 한다'는 논리적 불변식을 검증."
- DB 전문가: "좋다. 다만 이건 하네스가 고쳐진 후에나 실제로 자동 실행될 수 있다(G-3에 종속)."
- **합의**: G-4는 새 pgTAP 메타 테스트로 구현하되, **G-3(하네스 수정) 완료 후 착수** — 의존관계로 명시.

**안건 5 — E2E 검증 공백(G-6)**
- QA: "지금까지 전부 DB/코드 레벨 검증이었다. 최소한 신규 기능(BIP/LEG/ITP/사례회의록) 하나씩은 실제 브라우저로 골든 패스를 밟아봐야 한다."
- PM: "동의. 다음 세션에 브라우저 자동화로 스팟체크 라운드를 별도로 잡자."
- **합의**: 별도 라운드로 분리, 이번 작업계획서에는 항목으로만 등록.

---

## 4. 결과보고서

| # | 발견사항 | 심각도 | CTO팀 결론 |
|---|---|---|---|
| G-1 | 모바일 파리티 결여(신규 5종 record_type) | P2 | 2단계 이식(BIP·ITP 우선 → WEL-006·LEG 후속) |
| G-2 | 신규 5종에 pgTAP 회귀 테스트 없음 | P2 | G-3 완료 후 착수 |
| G-3 | pgTAP 하네스 fixture 충돌 미해결 | P2 | 다음 신규 record_type 착수 전 필수 선행 조건 |
| G-4 | 정책 교차 검증 메타 테스트 부재 | P3 | G-3 이후 신규 메타 테스트로 구현 |
| G-5a | person_id 소프트 링크·getXxxClients 중복 | 관찰(비결함) | 지금 리팩토링 안 함 — 4번째 사례 시 재논의 |
| G-5b | 알림 발송 로직 3곳 중복 | P3 | ✅ 완료(2026-07-18) — `notifyRecipients` 공통 유틸로 통합 |
| G-6 | 브라우저 E2E 검증 전무 | P3 | 별도 라운드로 분리 |
| G-7 | F-AUTH-02 OAuth 미구현 | 기존 갭(변동 없음) | 별도 트랙 유지 |
| G-8 | F-LEG-11 학대신고 법률자문 대기 | 기존 갭(변동 없음) | 별도 트랙 유지 |

**종합 평가**: 코드 품질(TODO/FIXME/any 0건)과 문서-코드 정합성(Match Rate 93%)은 양호하다. 실제 리스크가 있는 항목은 **G-2·G-3(회귀 테스트 공백)**이며, 나머지는 "질서있게 관리되고 있는 반복"이거나 이미 알려진 별도 트랙 항목이다. 새로운 P1급 결함은 발견되지 않았다.

---

## 5. 작업계획서

### Wave A — 즉시 착수 (의존성 없음) — ✅ 완료(2026-07-18)

| # | 항목 | 담당 | 완료 조건 | 상태 |
|---|---|---|---|---|
| A-1 | 알림 발송(`notifications` insert) 공통 유틸 추출 | 백엔드 개발자 | `handovers`·`records/eval`·`records/case-notes` 3개 파일이 동일 유틸 함수 호출로 통합, 동작 변경 없음(순수 리팩토링) | ✅ `apps/web/src/lib/notify.ts` 신설(`notifyRecipients`, `logAccess`와 동일한 "자체 client 생성 + best-effort try/catch" 컨벤션). 3개 파일 모두 recipientIds 계산 로직(기능별로 다름)은 그대로 두고 insert+try/catch 골격만 교체. `pnpm typecheck`·`build` 통과 |

### Wave B — pgTAP 하네스 수정 (G-3, 다음 신규 record_type 착수 전 필수)

| # | 항목 | 담당 | 완료 조건 | 상태 |
|---|---|---|---|---|
| B-1 | pgTAP fixture 이메일 충돌 수정 | QA·DB 전문가 | `tests.mk_user()`가 8자리 프리픽스 충돌 없이 고유 이메일 생성하도록 수정, `supabase test db` 전체 스위트 완주 확인 | ✅ 완료(2026-07-18) — 아래 상세 참고 |
| B-2 | EDU-003·EDU-005·WEL-006·LEG-001·LEG-002 전용 pgTAP 테스트 신설 | QA·보안 전문가 | 5개 record_type 각각 최소 1개 파일, 작성 권한·연령가드·확인주체 시나리오 포함 | ✅ 완료(2026-07-18) — 아래 상세 참고 |
| B-3 | 정책 교차 검증 메타 테스트 신설(persons_select ↔ records_select 논리 일관성) | 보안 전문가 | B-1 완료 후 착수, 신규 메타 assert 1건 | ✅ 완료(2026-07-18) — 아래 상세 참고 |

#### B-2 완료 상세 (2026-07-18)

5개 record_type 각각 전용 pgTAP 파일 신설(`supabase/tests/18~22`), 파일당 도메인 write 권한자 INSERT 가능·무권한자 INSERT 차단(RLS 42501)·`requires_confirmation` 값에 따른 confirmer 자동 배정(또는 미배정) 시나리오를 포함한다.

| 파일 | record_type | requires_confirmation | 커버리지 |
|---|---|---|---|
| `18_bip_edu003.sql` | EDU-003(BIP) | true | 작성 권한 2건 + confirmer 배정 2건(아동기→주보호자/성인기→본인). 연령가드 없음(모든 연령대 작성 가능한 설계)이라 해당 시나리오 생략 |
| `19_itp_edu005.sql` | EDU-005(ITP) | true | 작성 권한 2건 + confirmer 배정 1건(청소년전환기→주보호자) + 연령가드 경계 확인 2건 |
| `20_case_conference_notes_wel006.sql` | WEL-006(사례회의록) | false | 작성 권한 2건 + confirmer 미배정 확인 1건. 연령가드 없음 |
| `21_guardianship_report_leg001.sql` | LEG-001(후견감독보고서) | true | 작성 권한 2건 + confirmer 배정 1건(성인기→본인) + 연령가드 경계 확인 2건 |
| `22_advocacy_consultation_leg002.sql` | LEG-002(권익옹호상담) | false | 작성 권한 2건 + confirmer 미배정 확인 1건 + 연령가드 경계 확인 1건 |

**연령가드 경계 확인의 의미**: EDU-005·LEG-001·LEG-002는 앱 레이어(`createItp`/`createGuardianshipReport`/`createAdvocacyConsultation`)에만 생애주기 가드가 있고 `records_insert` RLS·`assign_record_confirmer()` 트리거는 `record_type`/생애주기 대상 적합성을 전혀 참조하지 않는다. 각 파일의 해당 테스트는 "대상 연령대 밖 당사자에게도 DB 레벨 INSERT가 허용되며, confirmer는 트리거가 실제 생애주기 기준으로만 판단해 배정된다"는 경계를 명시적으로 고정해, 향후 누군가 이 책임 분리(연령가드=앱, 권한=RLS)를 착각하고 DB가 나이를 걸러줄 것이라 가정하는 회귀를 방지한다.

작성 중 자체 발견한 테스트 버그 1건(회귀 아님): 파일 19·21의 "연령가드 경계" INSERT가 최초엔 `requires_confirmation` 컬럼을 명시하지 않아 기본값 `false`로 삽입되면서 confirmer 배정 트리거가 발동하지 않아 다음 assert가 실패했다 — 두 INSERT 모두에 `requires_confirmation: true`를 명시해 수정. `docker exec`+`psql -f`로 5개 파일 개별 실행 및 전체 23개 파일 재실행 모두 `not ok`/`ERROR` 0건 확인.

#### B-1 완료 상세 (2026-07-18)

`tests.mk_user()`의 이메일 생성을 8자리 UUID 프리픽스(`left(p_id::text,8)`)에서 전체 UUID로 변경해 충돌을 제거했다. 이 수정으로 pgTAP 하네스가 **이 프로젝트에서 처음으로 18개 테스트 파일 전체를 실제 완주**했고, 그 과정에서 이전에는 도달 불가능했던 코드 경로의 결함들이 연쇄적으로 드러났다:

1. **8개 파일·18개 지점의 중첩 데이터수정 CTE 구문 오류** (`WITH x AS (UPDATE/DELETE ...)`가 `SELECT is(...)` 인자 안에 중첩된 경우 PostgreSQL이 허용하지 않음) — `02_records.sql`·`03_permissions.sql`·`04_audit_logs.sql`·`05_confirmation.sql`·`08_guardians.sql`·`09_handover_notifications.sql`·`12_privacy_consents.sql`·`16_notification_preferences_permission_presets_rls.sql`. 전부 `WITH`을 문 최상위로 끌어올려 수정.
2. **`log_permission_change()` 트리거의 실제 프로덕션 버그**(`20260718000000_p3_permission_logs_action_cast_fix`) — CASE 표현식이 `text`로 확정되어 `PermissionLogAction` enum 컬럼에 암시적 캐스트가 안 되는 결함. `permissions` UPDATE(권한 회수·수정)마다, 그리고 F-G-10 자동 만료 배치(`process_permission_expiry()`)가 실행될 때마다 2026-07-15부터 3일간 실패해 왔다 — 명시적 `::"PermissionLogAction"` 캐스트로 수정.
3. **`04_audit_logs.sql` 테스트 격리 결함** — `seed.sql` 목업 데이터가 만든 다른 `permission_logs` 행까지 전체 카운트에 섞여 거짓 실패(11 vs 기대 1). 해당 fixture의 person/grantee/domain 삼중 조건으로 스코프를 좁혀 수정.
4. **`users` 테이블 컬럼 GRANT 권한 상승 취약점**(신규 마이그레이션 `20260718010000_p3_users_column_grant_hotfix`) — **가장 심각한 발견**. `20260709041005_p0_4_rls_grants`가 `users`에 테이블 단위 UPDATE를 전 컬럼 대상으로 부여했는데, 이후 `20260714020000_p2_privacy_settings`가 "본인은 `deactivated_at`만 수정 가능"하도록 제한하려 했으나 선행 `REVOKE` 없이 `GRANT UPDATE (deactivated_at)`만 추가했다. PostgreSQL 컬럼 권한은 가산적이라 이 좁은 GRANT는 실제로는 아무것도 제한하지 못했다(no-op) — **임의의 인증된 사용자가 자기 `role` 컬럼을 마음대로 변경(예: teacher → social_worker)해 해당 역할의 전체 권한 프리셋·화면 접근권을 획득할 수 있는 권한 상승 취약점**이었다. 라이브 세션에서 실제로 재현·확인(트랜잭션 롤백, 영구 반영 없음) 후, `handover_notes`/`notifications`에서 이미 쓰인 `REVOKE UPDATE ... ; GRANT UPDATE (컬럼) ...` 순서로 수정. 수정 후 동일 익스플로잇 재시도 시 `permission denied for table users`로 정상 차단, 본인 `deactivated_at` 갱신은 정상 동작 확인.

수정 후 `docker exec` + `psql -f`로 18개 테스트 파일 전체를 개별 실행 — **전 파일 `not ok`/`ERROR` 0건**(이전에 알려졌던 `07_invitations.sql`·`10_life_stage_transitions.sql`의 실패도 픽스처 버그의 부수 효과였을 뿐, 이번 수정으로 모두 해소됨). Wave B-1의 완료 조건("전체 스위트 완주 확인")을 충족.

#### B-3 완료 상세 (2026-07-18)

`supabase/tests/23_persons_records_select_consistency.sql`(신규, plan 10) — 2026-07-17 EDU-005 검증 중 발견된 `persons_select`의 permissions 보유자 분기 누락 사건(당시 개별 record_type 단위로만 재현·수정됨, `20260717130000_p3_persons_select_permission_holders`)의 재발을 "정책 두 개의 논리적 관계"라는 상위 층위에서 방지하기 위한 메타 테스트.

**핵심 불변식**: `persons_select`와 `records_select`는 3가지 접근 경로(person 셀프·guardians 링크·permissions 보유)를 공유하지만 완전히 동일하지는 않다 — `records_select`의 permissions 분기는 `domain` 일치를 요구하는 반면 `persons_select`의 permissions 분기는 도메인을 전혀 보지 않는다(어느 도메인이든 담당자면 명단에는 보여야 하는 의도된 설계). 따라서 검증 대상은 "완전 동치"가 아니라 **"records가 보이면 persons도 반드시 보인다(단방향 함의)"**이며, 반대로 "permissions가 있으면 persons는 보이지만 다른 도메인 records는 안 보일 수 있다(의도된 비대칭)"도 함께 고정한다.

5개 시나리오(permissions 보유자·주보호자·비주 공동보호자·셀프 당사자·무권한자) × persons/records 양쪽 SELECT 확인 8건 + 무권한자 음성 대조 1건 + 의도된 비대칭(도메인 격리와 persons 가시성의 공존) 1건, 총 10 assert. 전체 24개 pgTAP 파일 재실행 결과 `not ok`/`ERROR` 0건 확인 — **Wave B(B-1/B-2/B-3) 전체 완료**.

### Wave C — 모바일 파리티 (G-1, 2단계)

| # | 항목 | 담당 | 완료 조건 | 상태 |
|---|---|---|---|---|
| C-1 | EDU-003(BIP)·EDU-005(ITP) 모바일 이식 | 프론트엔드 개발자·UIUX 전문가 | 기존 모바일 IEP·관찰기록 화면 패턴 재사용, 웹과 동일한 연령가드·확인주체 로직 적용 | ✅ 완료(2026-07-18) — 아래 상세 참고 |
| C-2 | WEL-006(사례회의록)·LEG-001/002 모바일 이식 | 프론트엔드 개발자·UIUX 전문가 | C-1 완료 후 착수(우선순위 낮음) | ✅ 완료(2026-07-18) — 아래 상세 참고 |

#### C-2 완료 상세 (2026-07-18)

웹의 `case-notes/actions.ts`·`leg/actions.ts`·`CaseConferenceForm.tsx`·`GuardianshipReportWizard.tsx`·`AdvocacyConsultationForm.tsx`를 모바일에 1:1 이식했다.

- **`apps/mobile/src/lib/case-notes.ts`**(신규): `getCaseNoteClients`/`listCaseNotes`/`createCaseConferenceNote` — WEL 도메인 write/edit 권한 보유자로 스코핑, `requires_confirmation:false`, `record_date:meetingDate`. 알림 발송은 웹의 `notifyRecipients` 대신 모바일 기존 관행(`lib/handover.ts`)대로 호출부에서 직접 try/catch로 `notifications` insert(보호자 전원 ∪ 본인 계정 − 작성자, best-effort).
- **`apps/mobile/src/lib/leg.ts`**(신규): `getLegClients`/`listLegRecords`/`createGuardianshipReport`/`createAdvocacyConsultation`/`getLegRecordDetail`. 두 작성 함수 모두 `assertSocialWorker`(users.role 재확인) + **서버 측 연령가드 재검증**(`isSelfConfirmingStage(computeLifeStage(...))`, 성인기·노년기 미만이면 차단)을 웹과 동일하게 이중 구현 — 2026-07-17 웹 라운드에서 발견됐던 "연령가드 누락으로 영유아기 당사자도 후견감독보고서 작성 가능" 결함과 동형의 재발을 방지.
- **`apps/mobile/src/screens/CaseConferenceFormScreen.tsx`**(신규): 단일 폼(`HandoverComposeScreen` 모델), 연령가드 없음.
- **`apps/mobile/src/screens/GuardianshipReportWizardScreen.tsx`**(신규): 4단계 위자드(`TransitionPlanWizardScreen` 구조 재사용), TRA-001과 반대 방향의 연령가드(🔏, 성인기 미만 차단) — `report_kind`(정기 우선) 드롭다운, `canNext`·제출 버튼 이중 가드.
- **`apps/mobile/src/screens/AdvocacyConsultationFormScreen.tsx`**(신규): 단일 폼, LEG-001과 동일한 연령가드.
- **`apps/mobile/src/screens/LegBoardScreen.tsx`**(신규, 브리핑 범위 밖 자체 판단으로 추가): 웹 `LegRecordsBoard.tsx`에 대응하는 LEG 허브 — 두 작성 화면 진입 버튼 + 당사자별 LEG-001/002 통합 목록(최초/정기 배지 포함). 이미 필요한 lib 함수(`getLegClients`+`listLegRecords`)가 갖춰져 추가 비용이 낮고 웹과의 실제 기능 동등성을 위해 구현하기로 결정.
- **`apps/mobile/src/navigation/{types,MainNavigator}.tsx`**: `SocialWorkerStackParamList`에 4개 라우트 추가, social_worker 스택에 등록.
- **`apps/mobile/src/screens/SocialWorkerHomeScreen.tsx`**: "📝 사례회의록"·"⚖️ 법률·권리 기록" 진입 버튼 추가(웹과 동일하게 조건 없이 항상 노출).

**웹과의 의도된 차이**: `meetingDate`/`consultedAt`은 웹이 `<input type="datetime-local">`을 쓰는데 모바일엔 대응 컴포넌트가 없어 동일 포맷(`YYYY-MM-DDTHH:mm`) 텍스트 입력으로 대체(기존 모바일 위자드들의 날짜 처리 관행과 동일).

`pnpm --filter @ongil/mobile typecheck` 통과(에러 0건, 메인 세션이 재실행해 재확인). `lib/leg.ts`의 이중 가드(역할+연령) 로직을 메인 세션이 직접 읽고 웹 원본과 대조 검증함. 모바일 에뮬레이터가 이 환경에 없어 시각적 확인은 못했다.

**Wave C 전체 완료**(C-1+C-2). Wave D(E2E 스팟체크·OAuth·학대신고)는 별도 트랙으로 남는다.

#### C-1 완료 상세 (2026-07-18)

웹의 `bip/actions.ts`·`itp/actions.ts`·`BipForm.tsx`·`ItpWizard.tsx`를 모바일에 1:1 이식했다.

- **`apps/mobile/src/lib/iep.ts`**: `isItpActiveStage(stage)` 헬퍼 추가(웹 `lifecycle.ts`와 동일 — 청소년전환기만 true).
- **`apps/mobile/src/lib/bip.ts`**(신규): `getBipClients`/`createBip`/`listBipRecords`/`getBipDetail` — EDU 도메인 write/edit 권한 보유자로 담당 학생 스코핑, `requires_confirmation:true`, 연령가드 없음(웹과 동일 설계). 자체 `logAccess` 복제(iep.ts가 export 안 해서 매 lib 파일이 재정의하는 기존 관행).
- **`apps/mobile/src/lib/itp.ts`**(신규): `getItpClients`/`createItp`/`listItpRecords`/`getItpDetail`/`getLatestItpSummary` — `createItp`가 `persons.birth_date`를 서버에서 재조회해 `isItpActiveStage`로 재검증하는 이중 가드를 웹과 동일하게 구현(LEG 라운드에서 겪은 "연령가드 누락" 실수 재발 방지 원칙을 명시적으로 지킴).
- **`apps/mobile/src/screens/BipFormScreen.tsx`**(신규): 단일 폼(`ObservationFormScreen` 스타일). 학생 선택 칩, 행동 기능/기능평가 근거 칩 선택(`fba_basis` 다중선택), 텍스트 필드들, `useWizardDraft` 임시저장.
- **`apps/mobile/src/screens/ItpWizardScreen.tsx`**(신규): 4단계 위자드(`TransitionPlanWizardScreen`의 연령가드 카드 관용구 재사용, 🎓 아이콘). 대상·흥미영역 → 현장실습 이력 → 인계메모·검토일 → 확인·저장. `canNext`·제출 버튼 모두 `blocked` 이중 가드.
- **`apps/mobile/src/navigation/types.ts`**: `TeacherStackParamList`에 `BipForm`/`ItpWizard` 라우트 파라미터 추가.
- **`apps/mobile/src/navigation/MainNavigator.tsx`**: teacher 스택에 두 화면 등록.
- **`apps/mobile/src/screens/TeacherHomeScreen.tsx`**: 퀵액션 행 추가(BIP 무조건 노출, ITP는 `isItpActiveStage` 대상 학생 1명 이상일 때만 노출 — 웹 `TeacherHome.tsx`의 `itpTargets > 0` 조건과 동일).

`pnpm --filter @ongil/mobile typecheck` 통과(에러 0건). 모바일 에뮬레이터가 이 환경에 없어 시각적 확인은 못했다 — UI 렌더링·터치 동작은 미검증.

**진행 경위 메모**: 최초 구현을 맡은 mobile-dev 에이전트가 월간 사용량 한도 도달로 `ItpWizardScreen.tsx` 작성 도중 중단됐으나, 실제로는 lib 2개·화면 2개·`isItpActiveStage` 헬퍼·네비게이션 타입까지는 이미 완성돼 있었다(재확인 결과 손실 없음). 메인 세션이 나머지(네비게이터 등록, `TeacherHomeScreen` 진입점, typecheck)를 직접 마무리했다.

### Wave D — 별도 라운드로 분리

| # | 항목 | 비고 |
|---|---|---|
| D-1 | 신규 기능(BIP/LEG/ITP/사례회의록) 브라우저 E2E 스팟체크 | 다음 세션에 `claude-in-chrome` 등 브라우저 자동화로 진행 |
| D-2 | F-AUTH-02(카카오/네이버 OAuth) 구현 | 기존 별도 트랙, 변동 없음 |
| D-3 | F-LEG-11(학대의심 신고 에스컬레이션) | 법률 자문 완료 전까지 미착수 |

### 권장 실행 순서

```
Wave A(알림 유틸 통합) ✅ 완료(2026-07-18) → Wave B(pgTAP 하네스+회귀테스트+메타테스트) ✅ 완료(2026-07-18) → Wave C(모바일 파리티 2단계) ✅ 완료(2026-07-18) → (Wave D는 별도 라운드/트랙)
```

Wave A·B·C 전체 완료 — 신규 record_type 6종(EDU-003/EDU-005/WEL-006/LEG-001/LEG-002 + 기존 안정화분) 전부 웹·모바일 양쪽에서 동등한 기능을 제공하며, pgTAP 회귀·정책 논리 일관성 검증까지 갖춘 상태다. 남은 항목은 Wave D(E2E 브라우저 스팟체크·카카오/네이버 OAuth·학대신고 에스컬레이션)뿐이며 이들은 각각 성격이 달라(브라우저 자동화/외부 인증 연동/법률 자문 선행) 별도 라운드·트랙으로 분리해 두었다.
