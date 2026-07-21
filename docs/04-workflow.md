# 온길 Workflow — 사용자·기능별 워크플로우

> 버전: v1.1 | 작성일: 2026-07-07 | 최종 개정: 2026-07-09 (CLAUDE.md 변경 이력 참조)
> 참조: `1 Plan/ongil-platform-blueprint.md` §4, §11

---

## 1. 인증·온보딩 워크플로우

### Flow-0: 신규 회원가입

```
[랜딩 A-01]
    │  [시작하기] 클릭
    ▼
[역할 선택 A-03]  ← 6개 역할 중 1개 선택
    │
    ▼
[기본 정보 A-04]  ← 이름, 이메일, 비밀번호
    │
    ▼
[동의 수집 A-08]  ← PIPA §22
    │  ├── [필수] 이용약관 ─────────────────▶ A-09 전문
    │  ├── [필수] 개인정보 수집·이용
    │  ├── [선택] 마케팅·알림
    │  └── [고지] 위탁·국외이전
    ▼
[이메일 인증 A-05]  ← 6자리 OTP 확인
    │
    ▼
[역할별 홈 진입]  ← middleware.ts 라우팅
```

### Flow-0-S: 소셜 OAuth 로그인·가입 (F-AUTH-02, P2)

랜딩(A-01)·로그인(A-02)에 카카오·네이버 버튼을 노출한다. 이메일 위저드의 A-04(기본정보)·A-05(이메일 OTP)를 **건너뛰고** A-03(역할)·A-08(동의)만 재사용한다. provider별 인증 경로가 비대칭이다(`01-prd.md` §5-1-1).

```
[랜딩 A-01 / 로그인 A-02]
    │  [카카오로 시작] / [네이버로 시작] 클릭
    ▼
┌─ 카카오: OIDC 인가 ──────────────┐   ┌─ 네이버: OAuth2 인가코드 ─────────┐
│ GoTrue Custom OIDC /             │   │ 자체 콜백 Route Handler가          │
│ signInWithIdToken(id_token)      │   │ code→access_token 교환 → 프로필    │
│                                  │   │ 조회 → admin.createUser+generateLink│
└──────────────┬───────────────────┘   └──────────────┬────────────────────┘
               ▼  (세션 확보 = auth.uid() 존재)         ▼
        [OAuth 콜백 처리 A-11]
               │  (auth_provider, oauth_subject)로 users 조회
               ├── [기존 사용자] ───────────────────────▶ [역할별 홈 진입]
               │
               └── [신규 사용자]
                        ▼
                 [역할 선택 A-03]   ← 이메일 위저드 재사용, 단 invite 고정 시 스킵
                        ▼
                 (A-04 기본정보 · A-05 이메일 OTP 스킵 — provider가 이미 인증)
                        ▼
                 [동의 수집 A-08]   ← PIPA §22/§23, 세션 존재하므로 consents 즉시 INSERT
                        │              (이메일 경로처럼 OTP까지 미루지 않음)
                        ▼
                 [role=person이면 persons 셀프 생성]
                        │              persons.id = primary_guardian_id = auth.uid()
                        ▼
                 [역할별 홈 진입]
```

**설계 주석**

- **이메일 미제공**: 카카오·네이버가 이메일 미동의 시, `users.email`을 provider ID placeholder로 채우고 온보딩에서 실제 이메일 입력(선택)을 유도(`01-prd.md` §5-1-1).
- **계정 연결 금지**: 소셜 이메일이 기존 이메일 계정과 일치해도 자동 연결하지 않고 이메일 로그인으로 안내한다(탈취 방지).
- **초대(invite) 연동**: A-06에서 온 소셜 가입은 role이 고정되므로 A-03을 스킵하고 A-08 동의만 받은 뒤 `accept_invitation` RPC로 권한 전개.

### Flow-1: 이해관계자 초대 수락

```
보호자가 [권한 부여 위자드 G-32] 완료
    │  → 초대 이메일 발송 (Resend)
    ▼
[초대 이메일] → [초대 링크 클릭]
    │
    ▼
[초대 링크 수락 A-06]  ← token 검증
    │  (미가입자) → 역할 고정 회원가입 Flow-0
    │  (기가입자) → 권한 자동 연결
    ▼
[해당 역할 홈]
```

---

## 2. 보호자 워크플로우

### Flow-G-01: 당사자 등록 (6단계)

```
[대시보드 G-01] → [+ 당사자 추가]
    │
    ▼
[Step 1/6] 기본 정보 — 이름, 생년월일, 성별
    ▼
[Step 2/6] 민감·고유식별 동의  ← PIPA §23 별도 동의 (장애·건강정보)
    ▼
[Step 3/6] 장애 정보 — 유형(복수), 정도
    ▼
[Step 4/6] 응급 정보 — 알레르기, 금기약물, 비상연락처
    ▼
[Step 5/6] 프로필 사진 — 카메라/갤러리
    ▼
[Step 6/6] 확인 — 미리보기, 수정 링크
    │
    ▼
persons 테이블 INSERT
    ▼
[대시보드 G-01] — PersonCard 슬라이더에 새 당사자 추가
```

