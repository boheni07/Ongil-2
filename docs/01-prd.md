# 온길 PRD — Product Requirements Document

> 버전: v1.1 | 작성일: 2026-07-07 | 최종 개정: 2026-07-09 (CLAUDE.md 변경 이력 참조)
> 참조: `1 Plan/ongil-platform-blueprint.md`

---

## 1. 제품 개요

### 1-1. 미션

**온길**은 장애인의 생애주기(의료·교육·복지·일상·전환·법률) 기록을 **당사자 중심**으로 관리하는 다역할 협업 플랫폼이다.

> **스코프 경계(2026-07-17, `docs/08-record-taxonomy-workshop.md` 안건2-5 확정)**: 온길은 **서비스 이용 개시 이후**의 지원 기록 관리 도구다. 발달재활서비스 바우처 신청·자격심사 같은 **신청 단계** 문서(의뢰서·세부영역검사지 등)는 지자체·사회서비스 전자바우처 시스템의 소관이라 의도적으로 다루지 않는다.

### 1-2. 핵심 가치

| 가치 | 설명 |
|------|------|
| 당사자 중심 | 모든 기록의 주인은 당사자, 이해관계자는 허락받은 범위만 접근 |
| 안전한 공유 | PostgreSQL RLS 행 수준 보안, 도메인·역할별 접근 제어 |
| 생애주기 연속성 | 6개 도메인 기록을 하나의 타임라인으로 통합 조회 |

### 1-3. 브랜드

- **마스터 슬로건:** "내 삶의 모든 길이 여기 있습니다"
- 온(溫, 따뜻함) · 온(全, 전체) · 길(道, 여정)

---

## 2. 사용자 유형 (Roles)

| 역할 코드 | 역할명 | 주요 목적 |
|----------|--------|---------|
| `person` | 당사자 | 자기 기록 확인 및 자기표현, 접근 권한 관리 |
| `guardian` | 보호자 | 복수 당사자 기록 관리, 이해관계자 권한 부여 |
| `supporter` | 활동지원사 | 활동지원 일지 작성, 인수인계 확인 |
| `teacher` | 특수교사 | IEP 작성·점검, 관찰기록 작성 |
| `social_worker` | 사회복지사 | ISP 작성·점검, 전환계획 로드맵 관리 |
| `therapist` | 치료사 | 치료계획서·회기일지·평가보고서 작성 |

---

## 3. 6개 생애주기 도메인

| 코드 | 도메인 | 색상 | 주요 기록 유형 |
|------|--------|------|--------------|
| MED | 의료·건강 | `#E04545` | 진단, 처방, 재활계획, 치료계획서, 회기일지, 평가보고서 |
| EDU | 교육 | `#4377C0` | IEP, 수업일지, 관찰기록, 전환교육계획 |
| WEL | 복지서비스 | `#3EA673` | ISP, 서비스 이용계획, 전환계획 |
| DAI | 일상·돌봄 | `#E8991E` | 활동지원 일지, 식사/건강 체크, 행동 관찰 |
| TRA | 성인전환 | `#8A5DC6` | 진로탐색, 자립생활계획, 직업훈련 기록 |
| LEG | 법률·권리 | `#5A7FA0` | 후견 기록, 권익옹호, 법적 지원 현황 |

### 3-1. 생애주기 5단계 (life_stage) — 2026-07-17 3단계→5단계 개정

당사자의 `birth_date` 기준으로 계산되는 파생 상태이며, 도메인별 기록 활성화 시점과 동의 주체를 결정한다 (계산 로직: `05-erd.md` §2-2-1). 실제 특수교육·장애복지 현장의 생애주기 구분(국립특수교육원·보건복지부 등)에 맞춰 기존 3단계(아동기/청소년 전환기/성년기)를 5단계로 확장했다 — 근거와 채택 과정은 `07-lifecycle-record-permission-proposal.md` 참조.

| 단계 | 연령 기준 | 당사자 상태 변화 | 주요 기록대상 | 주도 도메인 |
|------|---------|----------------|-------------|-----------|
| 영유아기 (`infant`) | 만 0~5세 | 보호자 대리동의 전체 | 진단·조기개입·재활치료(발달재활서비스), 관찰기록(만 3세~) | MED·**WEL**·DAI |
| 아동기 (`child`) | 만 6~12세 | 보호자 대리동의 전체 | 진단·재활계획, IEP 기본 5영역, 관찰기록, 활동지원 일지, 자기표현 | MED·EDU·DAI·**WEL** |
| 청소년 전환기 (`youth`) | 만 13~18세 | 전환계획 수립 개시 | 위 항목 + 전환 목표영역·희망 진로·전환 활동계획·연계기관 | MED·EDU·DAI·WEL·**TRA** |
| 성인기 (`adult`) | 만 19~64세 | 동의 주체 보호자→**본인** 이관 (`is_adult=true`, 기존 만 18세에서 **19세로 상향** — 민법상 성년 기준 정합) | 본인 동의 재취득, 성인 ISP/서비스이용계획, 전환 로드맵 실행(취업/자립), 후견·권익옹호 | WEL·**TRA**(실행)·**LEG** |
| 노년기 (`senior`) | 만 65세 이상 | 동의 주체는 계속 본인 | 돌봄 성격 강화, 만성질환 관리, 후견감독 관련 지원 밀도 증가 | WEL·**LEG**·MED |

> ⚠️ **경계값 변경 주의**: 성년(동의 주체 이관) 기준이 기존 "만 18세"에서 **"만 19세"**로 상향됐다. 만 18세 당사자는 기존 설계에서 `adult`(본인 확인주체)였으나 이번 개정으로 `youth`(보호자 확인주체)로 바뀐다. WEL 도메인도 영유아기·아동기부터 주도 도메인에 포함됐다(발달재활서비스가 만 18세 미만 전체 대상이라는 현장 실무 반영).

### 3-2. 역할별 권한 매트릭스 — 권장안

`permissions` 테이블은 도메인 단위로 완전히 동적으로 부여되는 구조(§ `05-erd.md` 2-4)이며 역할에 고정된 권한 규칙은 없다. 아래는 **G-32 권한 부여 위자드에서 도메인 선택 시 자동으로 채워주는 기본 프리셋**이며, 보호자가 언제든 덮어쓸 수 있다.

