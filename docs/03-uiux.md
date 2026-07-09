# 온길 UIUX — Design Specification

> 버전: v1.1 | 작성일: 2026-07-07 | 최종 개정: 2026-07-09 (CLAUDE.md 변경 이력 참조)
> 참조: `1 Plan/ongil-platform-blueprint.md` §5, §6, §7

---

## 1. 디자인 원칙

1. **당사자 중심 접근성** — 당사자 모드는 WCAG AAA 목표, 아이콘 72×72px, 폰트 20px+
2. **태스크 퍼스트** — 이해관계자는 진입 즉시 오늘 할 일이 보여야 함
3. **신뢰감 있는 데이터** — 색상 코딩으로 도메인 구분, 상태 표시 명확
4. **Lean 위자드** — 복잡한 폼은 단계 분할, 각 단계는 1개 의사결정
5. **반응형 일관성** — 웹(Sidebar+SplitPane)과 모바일(BottomTab+Stack) 패턴 준수

---

## 2. 브랜드 색상 시스템

### 2-1. Primary — Deep Green

| Token | Hex | 용도 |
|-------|-----|------|
| `primary-50` | `#F0FDF9` | 배경 틴트 |
| `primary-100` | `#E1F5EE` | 호버 배경 |
| `primary-400` | `#5DCAA5` | 보조 버튼, 플레이스홀더 |
| **`primary-600`** | **`#1D9E75`** | **메인 버튼, 링크, 포커스 링** |
| `primary-700` | `#0F6E56` | 버튼 호버, 강조 텍스트 |
| `primary-800` | `#065F46` | 사이드바·헤더, 다크 섹션 배경 |
| `primary-900` | `#064E3B` | 헤더 다크, 최고 강조 |

### 2-2. Accent 색상

| Token | Hex | 용도 |
|-------|-----|------|
| `accent-amber` | `#FAC775` | CTA 버튼, D-day 마커, 이정표 (MilestoneCard) |
| `accent-coral` | `#F5C4B3` | 자기표현 영역, 감성 카드 |
| `accent-stone` | `#444441` | 단색 텍스트, 고대비 강조 |
| `accent-pebble` | `#B4B2A9` | 보조 텍스트, 비활성 캡션 |

### 2-3. 도메인 색상 (6도메인 SSOT)

| 도메인 | bg | text | accent (chip/card border) |
|--------|-----|------|--------------------------|
| 의료 MED | `#FEF0F0` | `#BF3030` | `#E04545` |
| 교육 EDU | `#EEF4FD` | `#2E5FA8` | `#4377C0` |
| 복지 WEL | `#EDFAF3` | `#276B4C` | `#3EA673` |
| 일상 DAI | `#FFF5E6` | `#B56F10` | `#E8991E` |
| 전환 TRA | `#F4EFFB` | `#6A43A8` | `#8A5DC6` |
| 법률 LEG | `#EEF2F7` | `#3E5E7A` | `#5A7FA0` |

```typescript
// packages/shared/src/domain-colors.ts
export const DOMAIN_COLORS = {
  MED: { bg: '#FEF0F0', text: '#BF3030', accent: '#E04545' },
  EDU: { bg: '#EEF4FD', text: '#2E5FA8', accent: '#4377C0' },
  WEL: { bg: '#EDFAF3', text: '#276B4C', accent: '#3EA673' },
  DAI: { bg: '#FFF5E6', text: '#B56F10', accent: '#E8991E' },
  TRA: { bg: '#F4EFFB', text: '#6A43A8', accent: '#8A5DC6' },
  LEG: { bg: '#EEF2F7', text: '#3E5E7A', accent: '#5A7FA0' },
} as const
```

---

## 3. 타이포그래피