### Flow-G-02: 권한 부여 (4단계)

```
[권한 관리 G-30] → [+ 권한 부여]
    │
    ▼
[Step 1/4] 대상자 선택 — 이메일 검색 또는 초대 링크 생성
    ▼
[Step 2/4] 도메인 선택 — MED/EDU/WEL/DAI/TRA/LEG (복수 선택)
    ▼
[Step 3/4] 수준 설정 — read/write/edit × 기간(시작~종료, 무기한 토글)
    ▼
[Step 4/4] 확인 미리보기
    │
    ▼
permissions 테이블 UPSERT
    ▼
초대 이메일 발송 (미가입자일 경우)
```

### Flow-G-03: 타임라인 조회

```
[타임라인 G-10]
    │
    ├── [스트림 뷰 탭]  ← 날짜 역순, 도메인 chip
    │       │  무한 스크롤 (cursor-based)
    │       │  PinnedCard 항상 최상단
    │
    └── [레인 뷰 탭]  ← repeat(6, 1fr) CSS Grid
            │  MED | EDU | WEL | DAI | TRA | LEG 수직 컬럼
```

---

## 3. 당사자 워크플로우

### Flow-P-01: 오늘 자기표현 기록

```
[오늘 기록 홈 P-01]
    │  미완료 상태 → 대형 CTA "오늘 기록하기"
    │
    ▼
[자기표현 4단계 P-02]
    │
    Step 1/4: 기분 선택 (아이콘 72×72px)
    Step 2/4: 식사 상태 + 📷 사진 선택
    Step 3/4: 오늘 활동 선택 (복수)
    Step 4/4: 건강 상태 + 📝 메모 또는 🎙 음성
    │
    ▼
records 테이블 INSERT (domain=DAI, type=SELF-001)
    │
    ▼
✨ 저장 애니메이션 (2초) → P-01 복귀
    │
    ▼
[최근 7일 이모지 달력] — 오늘 기록 완료 표시
```

---

## 4. 활동지원사 워크플로우

### Flow-S-01: 활동지원 일지 작성 (5단계)

```
[홈 S-01] → [일지 작성]
    │
    ▼
[Step 1/5] 서비스 정보
    │  날짜 (오늘 자동 세팅)
    │  시작 시간 입력
    ▼
[Step 2/5] 활동 내역
    │  카테고리 복수 선택 (가사/외출/목욕/여가...)
    │  소요 시간 입력
    │  [이전 일지 참조 패널] — 직전 기록 자동 로드
    ▼
[Step 3/5] 건강·식사 (IconSelector 변형)
    │  건강 상태 / 식사 상태 / 수분 섭취
    ▼
[Step 4/5] 특이사항
    │  행동 관찰 자유 텍스트
    │  사고 체크박스 (발생 시 필수 메모)
    │  인계 사항 (없으면 [건너뛰기])
    ▼
[Step 5/5] 확인·제출
    │  종료 시간 입력 → 서비스 시간 자동 계산
    │  [임시저장] or [제출]
    ▼
records 테이블 INSERT (domain=DAI, type=DAI-002)
    ▼
인계인수 작성 여부 선택 → Flow-S-02
```

### Flow-S-02: 인계인수

```
[인계인수 S-20]
    │
    ├── [받은 인계 탭] — 미확인 우선 정렬
    │       → "확인했습니다" CTA → acknowledged_at 기록
    │
    └── [보낸 인계 탭] / [+ 인계인수 작성]
            → 대상 당사자, 내용, 중요도 입력
            → handover_notes 테이블 INSERT
            → 다음 지원사에게 FCM 알림
```

---

## 5. 특수교사 워크플로우

### Flow-T-01: IEP 작성 (6단계)

```
[홈 T-01] → 학생 카드 선택 → [IEP 작성 T-13]
    │
    Step 1/6: 기본 정보 (학교, 학년도, 회의일, 참석자)
    Step 2/6: 현재 수준 영역별 기술 입력
    Step 3/6: 연간 목표 + 단기 목표(3개월) + 평가 방법
    Step 4/6: 지원 서비스
    Step 5/6: 전환 계획 (만 14세+ 활성)
    Step 6/6: 확인 저장
    │
    ▼
records INSERT (domain=EDU, type=EDU-001)
    ▼
보호자에게 알림 (Resend 이메일)
```

### Flow-T-02: IEP 점검