| 역할 | 의료 MED | 교육 EDU | 복지 WEL | 일상 DAI | 전환 TRA | 법률 LEG | 권장 유효기간 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 활동지원사 | read | – | – | **write** | – | – | 서비스 계약기간 |
| 특수교사 | – | **edit** | – | read | **write**(만 13세 이상만 선택 가능, §3-1 5단계 기준 `youth` 이상) | – | 학년도 단위(3/1~익년 2/28) |
| 사회복지사 | read | – | **edit** | – | **write** | read | 사례관리 기간(무기한 지양) |
| 치료사 | **edit** | – | – | read | – | – | 치료 계약기간 |
| 당사자 | read(본인) | read(본인) | read(본인) | write(자기표현) | read(본인) | read(본인) | 해당 없음(구조적 권한) |
| 보호자 | 전체(구조적) | 전체 | 전체 | 전체 | 전체 | 전체 | 해당 없음(`guardians` 관계로 영속) |

도메인 내 기록 유형별 위험도 참고(부여 시 보호자 안내 문구로 노출, 스키마 강제 아님):

| 도메인 | 고위험 유형(edit 신중 부여) | 저위험 유형(write/read 기본) |
|---|---|---|
| MED | 진단, 처방 | 치료계획서, 회기일지, 평가보고서 |
| WEL | ISP 승인·종결 처리 | 서비스 이용계획 초안, 진행 메모 |
| LEG | 후견 관련 결정 기록 | 권익옹호 상담 이력 |

### 3-2-1. 역할×기록유형(record_type) 매트릭스 (2026-07-17 추가)

위 §3-2는 **도메인** 단위 권한이다. 실제 DB RLS(`05-erd.md` §4-2 `records_select/insert/update`)도 도메인 단위로만 강제하며, **record_type 단위 구분은 앱 레이어(화면별 작성 폼 + `packages/validation`의 Zod 스키마)가 담당**한다 — 즉 아래 표의 "열람"·"작성 불가" 칸 상당수는 DB가 막는 게 아니라 해당 역할의 화면에 그 record_type 작성 폼이 없어서 지켜지는 것이다. `docs/05-erd.md` §3(record_type별 content JSONB 스키마)의 16개 유형 전체를 대상으로 한다.

| record_type (도메인) | 당사자 | 보호자 | 활동지원사 | 특수교사 | 사회복지사 | 치료사 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| SELF-001 자기표현 (DAI) | **작성·수정**(본인) | 열람+수정(구조적) | 열람 | 열람 | – | 열람 |
| DAI-002 활동지원일지 (DAI) | 열람(본인) | 열람+수정(구조적) | **작성**(주 작성자) | 열람 | – | 열람 |
| EDU-001 IEP (EDU) | 열람(본인) | 열람+수정(구조적) | – | **작성·수정**(주 작성자) | – | – |
| EDU-002 관찰기록 (EDU) | 열람(본인) | 열람+수정(구조적) | – | **작성·수정**(주 작성자) | – | – |
| EDU-003 행동중재계획 BIP (EDU) | 열람(본인) | 열람+수정(구조적) | – | **작성**(주 작성자) | – | – |
| EDU-005 개별화전환계획 ITP (EDU) | 열람(본인) | 열람+수정(구조적) | – | **작성**(청소년 전환기만) | – | – |
| MED-005 치료계획서 (MED) | 열람(본인) | 열람+수정(구조적) | 열람 | – | 열람 | **작성·수정**(주 작성자) |
| MED-006 회기일지 (MED) | 열람(본인) | 열람+수정(구조적) | 열람 | – | 열람 | **작성·수정**(주 작성자) |
| MED-007 평가보고서 (MED) | 열람(본인) | 열람+수정(구조적) | 열람 | – | 열람 | **작성·수정**(주 작성자) |
| WEL-004 ISP (WEL) | 열람(본인) | 열람+수정(구조적) | – | – | **작성·수정**(주 작성자) | – |
| WEL-005 서비스이용계획 (WEL) | 열람(본인) | 열람+수정(구조적) | – | – | **작성·수정**(주 작성자) | – |
| WEL-006 사례회의록 (WEL) | 열람(본인) | 열람+수정(구조적) | – | – | **작성**(주 작성자) | – |
| TRA-001 전환계획 (TRA) | 열람(본인) | 열람+수정(구조적) | – | **작성**(청소년 전환기 이상, TRA write 권한 보유 시) | **작성**(주 작성자) | – |
| LEG-001 후견감독보고서 (LEG) | 열람(본인) | 열람+수정(구조적) | – | – | **작성·수정**(주 작성자) | – |
| LEG-002 권익옹호 상담기록 (LEG) | 열람(본인) | 열람+수정(구조적) | – | – | **작성·수정**(주 작성자) | – |
| GEN-001 보호자메모 (선택도메인) | 열람(대상 시) | **작성·수정**(구조적, 도메인 무관) | – | – | – | – |

**범례**: 작성=write 권한으로 신규 기록만 / 작성·수정=edit 권한으로 신규+기존 수정 / 열람=해당 도메인 read 이상 보유로 SELECT만 가능(그 record_type 작성 폼은 앱이 제공하지 않음) / 구조적=`guardians` 관계 기반, 도메인·`permissions` 테이블과 무관하게 항상 전체 접근(F-G-04) / 본인=`author_id=person_id=자기 auth.uid()`로 한정된 self-branch.

**주의할 점 2가지**
1. **TRA-001과 특수교사**: §3-2 프리셋상 특수교사도 TRA write를 받을 수 있어(청소년 전환기 이상 조건부) DB RLS 자체가 특수교사의 TRA-001 INSERT를 막지 않는다는 점은 원래부터 사실이었다. 2026-07-17 이전에는 전환계획 작성 폼이 사회복지사 화면(W-16, `/records/transition/new`)에만 노출돼 이 경로가 실제로 쓰이지 않았으나, 같은 날 특수교사 화면(T 계열 `TeacherHome`)에도 동일 진입점을 추가해 앱 레이어 갭을 해소했다 — 서버 액션(`getTransitionPlanClients`/`createTransitionPlan`)은 원래 role을 가리지 않으므로 별도 teacher 전용 액션 없이 그대로 재사용된다. IEP 내 `transition_plan` 서브섹션(교육 목표 관점, `05-erd.md` §3 EDU-001)과는 별개 레코드다.
2. **보호자의 "구조적 전체"**: RLS는 record_type을 구분하지 않으므로 이론상 보호자는 IEP/ISP 같은 전문 기록도 DB 레벨에서 직접 쓸 수 있지만, 실제 보호자 전용 작성 화면(G-21)은 GEN-001(범용 기록)만 노출한다 — 전문 기록 폼은 해당 전문가 역할에만 제공된다. 단 보호자는 `createSelfExpressionForPerson`(2026-07-17 신설, `persons/[id]/records/express`)를 통해 SELF-001(자기표현)만은 당사자를 대신해 작성할 수 있다 — `author_id`는 항상 보호자 자신으로 pin되어(위조방지 마이그레이션 `p3_records_author_id_antiforge`) SELF-001 특유의 "본인 목소리" 자체를 대신 만들어내지는 못한다.
3. **LEG-001/002 연령 가드(2026-07-17)**: 후견감독보고서·권익옹호 상담기록은 성인기·노년기(만 19세 이상) 당사자에게만 작성할 수 있다(§3-1 생애주기 매트릭스와 정합). `records/leg/actions.ts`가 `isSelfConfirmingStage`로 서버 재검증하며, 위자드·폼도 그 이전 단계 당사자를 선택하면 작성을 차단한다 — TRA-001의 `isPreTransitionStage` 가드와 동형.