| 레벨 | 크기 | 굵기 | 용도 |
|------|------|------|------|
| Headline 1 | 32px | 800 | 페이지 제목 |
| Headline 2 | 24px | 700 | 섹션 제목 |
| Headline 3 | 18px | 700 | 카드 제목 |
| Body | 14px | 400 | 본문 |
| Caption | 12px | 400 | 보조 텍스트 |
| Label | 12px | 600 | 폼 레이블 |
| **당사자 모드 Base** | **20px** | — | 접근성 최우선 |

**폰트:** Pretendard (한글 가독성 최적화)

```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; }
```

---

## 4. 레이아웃 토큰

```css
:root {
  --rb: 52px;     /* 역할 선택 탭 높이 */
  --hh: 56px;     /* 글로벌 헤더 높이 */
  --sw: 220px;    /* 사이드바 너비 (펼침) */
  --sw-collapsed: 64px; /* 사이드바 너비 (접힘) */

  /* 보더 레디어스 */
  --br-sm: 6px;   /* 배지, 태그 */
  --br-md: 10px;  /* 카드, 인풋 */
  --br-lg: 14px;  /* 모달, 바텀시트 */
  --br-xl: 20px;  /* 당사자 아이콘 선택 버튼 */
}

.main-content {
  margin-left: var(--sw);
  padding-top: calc(var(--rb) + var(--hh));
}
```

---

## 5. 접근성 기준 (WCAG 2.1)

| 항목 | 일반 모드 | 당사자 모드 |
|------|---------|-----------|
| 텍스트 대비비 | 4.5:1 (AA) | 7:1 이상 (AAA 목표) |
| 포커스 인디케이터 | 2px solid `#1D9E75` | 동일 |
| 터치 타겟 | 44×44px | 56×56px |
| 폼 label 연결 | `useId()` htmlFor/id 쌍 | 대형 레이블 20px+ |
| 스킵 네비게이션 | "Skip to main content" | — |
| 이미지 alt | 의미 있는 이미지 전체 | 아이콘에 aria-label |

---

## 6. 공통 컴포넌트 사양

### 6-1. 레이아웃 컴포넌트

| 컴포넌트 | 파일 경로 | 사양 |
|---------|---------|------|
| `GlobalHeader` | `components/layout/GlobalHeader.tsx` | 높이 56px, 로고·알림·프로필 |
| `Sidebar` | `components/layout/Sidebar.tsx` | 220px (펼침) / 64px (접힘) |
| `RoleBadge` | `components/layout/RoleBadge.tsx` | 52px, 역할 선택 탭 |
| `SplitPane` | `components/layout/SplitPane.tsx` | CSS Grid `300px 1fr`, min-width 1024px |
| `StepIndicator` | `components/form/StepIndicator.tsx` | 다단계 진행 바 |
| `StickyFooter` | `components/form/StickyFooter.tsx` | 폼 하단 저장/다음 CTA |

### 6-2. 타임라인 컴포넌트

| 컴포넌트 | 사양 | 비고 |
|---------|------|------|
| `RecordTimelineCard` | 96px 높이, 도메인 chip | 기본 카드 |
| `MilestoneCard` | 144px, 황금 테두리 `#FAC775` | `is_milestone=true` |
| `PinnedCard` | 최상단 고정, 빨간 테두리 `#E04545` | 응급대응정보 |
| `DraftBadge` | 오른쪽 상단 뱃지 | `is_draft=true` |
| `TimelineLane` | `repeat(6, 1fr)` CSS Grid | 도메인 병렬 레인 |
| `DomainChip` | 도메인 색상 칩, 12px 폰트 | MED/EDU/WEL/DAI/TRA/LEG |

### 6-3. 폼 컴포넌트

| 컴포넌트 | 사양 |
|---------|------|
| `WizardForm` | 다단계 래퍼 (Step 표시 + 이전/다음/임시저장) |
| `FormField` | `useId()` htmlFor/id 자동 연결 (WCAG §1.3.1) |
| `IconSelector` | 당사자 전용, 72×72px 아이콘, `--br-xl` |
| `ObsTagSelector` | 행동·언어·사회성·학습 태그, 복수 선택 |
| `DomainSelector` | 6도메인 체크박스 그룹 |
| `DateRangePicker` | 시작일~종료일 + 무기한 토글 |