```
[IEP 목록] → [IEP 점검 T-14]
    │
    Split Pane:
    좌: 영역별 목표 목록 (달성률 프로그레스)
    우: 선택 목표 인라인 편집
        + 참조 패널: 이전 IEP 버전, 관찰기록 연결
    │
    ▼
records 업데이트 (달성률, 목표 수정)
```

---

## 6. 사회복지사 워크플로우

### Flow-W-01: ISP 작성 (5단계)

```
[홈 W-01] → 당사자 카드 선택 → [ISP 작성 W-13]
    │
    Step 1/5: 기본 정보 (서비스 기간, 재사정일, 담당자)
    Step 2/5: 욕구 평가 — 영역별 욕구 및 장애물
    Step 3/5: 목표 설정 — 단기/장기 목표, 담당자, 일정
    Step 4/5: 서비스 연계 — 제공 서비스 기관·내용·횟수
    Step 5/5: 확인 저장
    │
    ▼
records INSERT (domain=WEL, type=WEL-004)
    ▼
재사정일 캘린더 등록 → D-30, D-7 알림 예약
```

### Flow-W-02: ISP 점검

```
[ISP 점검 W-14]
    │  재사정 D-day 경고 배너 (valid_until 기반)
    │
    Split Pane:
    좌: 목표 영역 목록 + 달성률 bar
    우: 목표 상세, 서비스 현황, 달성률 업데이트
```

---

## 7. 치료사 워크플로우

### Flow-TH-01: 회기 일지 작성

```
[홈 TH-01] → 오늘 회기 스케줄 카드 → [회기 일지 작성 TH-15]
    │
    현재 치료계획서 자동 연결
    치료 목표 사이드 패널 표시
    │
    계획 vs 실제 진행 비교 패널
    신체/언어/인지/사회성 달성도 체크
    자유 관찰 기록
    │
    ▼
records INSERT (domain=MED, type=MED-006)
```

### Flow-TH-02: 평가보고서 작성

```
[평가보고서 TH-17]
    │
    3열 비교 뷰: 초기 평가 | 중간 평가 | 최종 평가
    표준화 검사 결과 점수 입력
    점수 델타 자동 계산 표시
    │
    ▼
records INSERT (domain=MED, type=MED-007)
    ▼
보호자·담당 사회복지사에게 알림
```

---

## 8. 핵심 기능 워크플로우

### Flow-SYS-01: RLS 권한 검증 (모든 데이터 접근)

```
클라이언트 요청
    │
    ▼
Supabase Auth → JWT 검증 → auth.uid() 추출
    │
    ▼
PostgreSQL RLS 정책 평가
    │
    ├── records 테이블 SELECT:
    │       permissions JOIN → is_active=true AND valid_until > NOW()
    │       AND domain = 요청 domain AND 최소 read 권한
    │
    ├── persons 테이블 SELECT:
    │       auth.uid() = person_id (당사자 본인)
    │       OR auth.uid() IN (guardians WHERE person_id = 해당 당사자)
    │
    └── permissions 테이블 INSERT/UPDATE/DELETE:
            auth.uid() = primary guardian of person
    │
    ▼
쿼리 실행 (권한 통과 시)
    │
    ▼
access_logs INSERT (모든 접근 기록)
```

### Flow-SYS-02: 동의 수집 프로세스

```
동의 화면 (A-08) 렌더링
    │
    ▼
[필수] 이용약관 체크 (미체크 시 가입 불가)
[필수] 개인정보 수집·이용 체크 (미체크 시 가입 불가)
[선택] 마케팅·알림 체크 (개별 선택)
[고지] 위탁·국외이전 (정보 표시만)
    │
    ▼
consents 테이블 INSERT (항목별 분리)
    │  {
    │    user_id, consent_type, is_agreed,
    │    agreed_at, ip_address, version
    │  }
    ▼
민감정보 처리 시 (당사자 등록 Step 2/6):
    → 별도 PIPA §23 동의 화면 표시
    → sensitive_consents 테이블 분리 INSERT
```

### Flow-SYS-03: FCM 알림 발송

```
이벤트 발생 (일지 제출, IEP 업데이트, 권한 변경 등)
    │
    ▼
Supabase Edge Function 트리거
    │
    ▼
알림 대상 사용자 조회 (notification_preferences 테이블)
    │
    ▼
FCM token 조회 → FCM API 호출
    │  (실패 시) → Resend 이메일 폴백
    ▼
notifications 테이블 INSERT (전송 기록)
```

### Flow-SYS-04: 파일 첨부

```
사용자 파일 선택 (이미지/PDF)
    │
    ▼
클라이언트 측 파일 검증 (크기, 형식)
    │
    ▼
Supabase Storage에 업로드
    │  경로: records-attachments/{person_id}/{record_id}/{filename}
    ▼
스토리지 객체 URL → record_attachments 테이블 INSERT
    │
    ▼
파일 접근 시:
    → Presigned URL 발급 (만료 시간 제한, 예: 1시간)
    → 민감 파일(의료·법률): 추가 인증 요구
```