### 3-2-2. 기록유형 카탈로그 (2026-07-17 추가)

§3-2-1이 "누가 어떤 record_type을 쓰고 읽을 수 있는가"를 역할 축으로 정리한 표라면, 아래는 16개 기록유형 각각이 **무엇을 담는 기록인지**를 한 줄로 정리한 것이다. "주작성자"는 그 유형의 신규 작성을 실제로 수행하는 역할, "보조작성자"는 주작성자가 아니면서도 예외적으로 쓸 수 있는 경로(대리 작성·조건부 권한)를 뜻한다. content 필드 전체(서식)는 §3-2-3 참조.

| 분야 | 유형 | 기록명 | 기록설명 | 주작성자 | 보조작성자 | 열람가능자 |
|---|---|---|---|---|---|---|
| DAI | SELF-001 | 자기표현 | 당사자가 그날의 기분·식사·활동·건강 상태를 스스로 남기는 일일 기록. 음성 메모·식사 사진 첨부 가능. | 당사자(본인) | 보호자(대리 작성) | 보호자, 활동지원사, 특수교사, 치료사 |
| DAI | DAI-002 | 활동지원 일지 | 활동지원사가 방문 지원 내용·계획시간(사전)과 실적시간(사후)·식사·건강·특이사항을 기록. | 활동지원사 | – | 당사자(본인), 보호자, 특수교사, 치료사 |
| EDU | EDU-001 | IEP (개별화교육계획) | 특수교사가 5개 영역 현재 수준과 연간목표를 수립하는 공식 문서. 청소년기부터 전환계획 서브섹션 잠금 해제. | 특수교사 | – | 당사자(본인), 보호자 |
| EDU | EDU-002 | 관찰기록 | 특수교사의 일상 수업·행동·사회성 관찰 메모. IEP 목표 영역과 느슨하게(문자열 매칭) 연결 가능. | 특수교사 | – | 당사자(본인), 보호자 |
| EDU | EDU-003 | 행동중재계획 (BIP) | 특수교사가 문제행동의 기능(FBA 4분류)을 분석해 선행사건 전략·대체행동·강화계획·위기대응절차를 수립하는 공식 문서. | 특수교사 | – | 당사자(본인), 보호자 |
| EDU | EDU-005 | 개별화전환계획 (ITP) | 특수교사가 청소년 전환기(만 13~18세) 학생의 진로 흥미영역·현장실습 이력·성인기 인계메모를 관리하는 학교 단위 전환교육계획(2026-07-17 워크숍 채택). TRA-001(사회복지사, 성인기 로드맵)과 별개 레코드. | 특수교사 | – | 당사자(본인), 보호자 |
| MED | MED-005 | 치료계획서 | 치료사가 진단·치료 유형·영역별(신체/언어/인지/사회성) 장단기 목표와 회기 빈도를 수립하는 공식 문서. | 치료사 | – | 당사자(본인), 보호자, 활동지원사, 사회복지사 |
| MED | MED-006 | 회기 일지 | 치료계획서(MED-005)에 연결된 개별 회기의 진행 상황·영역별 점수·다음 회기 계획. | 치료사 | – | 당사자(본인), 보호자, 활동지원사, 사회복지사 |
| MED | MED-007 | 평가보고서 | 초기/중간/최종(initial/interim/final) 평가 시점의 영역별 점수와 종합 소견·권고사항. 동일 치료계획서 기준 3열 비교 가능. | 치료사 | – | 당사자(본인), 보호자, 활동지원사, 사회복지사 |
| WEL | WEL-004 | ISP (개별지원계획) | 사회복지사가 욕구·장벽 분석과 영역별 목표·연계 서비스·담당자·기한을 수립하는 공식 문서. | 사회복지사 | – | 당사자(본인), 보호자 |
| WEL | WEL-005 | 서비스 이용계획 | 현재 이용 중인 서비스 목록(제공기관·빈도·기간·상태)·월 비용·재원(예: 발달재활서비스 바우처)·다음 재검토일 관리. | 사회복지사 | – | 당사자(본인), 보호자 |
| WEL | WEL-006 | 사례회의록 | ISP 수립·재사정 시 다직종 사례회의의 논의 내용·결정사항을 기록(2026-07-17 워크숍 채택). 확인 절차 없이 저장, 당사자·보호자에게 일반 알림만 발송. | 사회복지사 | – | 당사자(본인), 보호자 |
| TRA | TRA-001 | 전환계획 | 탐색→계획→훈련→취업/자립 4단계 로드맵, 진로목표·자립생활계획·훈련 이력·연계기관을 관리하는 공식 문서. IEP의 전환계획 서브섹션과는 별개 레코드. | 사회복지사 | 특수교사(청소년기+, TRA 권한 보유 시 조건부) | 당사자(본인), 보호자 |
| LEG | LEG-001 | 후견감독보고서 | 성년후견인이 법원에 정기 제출하는 재산관리·신상보호 수행 현황을 사회복지사가 대신 기록하는 공식 문서. **성인기·노년기(만 19세+) 당사자에 한함.** | 사회복지사 | – | 당사자(본인), 보호자 |
| LEG | LEG-002 | 권익옹호 상담기록 | 인권침해·차별·학대의심 등 권익옹호 상담 이력과 취한 조치·연계 기관. **성인기·노년기(만 19세+) 당사자에 한함.** | 사회복지사 | – | 당사자(본인), 보호자 |
| 무관 | GEN-001 | 보호자 범용 기록 | 보호자가 도메인 제한 없이 자유 형식(제목+본문)으로 남기는 메모. 구조화 기록에 대한 보호자의 비파괴 편집(guardianNote)도 이 통로를 함께 쓴다. | 보호자 | – | 당사자(본인, 해당 시) |