### 6-4. 권한 컴포넌트

| 컴포넌트 | 사양 |
|---------|------|
| `PermissionMatrix` | 이해관계자 행 × 도메인+수준 열 |
| `PermissionCell` | 클릭 사이클: 회색→read→write→edit→회색 |
| `ValidityBadge` | 만료 임박 경고색 (`accent-amber`) |
| `AccessLogTable` | 역할·도메인·날짜 필터, 무한 스크롤 |
| `GrantWizard` | 4단계: 대상자→도메인→수준·기간→확인 |

### 6-5. 동의 컴포넌트 (PIPA)

| 컴포넌트 | 사양 |
|---------|------|
| `ConsentItem` | 필수/선택 분리 체크박스 + "전문 보기" 링크 |
| `PolicyViewer` | 약관/개인정보처리방침 뷰어 |
| `ConsentManagementList` | 동의 현황 조회·선택 철회 목록 |

### 6-6. 생애주기 단계 컴포넌트

| 컴포넌트 | 사양 |
|---------|------|
| `StageBadge` | `life_stage` 값(`child`/`youth`/`adult`)에 따라 아이콘+라벨+색상 표시. 클릭 시 단계 정의 툴팁 |
| `StageFilter` | 타임라인 상단 토글형 필터 — 전체/아동기/청소년 전환기/성년기 |
| `StageTransitionBanner` | 단계 전환 시점(만 14세/18세) 타임라인 상단 안내 배너 |

**StageBadge 색상·아이콘:**

| 단계 | 라벨 | 배경 | 텍스트 | 아이콘 |
|------|------|------|--------|------|
| `child` | 아동기 | `#EEF4FD` (edu-bg 재사용) | `#2E5FA8` | 🧒 |
| `youth` | 청소년 전환기 | `#F4EFFB` (tra-bg 재사용) | `#6A43A8` | 🌱 |
| `adult` | 성년기 | `#FFF5E6` (dai-bg 재사용) | `#B56F10` | 🧑 |

- 도메인 컬러 팔레트와 시각적으로 구분되도록 배경은 도메인 톤을 재사용하되 텍스트 굵기(700)와 좌측 4px 색상 바로 "상태 배지"임을 구분한다.
- 접근성: 색상만으로 구분하지 않고 항상 아이콘+텍스트 라벨을 함께 표시(WCAG 1.4.1).
- 표시 위치는 `02-ia.md` §3-9 화면 목록 참조.

### 6-7. 기록 확인(Confirmation) 컴포넌트 — 승인 아님

`DraftBadge`(§6-2)가 "임시저장 상태"를 나타내듯, `ConfirmBadge`는 "확인 상태"만 나타낸다. 반려·승인 개념의 시각 요소(거부 버튼, 상태 사유 입력 등)는 두지 않는다.

| 컴포넌트 | 사양 |
|---------|------|
| `ConfirmBadge` | 미확인: 회색 배경 + "확인 대기" 텍스트. 확인됨: 연한 초록 배경 + "✓ {확인자명}님 확인 · {날짜}" |
| `ConfirmCTA` | 확인 주체 화면(G-20D/P-10)에서만 노출되는 버튼 "확인했습니다" — 클릭 즉시 상태 전환, 확인 취소(되돌리기) 불가 |
| `PendingConfirmCard` | G-01 대시보드용 요약 카드 — "확인 대기 기록 N건" + 목록 바로가기 |

**ConfirmBadge 상태별 스타일:**

| 상태 | 배경 | 텍스트 | 아이콘 |
|------|------|--------|------|
| 확인 대기 | `#F3F4F6` | `#6B7280` | ⏳ |
| 확인 완료 | `primary-50` | `primary-700` | ✓ |