### Flow-SYS-05: 성년 전환 처리

```
당사자 생년월일 기준 만 18세 도달 감지
    │
    ▼
Supabase Edge Function (cron) 실행
    │
    ▼
persons 테이블 → is_adult = true 업데이트
    │
    ▼
보호자·당사자에게 성년 전환 알림
    │
    ▼
당사자가 P-23 화면에서 본인 동의 재취득
    │
    ▼
consents 테이블 INSERT (on_behalf = false)
    │
    ▼
보호자 대리 동의 이관 → 본인 동의 전환 완료
```

### Flow-SYS-06: 청소년 전환기 진입 처리 (만 14세)

`is_adult`처럼 영속 컬럼을 갱신하지 않는다 — `life_stage`는 계산값(`05-erd.md` §2-2-1)이므로 매 조회마다 자동으로 `youth`로 반영된다. 이 플로우는 **알림·UI 활성화 트리거**만 수행한다.

```
당사자 생년월일 기준 만 14세 도달 감지
    │
    ▼
Supabase Edge Function (cron, Flow-SYS-05와 동일 배치) 실행
    │  get_life_stage(birth_date) = 'youth' 전환 대상자 조회
    ▼
보호자·담당 특수교사에게 "전환계획 활성화" 알림 (F-T-06, F-G-09)
    │
    ▼
IEP 작성 위자드(T-13) 5/6 전환 계획 섹션 조건부 표시 ON
    │
    ▼
타임라인(G-10 등)에 TRA(전환) 도메인 레인 신규 노출 + StageBadge를 child → youth로 갱신
```

### Flow-SYS-07: 기록 확인 요청·처리 (승인 아님 — PRD §3-4, ERD §4-6)

```
전문가(교사/사회복지사/치료사 등)가 공식 기록 제출
  (is_draft: true → false, record_type이 §4-6 기본값 가이드상 requires_confirmation=true 대상)
    │
    ▼
trg_assign_confirmer 트리거 실행
    │  get_life_stage(person.birth_date) 조회
    │  ├─ child·youth → confirmer_id = primary_guardian_id
    │  └─ adult       → confirmer_id = person_id (본인)
    ▼
notifications INSERT (type:'record_confirm', data:{record_id, status:'requested'})
    │  Flow-SYS-03 재사용 (FCM → 실패 시 이메일 폴백)
    ▼
확인 주체가 G-20D(웹) / 기록 상세(앱) 또는 P-10(당사자)에서 "확인했습니다" 클릭
    │
    ▼
trg_confirmation_owner 트리거가 auth.uid() = confirmer_id 검증
    │
    ▼
confirmed_at 기록 → author_id에게 완료 알림 (type:'record_confirm', status:'confirmed')
```

**반려 없음** — 확인 주체가 내용에 이견이 있으면 확인을 미루고 작성자에게 인계인수/알림으로 정정을 요청한다. 기록 자체는 확인 대기 중에도 이미 확정 상태이며 열람·활용에는 제약이 없다.

**재확인 트리거 (기록 수정 시)**: G-21 등에서 `edit` 권한으로 기존 기록의 `content`를 수정하면 `trg_reset_confirmation_on_edit`(`05-erd.md` §4-6④)이 `confirmed_at`을 `NULL`로 재설정해 확인 대기 상태로 되돌린다.

---

## 9. 워크플로우 시퀀스 — 핵심 플로우

### Sequence-01: 보호자가 이해관계자에게 기록 접근 허용

```
보호자(G)          DB(Supabase)       이해관계자(TH/T/SW/S)
   │                    │                        │
   │ 권한 부여 위자드    │                        │
   │────────────────►   │                        │
   │                    │ permissions UPSERT      │
   │                    │────────────────────►   │
   │                    │ 초대 이메일 발송         │
   │                    │────────────────────────►│
   │                    │                        │ 초대 수락
   │                    │                  ◄──────│
   │                    │ permission_logs INSERT  │
   │                    │────────────────────►    │
   │                    │                        │ 기록 접근 (RLS 통과)
   │                    │  access_logs INSERT  ◄──│
```

### Sequence-02: 치료사 회기 일지 제출 후 보호자 조회

```
치료사(TH)         DB(Supabase)         보호자(G)
   │                    │                   │
   │ 회기 일지 작성 제출  │                   │
   │────────────────►   │                   │
   │                    │ records INSERT     │
   │                    │ access_logs INSERT │
   │                    │ FCM 알림 발송      │
   │                    │──────────────────►│
   │                    │                   │ 타임라인 조회
   │                    │ ◄─────────────────│
   │                    │ RLS 검증           │
   │                    │ (permissions: MED read)
   │                    │──────────────────►│
   │                    │                   │ 기록 표시
```