**보조작성자가 존재하는 유형은 2개뿐이다** — SELF-001(보호자 대리 작성, `author_id`는 항상 보호자로 pin)과 TRA-001(특수교사, 청소년기 이상이고 TRA 작성권한을 보유해야만 조건부 활성화). 나머지 14개 유형은 한 역할이 전담 작성한다.

### 3-2-3. 기록유형별 서식 (전체 필드 스키마, 2026-07-18 추가)

§3-2-2가 "무엇을 담는 기록인지" 한 줄 요약이라면, 아래는 16개 기록유형 각각의 **실제 `content` JSONB 필드 구조 전체**다. `packages/validation/src/records.ts` Zod 스키마를 그대로 표로 옮겼다 — 필드명·타입·필수 여부까지 코드와 1:1 일치하며, 임의로 키 이름을 바꾸면 안 된다(§4-2 `docs/05-erd.md`와 동일 원칙). "필수"는 Zod의 실제 검증 규칙(min(1) 등)을 반영한다.

**SELF-001 자기표현** (DAI · camelCase 아님, snake_case 없음 — 단일 레벨)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `mood` | `'good'\|'neutral'\|'sad'\|'angry'` | 필수 | 오늘 기분 |
| `meal` | `'full'\|'partial'\|'none'` | 필수 | 식사 여부 |
| `meal_photo_url` | string(url) | 선택 | 식사 사진 |
| `activities` | `('exercise'\|'study'\|'craft'\|'social')[]` | 선택(기본 `[]`) | 오늘 한 활동(복수) |
| `health` | `'good'\|'sick'\|'tired'` | 필수 | 몸 상태 |
| `memo` | string(≤1000자) | 선택 | 자유 메모 |
| `voice_url` | string(url) | 선택 | 음성 메모(녹음 UI 미구현, 스키마만 존재) |