- `requires_confirmation=false`인 기록(관찰기록·일지 등 일상 기록)에는 배지를 아예 표시하지 않는다 — 확인 절차가 없는 기록과 "확인 완료"된 기록을 시각적으로 혼동하지 않도록.
- 확인 주체가 아닌 사용자(예: 작성자 본인, 다른 이해관계자)에게는 `ConfirmCTA` 버튼을 노출하지 않고 배지만 읽기 전용으로 표시한다.

---

## 7. 역할별 화면 설계 상세

### 7-1. 당사자 (Person) — 접근성 최우선

**진입 패러다임:** 폰 쉘(Phone Shell) — 기기 전체가 당사자의 것

**핵심 원칙:**
- 아이콘 크기 72×72px (터치 영역 56×56px)
- 1화면 = 1질문
- 글자 크기 20px+, 고대비 모드 (WCAG AAA 목표)

**자기표현 4단계 위자드 (P-02, ST-08):**

| Step | 질문 | 아이콘 옵션 |
|------|------|----------|
| 1/4 | 기분이 어때요? | 😊좋아요 / 😐보통 / 😢슬퍼요 / 😡화났어요 |
| 2/4 | 밥 먹었어요? | 🍚잘먹음 / 😐조금 / ❌못먹음 + 📷사진 |
| 3/4 | 뭘 했어요? | 🏃운동 / 📚공부 / 🎨만들기 / 👫친구 (복수) |
| 4/4 | 몸은 어때요? | 💪건강 / 🤧감기 / 😴피곤 + 📝메모/🎙음성 |

완료: ✨ 저장 애니메이션 (2초 후 자동 팝)

---

### 7-2. 보호자 (Guardian) — PersonCard 슬라이더 허브

**대시보드 (G-01):**
```
┌─────────────────────────────────────────────┐
│ [< 홍길동 ▶] [< 홍영희 ▶]   ← 수평 슬라이더  │
│                                              │
│ [응급 정보 PinnedCard — 빨간 테두리]          │
│                                              │
│ [최근 기록] [권한 현황] [알림]                │
└─────────────────────────────────────────────┘
```

**권한 매트릭스 (G-30, ST-07):**
```
이름/역할  │ 의료R │ 의료W │ 교육R │ 교육W │ 복지R │ ...
김교사(T) │  ●   │  ○   │  ●   │  ●   │  ○   │
박지원(TH) │  ●   │  ●   │  ○   │  ○   │  ○   │
최복지(SW) │  ○   │  ○   │  ○   │  ○   │  ●   │
```
클릭 사이클: 회색(없음) → 🔵(read) → 🟢(write) → 🟡(edit) → 회색

**생애주기 타임라인 (G-10):**
- **스트림 뷰:** 날짜 역순, 도메인 chip으로 구분
- **레인 뷰:** `repeat(6, 1fr)` CSS Grid, 도메인별 수직 컬럼
- PinnedCard: 응급정보 항상 최상단

---

### 7-3. 활동지원사 (Supporter) — 현장 빠른 기록

**일지 5단계 위자드 (S-12):**

| Step | 내용 | 특이사항 |
|------|------|---------|
| 1/5 | 서비스 정보 | 날짜(오늘 자동), 시작 시간 |
| 2/5 | 활동 내역 | 카테고리 복수 선택 + 소요 시간 / 이전 일지 참조 패널 |
| 3/5 | 건강·식사 | ST-08 변형 아이콘 선택 |
| 4/5 | 특이사항 | 행동 관찰·사고·인계 사항 (없으면 Skip) |
| 5/5 | 확인·제출 | 종료 시간, 서비스 시간 자동 계산, 임시저장/제출 |

---

### 7-4. 특수교사 (Teacher) — IEP + 관찰 통합

**IEP 작성 6단계 (T-13):**

| Step | 내용 |
|------|------|
| 1/6 | 기본 정보 (학교, 학년도, 회의 날짜, 참석자) |
| 2/6 | 현재 수준 (국어/수학/사회성/의사소통/자조기술) |
| 3/6 | 연간 목표 + 단기 목표(3개월 단위) + 평가 방법 |
| 4/6 | 지원 서비스 (치료지원, 보조인력 등) |
| 5/6 | 전환 계획 *(청소년+ 조건부 표시)* |
| 6/6 | 확인 및 저장 |

**IEP 점검 (T-14) — Split Pane:**
- 좌: IEP 영역별 목표 목록
- 우: 선택 영역 인라인 편집
- 참조 패널: 이전 버전 비교, 관찰기록 연결

---

### 7-5. 사회복지사 (Social Worker) — ISP + 전환 로드맵

**ISP 점검 (W-14, ST-03+ST-07):**
```
[ISP 목표 영역 목록]     [목표 상세 / 달성률]
 ▶ 자립생활     60%      ●●●●●○○○○○ 60%
 ▶ 사회참여     80%
 ▶ 직업훈련     40%      재사정 D-30 ⚠️
```

**전환계획 로드맵 (W-16, TRA-001):**
```
[탐색] ──▶ [계획] ──▶ [훈련] ──▶ [취업/자립]  ← 현재 위치 ●
```

---

### 7-6. 치료사 (Therapist) — 계획-회기 연동

**회기 일지 (TH-15):**
- 현재 치료계획서 자동 연결 — 치료 목표 사이드 표시
- 계획 vs 실제 진행 비교 패널
- 신체·언어·인지·사회성 달성도 체크

**평가보고서 3열 비교 뷰 (TH-17):**
```
│ 초기 평가 │ 중간 평가 │ 최종 평가 │
│ 언어 60점  │ 언어 72점  │ 언어 85점  │  +25 ↑
│ 인지 55점  │ 인지 60점  │ 인지 68점  │  +13 ↑
```

---

## 8. 랜딩페이지 UIUX

### 8-1. 섹션 구성

| 섹션 | 레이아웃 | 배경 | 우선순위 |
|------|---------|------|---------|
| Navbar | 투명 → 스크롤 후 white (backdrop-blur) | `primary-800` → white | P0 |
| S1. Hero | 좌: 카피+CTA / 우: 모바일 목업 | `linear-gradient(135deg, #064E3B, #0F6E56, #1D9E75)` | P0 |
| S2. 신뢰 지표 | 4개 숫자 카드 수평 | white | P2 |
| S3. 플랫폼 소개 | 3가지 핵심 가치 카드 | `primary-50` | P0 |
| S4. 6개 도메인 | 3×2 그리드 컬러 카드 | white | P0 |
| S5. 역할별 서비스 | 6탭 + 하단 설명 전환 | `primary-50` | P1 |
| S6. 기능 하이라이트 | 좌우 교차 (Alternating) | white | P2 |
| S7. 보안 | 다크 섹션 | `primary-800` | P1 |
| S8. 이용 절차 | 3단계 수평 흐름 | white | P2 |
| S9. 최종 CTA | 그라디언트 + 대형 버튼 | 그라디언트 | P0 |
| Footer | 링크·약관 | `accent-stone` | P2 |

### 8-2. Navbar 사양

```
배경: primary-800(#065F46) → scroll 후 white
로고: 온(primary-600) + 길(White)
우측 CTA: [시작하기 →] — amber(#FAC775) 배경, primary-900 텍스트
모바일: 햄버거 → Drawer
```

### 8-3. Hero 카피

- 헤드라인: `생애 전체를, 함께 기록합니다`
- 서브: `장애인의 의료·교육·복지·일상·전환·법률 기록을 당사자 중심으로 안전하게 관리하는 생애주기 플랫폼`
- Primary CTA: `지금 시작하기 →` (amber 버튼)
- Secondary CTA: `데모 보기` (outline white)

### 8-4. 반응형 브레이크포인트

| 브레이크포인트 | 레이아웃 |
|--------------|---------|
| `< 640px` | 1열, 모바일 최적화 |
| `640px ~` | 2열 그리드 |
| `1024px ~` | 좌우 2단 풀 레이아웃 |