**DAI-002 활동지원 일지** (DAI · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `service_date` | string(YYYY-MM-DD) | 필수 | 서비스 일자 |
| `start_time` / `end_time` | string(HH:MM) | 필수 | 시작/종료 시간(종료＞시작 검증) |
| `scheduled_hours` | number(0~24) | 선택 | 계획(사전 일정) 시간 |
| `activities[]` | `{category, minutes(0~1440)}` | 선택 | 활동 항목별 소요 시간 |
| `health_status` | `'good'\|'sick'\|'tired'` | 필수 | 건강 상태 |
| `meal_status` | `'full'\|'partial'\|'none'` | 필수 | 식사 상태 |
| `incidents` | string(≤2000자) | 선택 | 특이사항 |
| `handover_note` | string(≤2000자) | 선택 | 인수인계 메모 |
| `reference_journal_id` | string(uuid) | 선택 | 이전 일지 참조 ID |
| (`service_hours`) | number | 서버 계산 | 실적 시간 — start/end로 서버가 자동 산출, 입력값 아님 |

**EDU-001 IEP (개별화교육계획)** (EDU · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `school` | string | 필수 | 학교명 |
| `academic_year` | string | 필수 | 학년도 |
| `meeting_date` | string(YYYY-MM-DD) | 필수 | IEP 회의 날짜 |
| `participants` | string[] | 선택 | 회의 참석자 |
| `current_levels` | `{korean,math,social,communication,self_care: string}` | 필수 | 5개 영역 현재 수준 |
| `annual_goals[]` | `{area, goal, short_term_goals[], achievement_rate?, evaluation_note?}` | 필수(1개+) | 연간 목표. `achievement_rate`·`evaluation_note`는 T-14 인라인 점검에서 채움 |
| ˪ `short_term_goals[]` | `{goal, period, evaluation}` | 선택 | 단기(분기) 목표 |
| `support_services[]` | `{service, provider, frequency}` | 선택 | 지원 서비스 목록 |
| `transition_plan` | `{goal, steps: string[]}` | 선택(청소년기+ 노출) | 전환계획 서브섹션 — EDU-005·TRA-001과는 별개 |

**EDU-002 관찰기록** (EDU · camelCase)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `observedAt` | string(ISO datetime) | 필수 | 관찰 일시 |
| `situation` | string | 필수 | 관찰 상황 |
| `tags` | string[] | 필수(1개+) | 행동/언어/사회성/학습 4카테고리×4개 태그 카탈로그에서 선택 |
| `note` | string(≤3000자) | 필수 | 관찰 내용 |
| `linkedGoalArea` | string | 선택 | 연결된 IEP 목표 영역 라벨(FK 아님, 문자열 매칭) |

**EDU-003 행동중재계획(BIP)** (EDU · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `target_behavior` | string(≤2000자) | 필수 | 중재 대상 행동 |
| `behavior_function` | `'attention'\|'escape'\|'sensory'\|'other'` | 필수 | 행동의 기능 |
| `fba_basis` | `('observation'\|'guardian_interview'\|'teacher_interview'\|'checklist')[]` | 선택 | 기능평가 근거(복수선택, 2026-07-17 추가) |
| `antecedent_strategies` | string(≤3000자) | 필수 | 선행사건 중재 전략 |
| `replacement_behavior` | string(≤2000자) | 필수 | 대체행동 |
| `reinforcement_plan` | string(≤3000자) | 필수 | 강화 계획 |
| `crisis_procedure` | string(≤3000자) | 선택 | 위기상황 대응절차 |
| `review_date` | string(YYYY-MM-DD) | 필수 | 재검토 예정일 |

**EDU-005 개별화전환계획(ITP)** (EDU · snake_case, 2026-07-18 신규)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `career_interest_areas` | string[] | 필수(1개+) | 진로 흥미영역 |
| `work_experience_log[]` | `{activity, period:{start,end}, note?}` | 선택 | 현장실습·직업체험 이력 |
| `next_step_note` | string(≤2000자) | 선택 | 성인기 인계 메모 — TRA-001 작성자(사회복지사) 참고 |
| `next_review_date` | string(YYYY-MM-DD) | 필수 | 다음 검토일 |

**MED-005 치료계획서** (MED · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `plan_period` | `{start,end: YYYY-MM-DD}` | 필수 | 치료 시작·종료일 |
| `diagnosis` | string | 필수 | 진단명 |
| `therapy_type` | `'physical'\|'occupational'\|'speech'\|'psychological'\|'other'` | 필수 | 치료 유형 |
| `goals[]` | `{area:'physical'\|'language'\|'cognitive'\|'social', long_term, short_term, target_score?(0~100)}` | 필수(1개+) | 치료 목표(영역별) |
| `session_frequency` | string | 필수 | 회기 빈도(예: "주 2회") |
| `responsible_therapist` | string | 필수 | 담당 치료사 |
| `precautions` | string(≤2000자) | 선택 | 주의사항 |

**MED-006 회기 일지** (MED · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `session_date` | string(YYYY-MM-DD) | 필수 | 회기 일자 |
| `therapy_plan_id` | string(uuid) | 필수 | 연결된 치료계획서 ID(자동 연결) |
| `session_number` | number(≥1) | 필수 | 회기 차수 |
| `planned_goals` | string[] | 선택 | 계획된 목표 |
| `actual_progress` | string | 필수 | 실제 진행 내용 |
| `domain_scores` | `{physical,language,cognitive,social: 0~100}` | 필수 | 영역별 달성도(고정 키 객체 — MED-007과 형태 다름) |
| `observations` | string | 필수 | 관찰 내용 |
| `next_session_plan` | string(≤2000자) | 선택 | 다음 회기 계획 |

**MED-007 평가보고서** (MED · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `eval_type` | `'initial'\|'interim'\|'final'` | 필수 | 평가 시점 구분 |
| `eval_date` | string(YYYY-MM-DD) | 필수 | 평가 일자 |
| `therapy_plan_id` | string(uuid) | 필수 | 연결된 치료계획서 ID(자동 연결) |
| `domain_scores[]` | `{domain:'physical'\|'language'\|'cognitive'\|'social', score:0~100}` | 필수(1개+) | 평가 영역별 점수(배열 — MED-006과 다른 형태, 재사용 금지) |
| `summary` | string(≤3000자) | 필수 | 종합 평가 요약 |
| `recommendations` | string(≤2000자) | 선택 | 권고사항 |

**WEL-004 ISP (개별지원계획)** (WEL · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `service_period` | `{start,end: YYYY-MM-DD}` | 필수 | 지원 시작·종료일 |
| `reassessment_date` | string(YYYY-MM-DD) | 필수 | 재사정 예정일(D-30 경고 배지 기준) |
| `case_manager` | string | 필수 | 담당자 |
| `assessment_tool` | string | 선택 | 사정 도구/근거 |
| `needs[]` | `{area, needs, barriers}` | 선택 | 욕구사정 항목 |
| `goals[]` | `{area, long_term, short_term, responsible, deadline, achievement_rate?(0~100)}` | 필수(1개+) | 목표. `achievement_rate`는 W-14 인라인 점검에서 채움 |
| `services[]` | `{service, provider, frequency, start}` | 선택 | 연계 서비스 |

**WEL-005 서비스 이용계획** (WEL · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `services[]` | `{service_name, provider, frequency, start_date, end_date?, status:'active'\|'paused'\|'ended'}` | 선택 | 이용 서비스 목록 |
| `monthly_cost` | number | 선택 | 월 비용 |
| `funding_source` | string | 선택 | 재원(예: 발달재활서비스 바우처) |
| `case_manager` | string | 필수 | 담당자 |
| `next_review_date` | string(YYYY-MM-DD) | 필수 | 다음 검토일 |

**WEL-006 사례회의록** (WEL · camelCase, 2026-07-18 신규)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `meetingDate` | string | 필수 | 회의 일시(record_date로도 사용) |
| `participants` | string[] | 필수(1명+) | 참석자 |
| `discussion` | string(≤3000자) | 필수 | 논의 내용 |
| `decisions` | string(≤2000자) | 선택 | 결정사항 |

**TRA-001 전환계획** (TRA · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `roadmap_stage` | `'exploration'\|'planning'\|'training'\|'employment'` | 필수 | 로드맵 4단계 |
| `career_goal` | string | 필수 | 희망 진로 |
| `independent_living_plan` | string(≤2000자) | 선택 | 자립생활계획 |
| `training_records[]` | `{program, provider, period:{start,end}, status:'planned'\|'ongoing'\|'completed'}` | 선택 | 훈련 이력 |
| `linked_agencies` | string[] | 선택 | 연계 기관 |
| `case_manager` | string | 필수 | 담당자 |
| `next_review_date` | string(YYYY-MM-DD) | 필수 | 다음 검토일 |

**LEG-001 후견감독보고서** (LEG · snake_case, 성인기·노년기 전용)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `report_kind` | `'initial'\|'periodic'` | 선택(기본 `periodic`) | 최초 재산목록보고 / 정기 후견사무보고 구분(2026-07-17 추가) |
| `report_period` | `{start,end: YYYY-MM-DD}` | 필수 | 보고 대상 기간 |
| `guardian_type` | `'adult'\|'limited'\|'specific'\|'voluntary'` | 필수 | 후견 유형(성년/한정/특정/임의) |
| `guardian_name` | string | 필수 | 후견인 성명 |
| `property_management_summary` | string(≤3000자) | 필수 | 재산관리 현황 요약 |
| `personal_care_summary` | string(≤3000자) | 필수 | 신상보호 현황 요약 |
| `incidents` | string(≤2000자) | 선택 | 특이사항 |
| `next_report_due` | string(YYYY-MM-DD) | 필수 | 다음 보고 예정일 |

**LEG-002 권익옹호 상담기록** (LEG · camelCase, 성인기·노년기 전용)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `consultedAt` | string | 필수 | 상담 일시(record_date로도 사용) |
| `issueType` | `'rights_violation'\|'discrimination'\|'abuse_suspected'\|'other'` | 필수 | 상담 유형 |
| `content` | string(≤3000자) | 필수 | 상담 내용 |
| `actionTaken` | string(≤2000자) | 선택 | 취한 조치 |
| `referralAgency` | string | 선택 | 연계 기관 |

> `issueType='abuse_suspected'` 확인 시 실제 신고 의무 워크플로우는 이 record_type 범위 밖(F-LEG-11로 별도 분리, 법률 자문 대기 — §3-2-2 참조).

**GEN-001 보호자 범용 기록** (도메인 무관 · snake_case)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `domain` | `'MED'\|'EDU'\|'WEL'\|'DAI'\|'TRA'\|'LEG'` | 필수 | 작성 시 보호자가 선택하는 도메인 |
| `title` | string(≤200자) | 필수 | 제목 |
| `body` | string(≤5000자) | 필수 | 내용 |

> 구조화 기록 비파괴 편집 시 병합되는 별도 서브키(`content.guardianNote`, GEN-001 자체 스키마 아님): `{ title: string, body: string, editedAt: string }`.

> **출처**: 위 서식 전부 `packages/validation/src/records.ts`의 Zod 스키마 원문과 1:1 대응(2026-07-18 기준). 코드가 변경되면 이 표도 함께 갱신해야 한다 — 신뢰 소스는 항상 `records.ts`.

### 3-3. 권한 관리 라이프사이클 — 부여·수정·회수·감사

| 단계 | 트리거 | 처리 | 관련 화면/테이블 |
|---|---|---|---|
| 부여(Grant) | 보호자가 G-32 위자드 완료 | §3-2 프리셋 자동 채움(수정 가능) → `permissions` INSERT + `permission_logs`(action:`grant`) → 대상자 알림 | G-32, `permissions`, `permission_logs` |
| 수정(Modify) | G-30 매트릭스 셀 클릭 | 회색→read→write→edit→회색 순환, 저장 시 diff를 `permission_logs`(action:`update`)에 기록. **상향 변경 시만** 대상자 알림 | G-30, `permission_logs` |
| 즉시 회수(Revoke) | 보호자가 셀을 회색으로 되돌림, 계약종료·이해상충 발생 | `is_active=false` 즉시 반영 + Redis 권한 캐시 무효화(NF-SEC-05) → RLS 즉시 재평가 | G-30, `permissions`, Redis |
| 자동 만료(Expiry) | `valid_until` 도래 | 매일 cron이 만료 대상 스캔 → `is_active=false` 일괄 처리, D-7 시점 `ValidityBadge`(amber) 사전 경고 | cron, `ValidityBadge` |
| 이탈 시 일괄 회수 | 사용자의 소속·역할 변경 | 해당 `grantee_id`의 관련 `permissions` 전체 일괄 회수 배치 | 신규 워크플로우 (§ `04-workflow.md` 확장 권장) |
| 감사(Audit) | 정기(분기별) 또는 상시 | `permission_logs` × `access_logs` 교차 조회로 미사용 권한·과다 권한 탐지 후 보호자에게 요약 알림 | G-40, `permission_logs`, `access_logs` |

**정책 가드레일**: `edit` 수준은 항상 유효기간 필수(무기한 지양) · 모든 변경은 `permission_logs`에 불변 기록 · 회수는 Redis 캐시 무효화와 원자적으로 처리(NF-SEC-05).

### 3-4. 기록 확인(Confirmation) 절차 — "승인"이 아니라 "확인"

전문가(교사·사회복지사·치료사 등)가 작성 권한을 갖고 기록을 완성하는 구조는 그대로 유지하되, 보호자·당사자가 공식 문서의 존재와 내용을 **인지했음을 남기는 절차**를 추가한다. 반려·차단 기능은 없다 — 이견이 있으면 별도로 정정을 요청한다(§ 관련 커뮤니케이션은 인수인계·알림 재사용).

| 항목 | 결정 |
|---|---|
| 용어 | **확인**(사용 안 함: 승인) — 인수인계(`handover_notes.acknowledged_at`)와 동일한 "읽었음/인지함" 수준 |
| 대상 기록 | IEP, ISP, 치료계획서, 전환계획 등 공식 문서(`requires_confirmation=true`, 기본값은 `05-erd.md` §4-6 참조) — 관찰기록·일지 등 일상 기록은 제외 |
| 확인 주체 | 생애주기 단계(§3-1) 기준: `child`/`youth`는 주보호자, `adult`는 본인(당사자) — 자기결정권 반영 |
| 차단 여부 | 확인 대기 상태여도 기록은 이미 확정 상태(제출 완료)이며 열람·활용에 제약 없음. 확인은 참고용 상태 표시일 뿐 |
| 재확인 요청 | 기록 수정(G-21 등, `edit` 권한) 시 `confirmed_at`을 다시 `NULL`로 초기화해 재확인 필요 상태로 전환 (`trg_reset_confirmation_on_edit`, `05-erd.md` §4-6④) |

---

## 4. 플랫폼 구성

| 구성 | 기술 | 역할 |
|------|------|------|
| 반응형 웹 | Next.js (App Router) | 전체 역할 지원, 관리 기능 |
| 모바일 앱 | React Native (Expo) | 현장 중심 기록, 당사자 접근성 최우선 |
| 백엔드·DB | Supabase (PostgreSQL + RLS) | 데이터 저장, 인증, 파일 스토리지 |

---

## 5. 핵심 기능 요구사항 (Functional Requirements)

### 5-1. 인증·온보딩

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| F-AUTH-01 | 이메일+비밀번호 로그인 | P0 |
| F-AUTH-02 | 카카오/네이버 OAuth | P2 |
| F-AUTH-03 | 역할 선택 후 회원가입 (6역할) | P0 |
| F-AUTH-04 | PIPA §22 필수/선택 동의 분리 수집 | P0 |
| F-AUTH-05 | 이메일 인증 | P0 |
| F-AUTH-06 | 초대 링크 수락 (`/invite/:token`) | P1 |
| F-AUTH-07 | 비밀번호 재설정 | P1 |
| F-AUTH-08 | PIPA §23 민감정보(장애·건강) 별도 동의 | P0 |

#### 5-1-1. F-AUTH-02 소셜 OAuth 상세 (카카오·네이버)

> 설계 확정일 2026-07-15. 실제 구현(Route Handler·콜백·UI 버튼)은 후속 라운드로 분리. Supabase가 카카오·네이버를 네이티브 external provider로 지원하지 않아 provider별 통합 경로가 비대칭이다.

**지원 provider 및 인증 방식**

| Provider | 방식 | 근거 | Supabase 연동 경로 |
|----------|------|------|-------------------|
| 카카오 | **OpenID Connect (OIDC)** | 카카오 로그인은 OIDC를 지원(`.well-known/openid-configuration`, `id_token` 발급) | GoTrue **Custom OIDC provider** 등록 또는 `signInWithIdToken({ provider: 'kakao', token: id_token })` 패턴. `config.toml [auth.external.*]` 표준 목록에 없으므로 커스텀 OIDC로 붙인다 |
| 네이버 | **순수 OAuth2 Authorization Code** (커스텀 브리지) | 네이버는 표준 OIDC discovery 엔드포인트·`id_token`을 제공하지 않음 | Supabase 표준/커스텀 OIDC로 붙지 않음. **자체 콜백 Route Handler**가 인가코드를 `access_token`으로 교환 → `/v1/nid/me`로 프로필 조회 → 서비스 롤로 `admin.createUser`(신규) 후 `admin.generateLink`(magiclink/OTP) 또는 동등 패턴으로 세션을 성립시키는 **브리지**가 필요 |

**신규/기존 계정 판별 기준**

1. **1차 키 — provider 고유 ID**: 계정 동일성의 신뢰 소스는 이메일이 아니라 provider가 발급하는 안정적 고유 식별자(`kakao_sub`, `naver_id`)다. `users.oauth_subject`(§05-erd §2-1)에 저장하고, 로그인 시 `(auth_provider, oauth_subject)` 조합으로 기존 계정을 조회한다.
2. **2차 참고 — 이메일 매칭**: provider가 이메일을 제공하고 그 이메일이 기존 `email` 로그인 계정과 일치하면 **자동 계정 연결(account linking)을 하지 않는다** — 소셜 계정 탈취를 통한 기존 계정 접근을 차단하기 위함. 대신 "이미 이메일로 가입된 계정이 있습니다. 이메일 로그인 후 설정에서 소셜 연결하세요"로 안내(계정 연결은 로그인 상태에서만 허용, 별도 후속 기능).
3. **이메일 미제공 케이스**: 카카오·네이버는 사용자가 이메일 제공에 동의하지 않으면 이메일을 주지 않는다. 이 경우 `users.email`은 provider 고유 ID 기반 placeholder(예: `kakao_<sub>@oauth.ongil.local`)로 채우되 `email_verified=false`로 표시하고, 최초 온보딩에서 실제 이메일 입력(선택)을 유도한다. `email UNIQUE NOT NULL` 제약은 placeholder로 충족한다.

**최초 로그인 온보딩 (Flow-0 재사용)**

- 콜백에서 `(auth_provider, oauth_subject)`로 조회 → **기존 사용자면 역할별 홈 직행**, **신규면 A-03 역할 선택부터** 기존 위저드에 재진입한다.
- OAuth 신규 사용자는 계정이 이미 provider 인증으로 생성되므로 **A-04 기본 정보(이메일·비밀번호) 단계와 A-05 이메일 OTP 인증 단계를 건너뛴다.** 재사용 단계는 **A-03 역할 선택 → A-08 동의 수집(PIPA §22/§23)** 뿐이다.
- **PIPA 동의 시점 이동**: 기존 이메일 위저드는 `verifyEmailOtp`(세션 확보 후)에서 consents를 INSERT한다. OAuth는 OTP 단계가 없고 콜백에서 이미 세션이 확보되므로, **동의 INSERT를 A-08 제출 시점(세션 존재)으로 옮긴 전용 완료 액션**이 필요하다(`(auth)/actions.ts` 후속 구현).
- **role=person 셀프 가입 인바리언트**: OAuth로 `role=person`을 선택한 사용자도 셀프 가입 당사자 모델(`persons.id = primary_guardian_id = auth.uid()`)을 그대로 따른다. 최초 온보딩 완료 시 이 인바리언트로 `persons` 행을 생성해야 하며, provider 경로와 무관하게 동일하게 적용한다.

### 5-2. 당사자 (Person)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| F-P-01 | 자기표현 4단계 위자드 (기분/식사/활동/건강) | P0 |
| F-P-02 | 오늘 기록 홈 — 최근 7일 이모지 달력 | P0 |
| F-P-03 | 기록 보기 — 분야별 색상 카드 2열 그리드 | P1 |
| F-P-04 | 아이콘 72×72px, 터치 타겟 56×56px (접근성) | P0 |
| F-P-05 | 만 18세 성년 도달 시 본인 동의 전환 (P-23) | P1 |
| F-P-06 | 고대비 모드, 폰트 20px+ | P0 |
| F-P-07 | 생애주기 단계 전환 알림 수신 (만 14세 전환기 진입, 만 18세 성년 전환) | P2 |
| F-P-08 | 성년기 본인 기록 확인 — IEP/ISP/치료계획서 등 확인 대기 목록·확인 처리 (§3-4) | P2 |

### 5-3. 보호자 (Guardian)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| F-G-01 | 당사자 등록 6단계 위자드 (기본정보·동의·장애·응급·사진·확인) | P0 |
| F-G-02 | PersonCard 슬라이더 — 복수 당사자 맥락 전환 | P0 |
| F-G-03 | 생애주기 타임라인 — 스트림 뷰 / 레인 뷰 전환 | P1 |
| F-G-04 | 기록 직접 작성·수정 (G-21) — `guardians` 관계 기반 전 도메인 구조적 접근, `permissions` 부여 여부 무관 | P1 |
| F-G-05 | 권한 부여 4단계 위자드 (대상자·도메인·수준·확인, §3-2 역할별 프리셋 자동 채움) | P0 |
| F-G-06 | 권한 매트릭스 — 이해관계자 × 도메인 테이블 (§3-3 부여·수정·회수 라이프사이클) | P0 |
| F-G-07 | 접근 로그 조회 — 누가 언제 어떤 기록 접근했는지 | P1 |
| F-G-08 | PIPA 권리행사 창구 — 동의 철회, 데이터 내보내기 | P1 |
| F-G-09 | 생애주기 단계 전환 알림 수신 및 대응(성년 전환 시 동의 이관 확인) | P2 |
| F-G-10 | 권한 감사 알림 — 미사용/만료임박/과다권한 요약 정기 알림(§3-3 감사) | P2 |
| F-G-11 | 기록 확인 대기 목록·확인 처리 (아동기·청소년 전환기 당사자 대상, §3-4) | P2 |

### 5-4. 활동지원사 (Supporter)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| F-S-01 | 활동지원 일지 5단계 위자드 (서비스정보·활동·건강·특이사항·확인) | P0 |
| F-S-02 | 인수인계 생성·확인 (`acknowledged_at` 기록) | P1 |
| F-S-03 | 이전 일지 참조 패널 | P1 |
| F-S-04 | 서비스 시간 자동 계산 | P0 |
| F-S-05 | 임시저장 기능 | P1 |

### 5-5. 특수교사 (Teacher)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| F-T-01 | IEP 작성 6단계 위자드 | P1 |
| F-T-02 | IEP 점검 — Split Pane 목표 편집 | P1 |
| F-T-03 | 관찰 기록 — obs-tag 복수 선택 | P1 |
| F-T-04 | 전환교육계획 4단계 위자드 | P2 |
| F-T-05 | 담당 학생 카드 목록 홈 | P1 |
| F-T-06 | 학생 만 14세 도달 시 IEP 전환계획 섹션 자동 활성화 알림 | P2 |

### 5-6. 사회복지사 (Social Worker)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| F-W-01 | ISP 작성 5단계 위자드 | P1 |
| F-W-02 | ISP 점검 — 목표별 달성률 프로그레스 바 | P1 |
| F-W-03 | 전환계획 로드맵 수평 뷰 | P2 |
| F-W-04 | 재사정 D-day 경고 배너 | P1 |
| F-W-05 | 서비스 이용 현황 테이블 (ST-07) | P1 |

### 5-7. 치료사 (Therapist)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| F-TH-01 | 치료계획서 작성 5단계 위자드 | P1 |
| F-TH-02 | 회기 일지 — 치료계획 자동 연결 | P1 |
| F-TH-03 | 평가보고서 3열 비교 뷰 (초기/중간/최종) | P2 |
| F-TH-04 | 신체·언어·인지·사회성 달성도 체크 | P1 |

### 5-8. 공통 기능

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| F-CMN-01 | 랜딩페이지 (9개 섹션) | P0 |
| F-CMN-02 | 생애주기 타임라인 (PinnedCard·MilestoneCard·DraftBadge) | P1 |
| F-CMN-03 | FCM 푸시 알림 | P2 |
| F-CMN-04 | Resend 이메일 알림 | P2 |
| F-CMN-05 | 파일 첨부 (Supabase Storage + Presigned URL) | P1 |
| F-CMN-06 | 오프라인 임시저장 (모바일 AsyncStorage) | P2 |
| F-CMN-07 | 생애주기 단계 배지(StageBadge) 표시 및 타임라인 단계 필터 | P2 |
| F-CMN-08 | 기록 확인 배지(ConfirmBadge)·확인 CTA — 공식 문서 제출 시 확인 대기 상태 노출 (§3-4) | P2 |

---

## 6. 비기능 요구사항 (Non-Functional Requirements)

### 6-1. 보안

| ID | 요구사항 |
|----|---------|
| NF-SEC-01 | PostgreSQL RLS — 모든 테이블에 행 수준 보안 정책 강제 |
| NF-SEC-02 | auth.uid() 기반 RLS, permissions 테이블 JOIN 도메인 접근 제어 |
| NF-SEC-03 | Presigned URL — 파일 접근 만료 시간 제한 |
| NF-SEC-04 | `access_logs` 테이블 — 전체 접근 이력 불변 보관 |
| NF-SEC-05 | Redis 권한 캐시 — TTL 기반 만료, 변경 시 즉시 무효화 |
| NF-SEC-06 | `.env.local` 크리덴셜 관리, FCM 서비스 계정 git 금지 |
| NF-SEC-07 | 권한 부여·수정·회수 전건 `permission_logs` 불변 기록, `edit` 수준은 유효기간 필수(§3-3) |

### 6-2. 개인정보 (PIPA)

| 조항 | 구현 요구사항 |
|------|-------------|
| §22 | 필수/선택 분리 체크박스, 일괄 동의 금지, `consents` 테이블 분리 INSERT |
| §23 | 민감정보(장애·건강) 처리 시 별도 동의 |
| §24 | 고유식별정보 입력 전 별도 동의 |
| §35-2 | 데이터 내보내기 기능 |
| §5 | 약관·개인정보처리방침 정적 페이지 |

### 6-3. 접근성 (WCAG 2.1)

| 기준 | 일반 모드 | 당사자 모드 |
|------|---------|-----------|
| 텍스트 대비비 | AA (4.5:1) | AAA 목표 (7:1) |
| 포커스 인디케이터 | 2px solid #1D9E75 | 동일 |
| 터치 타겟 | 44×44px | 56×56px |
| 폼 레이블 | useId() htmlFor/id 쌍 | 대형 레이블 |

### 6-4. 성능

| 항목 | 기준 |
|------|------|
| 웹 LCP | < 2.5s (Core Web Vitals) |
| 모바일 앱 초기 로딩 | < 3s |
| API 응답 (P95) | < 500ms |
| 타임라인 페이지네이션 | 무한 스크롤 (cursor-based) |

---

## 7. 구현 우선순위 로드맵

### Phase 0 — 기반 인프라 (미착수 — 실행 계획은 `06-wbs.md` P0-1~P0-7 참조)

- Supabase 프로젝트 설정 + RLS 활성화
- 모노레포 구조 (pnpm workspaces)
- 13개 테이블 Prisma 스키마 + 마이그레이션
- 인증 (이메일 + OAuth)
- 미들웨어 역할별 라우트 가드
- records-attachments 스토리지 버킷

### Phase 1 — 핵심 플로우 (P0)

| 항목 | 설명 |
|------|------|
| 랜딩페이지 | `apps/web/src/app/(public)/` — 9개 섹션 |
| 당사자 자기표현 | `apps/mobile/.../express` — 4단계 위자드 |
| 활동지원 일지 | `apps/web/.../journals/new` — 5단계 위자드 |
| 보호자 대시보드 | `apps/web/.../dashboard` + PersonCard 슬라이더 |
| 권한 부여 위자드 | `apps/web/.../permissions/grant` — 4단계 |
| RLS 정책 검증 | `supabase/` — pgTAP 전체 역할 검증 |

### Phase 2 — 기록 폼 (P1)

IEP·치료계획서·회기일지·ISP·전환계획·타임라인·접근 로그·인수인계

### Phase 3 — 고도화 (P2)

평가보고서·전환계획 로드맵·FCM·오프라인 저장·Redis 캐시·Sentry·OAuth

---

## 8. 기술 스택

| 레이어 | 기술 |
|--------|------|
| 웹 프론트 | Next.js (App Router) · TypeScript (strict) · Tailwind CSS |
| 모바일 | React Native (Expo) |
| 백엔드·DB | Supabase (PostgreSQL + RLS) · Prisma |
| 인증 | 이메일·비밀번호 + 카카오/네이버 OAuth |
| 스토리지 | Supabase Storage + Presigned URL |
| 서버 상태 | TanStack Query |
| 폼 검증 | React Hook Form + Zod |
| UI 컴포넌트 | shadcn/ui |
| 알림 | FCM(푸시) · Resend(이메일) |
| 모노레포 | pnpm workspaces |
| CI/CD | GitHub Actions · Vercel · EAS Build |
| 모니터링 | Sentry |
| 캐시 | Redis (P1) |

---

## 9. 성공 지표 (KPI)

| 지표 | 목표 |
|------|------|
| 초기 가입 당사자 수 | 3,200명 |
| 지원 도메인 | 6개 |
| 지원 역할 | 6개 |
| RLS 정책 커버리지 | 100% |
| WCAG 준수 | AA 이상 (당사자: AAA 목표) |
