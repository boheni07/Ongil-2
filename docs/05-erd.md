# 온길 Data Model & ERD

> 버전: v1.1 | 작성일: 2026-07-07 | 최종 개정: 2026-07-09 (CLAUDE.md 변경 이력 참조)
> 기술 스택: Supabase (PostgreSQL) + Prisma ORM + RLS

---

## 1. ERD 다이어그램 (Mermaid)

```mermaid
erDiagram
    USERS {
        uuid id PK
        text email UK
        text role "person|guardian|supporter|teacher|social_worker|therapist"
        text full_name
        text avatar_url
        timestamptz created_at
        timestamptz updated_at
    }

    PERSONS {
        uuid id PK
        uuid primary_guardian_id FK
        text full_name
        date birth_date
        text gender "M|F|other"
        text[] disability_types
        text disability_degree "severe|mild"
        jsonb emergency_info
        text avatar_url
        bool is_adult
        timestamptz created_at
        timestamptz updated_at
    }

    GUARDIANS {
        uuid id PK
        uuid user_id FK
        uuid person_id FK
        bool is_primary
        timestamptz created_at
    }

    PERMISSIONS {
        uuid id PK
        uuid person_id FK
        uuid grantee_id FK "users.id"
        text domain "MED|EDU|WEL|DAI|TRA|LEG"
        text access_level "read|write|edit"
        bool is_active
        date valid_from
        date valid_until
        uuid granted_by FK "users.id"
        timestamptz created_at
        timestamptz updated_at
    }

    PERMISSION_LOGS {
        uuid id PK
        uuid permission_id FK
        text action "grant|revoke|update"
        uuid actor_id FK "users.id"
        jsonb before_state
        jsonb after_state
        timestamptz created_at
    }

    RECORDS {
        uuid id PK
        uuid person_id FK
        uuid author_id FK "users.id"
        text domain "MED|EDU|WEL|DAI|TRA|LEG"
        text record_type "EDU-001|DAI-002|MED-006|..."
        jsonb content
        bool is_draft
        bool is_milestone
        bool is_pinned
        text[] tags
        timestamptz record_date
        bool requires_confirmation
        uuid confirmer_id FK "users.id"
        timestamptz confirmed_at
        timestamptz created_at
        timestamptz updated_at
    }

    RECORD_ATTACHMENTS {
        uuid id PK
        uuid record_id FK
        text file_name
        text file_url
        text mime_type
        int file_size
        uuid uploaded_by FK "users.id"
        timestamptz created_at
    }

    CONSENTS {
        uuid id PK
        uuid user_id FK
        text consent_type "terms|privacy|marketing|sensitive|unique_id"
        bool is_agreed
        bool on_behalf
        uuid on_behalf_of FK "persons.id"
        text version
        text ip_address
        timestamptz agreed_at
        timestamptz revoked_at
    }

    ACCESS_LOGS {
        uuid id PK
        uuid actor_id FK "users.id"
        uuid person_id FK
        uuid record_id FK
        text action "view|create|update|delete|export"
        text domain
        text ip_address
        text user_agent
        timestamptz accessed_at
    }

    HANDOVER_NOTES {
        uuid id PK
        uuid person_id FK
        uuid from_user_id FK "users.id"
        uuid to_user_id FK "users.id"
        text content
        text priority "high|normal|low"
        timestamptz acknowledged_at
        timestamptz created_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid recipient_id FK "users.id"
        text type "record_new|permission_grant|handover|reminder|record_confirm"
        text title
        text body
        jsonb data
        bool is_read
        timestamptz sent_at
        timestamptz read_at
    }

    NOTIFICATION_PREFERENCES {
        uuid id PK
        uuid user_id FK "users.id"
        text type "record_new|permission_grant|handover|reminder|record_confirm"
        bool fcm_enabled
        bool email_enabled
        timestamptz updated_at
    }

    USERS ||--o{ GUARDIANS : "is guardian"
    USERS ||--o{ PERMISSIONS : "granted to (grantee)"
    USERS ||--o{ RECORDS : "authors"
    USERS ||--o{ RECORDS : "confirms"
    USERS ||--o{ ACCESS_LOGS : "actors"
    USERS ||--o{ CONSENTS : "owns"
    USERS ||--o{ HANDOVER_NOTES : "from/to"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ NOTIFICATION_PREFERENCES : "sets"

    PERSONS ||--o{ GUARDIANS : "has guardians"
    PERSONS ||--o{ PERMISSIONS : "has permissions"
    PERSONS ||--o{ RECORDS : "has records"
    PERSONS ||--o{ ACCESS_LOGS : "is subject of"
    PERSONS ||--o{ CONSENTS : "on behalf of"
    PERSONS ||--o{ HANDOVER_NOTES : "about"

    RECORDS ||--o{ RECORD_ATTACHMENTS : "has attachments"
    PERMISSIONS ||--o{ PERMISSION_LOGS : "has history"
```

---

## 2. 테이블 상세 스키마

### 2-1. users

```sql
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  role        text NOT NULL CHECK (role IN ('person','guardian','supporter','teacher','social_worker','therapist')),
  full_name   text NOT NULL,
  avatar_url  text,
  fcm_token   text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
```

### 2-2. persons (당사자)

```sql
CREATE TABLE persons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_guardian_id uuid REFERENCES users(id) NOT NULL,
  full_name           text NOT NULL,
  birth_date          date NOT NULL,
  gender              text CHECK (gender IN ('M','F','other')),
  disability_types    text[],    -- ['지체장애', '발달장애', ...]
  disability_degree   text CHECK (disability_degree IN ('severe','mild')),
  emergency_info      jsonb,     -- { allergies, medications, contacts }
  avatar_url          text,
  is_adult            boolean DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
```

### 2-2-1. 생애주기 단계 (life_stage) — 계산 값, 별도 저장 안 함

생애주기 단계(아동기/청소년 전환기/성년기)는 `birth_date`로부터 매 조회 시 계산되는 **파생 값**이며, 별도 컬럼으로 저장하지 않는다. 단, 성년 전환(만 18세)은 동의 주체 이관이라는 상태 변화를 수반하므로 `is_adult`만 Flow-SYS-05(cron)로 영속화한다.

```sql
CREATE OR REPLACE FUNCTION get_life_stage(p_birth_date date)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN date_part('year', age(p_birth_date)) >= 18 THEN 'adult'   -- 성년기
    WHEN date_part('year', age(p_birth_date)) >= 14 THEN 'youth'   -- 청소년 전환기
    ELSE 'child'                                                    -- 아동기
  END;
$$;

-- 조회 편의 뷰 (persons + 계산된 life_stage)
CREATE OR REPLACE VIEW persons_with_stage AS
SELECT p.*, get_life_stage(p.birth_date) AS life_stage
FROM persons p;
```

| life_stage | 연령 기준 | 저장 여부 | 관련 상태 필드 |
|---|---|---|---|
| `child` (아동기) | 만 13세 이하 | 계산값 (뷰/함수) | — |
| `youth` (청소년 전환기) | 만 14~17세 | 계산값 (뷰/함수) | IEP 전환계획 섹션 활성화 트리거 |
| `adult` (성년기) | 만 18세 이상 | **`is_adult` 컬럼에 영속화** (Flow-SYS-05) | 동의 주체 보호자→본인 이관 |

Prisma에서는 `life_stage`를 매핑하지 않고, 애플리케이션 레이어 또는 `$queryRaw`로 `get_life_stage()`를 호출하거나 위 뷰를 통해 조회한다(스키마 마이그레이션 불필요, 나이는 매일 바뀌므로 저장 컬럼화 시 배치 갱신이 필요해 계산값 방식이 더 단순함).

### 2-3. guardians (보호자-당사자 관계)

```sql
CREATE TABLE guardians (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  person_id   uuid REFERENCES persons(id) ON DELETE CASCADE,
  is_primary  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, person_id)
);
```

### 2-4. permissions (접근 권한)

```sql
CREATE TABLE permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid REFERENCES persons(id) ON DELETE CASCADE,
  grantee_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  domain        text NOT NULL CHECK (domain IN ('MED','EDU','WEL','DAI','TRA','LEG')),
  access_level  text NOT NULL CHECK (access_level IN ('read','write','edit')),
  is_active     boolean DEFAULT true,
  valid_from    date DEFAULT CURRENT_DATE,
  valid_until   date,         -- NULL = 무기한
  granted_by    uuid REFERENCES users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(person_id, grantee_id, domain)
);
```

### 2-5. permission_logs (권한 변경 이력 — 불변)

```sql
CREATE TABLE permission_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id uuid REFERENCES permissions(id),
  action        text NOT NULL CHECK (action IN ('grant','revoke','update')),
  actor_id      uuid REFERENCES users(id),
  before_state  jsonb,
  after_state   jsonb,
  created_at    timestamptz DEFAULT now()
);
-- INSERT only, no UPDATE/DELETE (불변 감사 로그)
```

### 2-6. records (기록 — 핵심 테이블)

```sql
CREATE TABLE records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   uuid REFERENCES persons(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES users(id),
  domain      text NOT NULL CHECK (domain IN ('MED','EDU','WEL','DAI','TRA','LEG')),
  record_type text NOT NULL,  -- 'SELF-001','DAI-002','EDU-001','MED-005','MED-006','MED-007','WEL-004','WEL-005','TRA-001'
  content     jsonb NOT NULL, -- 기록 유형별 구조화된 내용
  is_draft    boolean DEFAULT false,
  is_milestone boolean DEFAULT false,
  is_pinned   boolean DEFAULT false,  -- 응급정보 등 고정 카드
  tags        text[],
  record_date timestamptz DEFAULT now(),
  -- 확인(confirmation) — 승인/반려 아님, 단순 확인. handover_notes.acknowledged_at과 동일 패턴.
  requires_confirmation boolean DEFAULT false,        -- 제출 시 author가 설정(§4-6 기본값 가이드)
  confirmer_id          uuid REFERENCES users(id),    -- 확인 주체: life_stage='adult'면 본인, 아니면 주보호자
  confirmed_at          timestamptz,                  -- NULL = 미확인. 반려 개념 없음(재확인 요청만 가능)
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_records_person_domain ON records(person_id, domain);
CREATE INDEX idx_records_person_date ON records(person_id, record_date DESC);
CREATE INDEX idx_records_type ON records(record_type);
-- 확인 대기 우선 정렬 (handover_notes의 idx_handover_to_user와 동일 패턴)
CREATE INDEX idx_records_pending_confirm ON records(confirmer_id, confirmed_at NULLS FIRST)
  WHERE requires_confirmation = true;
```

### 2-7. record_attachments

```sql
CREATE TABLE record_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   uuid REFERENCES records(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_url    text NOT NULL,  -- Supabase Storage path
  mime_type   text,
  file_size   int,
  uploaded_by uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);
```

### 2-8. consents (동의 수집 — PIPA)

```sql
CREATE TABLE consents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('terms','privacy','marketing','sensitive','unique_id')),
  is_agreed    boolean NOT NULL,
  on_behalf    boolean DEFAULT false,     -- 대리 동의 여부
  on_behalf_of uuid REFERENCES persons(id), -- 대리 동의 대상
  version      text NOT NULL,            -- 약관 버전
  ip_address   text,
  agreed_at    timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz DEFAULT now()
);
```

### 2-9. access_logs (접근 로그 — 불변)

```sql
CREATE TABLE access_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users(id),
  person_id   uuid REFERENCES persons(id),
  record_id   uuid REFERENCES records(id),
  action      text NOT NULL CHECK (action IN ('view','create','update','delete','export')),
  domain      text,
  ip_address  text,
  user_agent  text,
  accessed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_access_logs_person ON access_logs(person_id, accessed_at DESC);
CREATE INDEX idx_access_logs_actor ON access_logs(actor_id, accessed_at DESC);
-- INSERT only
```

### 2-10. handover_notes (인수인계)

```sql
CREATE TABLE handover_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid REFERENCES persons(id) ON DELETE CASCADE,
  from_user_id    uuid REFERENCES users(id),
  to_user_id      uuid REFERENCES users(id),
  content         text NOT NULL,
  priority        text DEFAULT 'normal' CHECK (priority IN ('high','normal','low')),
  acknowledged_at timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_handover_to_user ON handover_notes(to_user_id, acknowledged_at NULLS FIRST);
```

### 2-11. notifications (알림)

```sql
CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('record_new','permission_grant','handover','reminder','record_confirm')),
  title        text NOT NULL,
  body         text,
  data         jsonb,
  is_read      boolean DEFAULT false,
  sent_at      timestamptz DEFAULT now(),
  read_at      timestamptz
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, sent_at DESC);
```

### 2-11-1. notification_preferences (알림 채널 설정)

`04-workflow.md` Flow-SYS-03에서 참조하는 테이블이지만 그동안 스키마가 정의되지 않았던 부분을 보완한다. 사용자별·알림 유형별로 채널을 켜고 끌 수 있게 한다.

```sql
CREATE TABLE notification_preferences (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('record_new','permission_grant','handover','reminder','record_confirm')),
  fcm_enabled   boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, type)
);
```

- 행이 없으면 기본값(둘 다 `true`)으로 간주 — 신규 가입자가 매 타입마다 명시적으로 행을 만들 필요 없음.
- Flow-SYS-03에서 "알림 대상 사용자 조회" 단계는 이 테이블에서 `type`에 맞는 채널이 꺼져 있으면 해당 채널 발송을 건너뛴다(둘 다 꺼져 있어도 `notifications` 테이블 INSERT 자체는 항상 수행 — 인앱 알림 목록에는 남는다).

---

## 3. record_type별 content JSONB 스키마

### SELF-001 — 당사자 자기표현

```typescript
{
  mood: 'good' | 'neutral' | 'sad' | 'angry',
  meal: 'full' | 'partial' | 'none',
  meal_photo_url?: string,
  activities: ('exercise' | 'study' | 'craft' | 'social')[],
  health: 'good' | 'sick' | 'tired',
  memo?: string,
  voice_url?: string,
}
```

### DAI-002 — 활동지원 일지

```typescript
{
  service_date: string,          // YYYY-MM-DD
  start_time: string,            // HH:MM
  end_time: string,              // HH:MM
  service_hours: number,         // 자동 계산
  activities: { category: string, minutes: number }[],
  health_status: 'good' | 'sick' | 'tired',
  meal_status: 'full' | 'partial' | 'none',
  incidents?: string,
  handover_note?: string,
  reference_journal_id?: string, // 이전 일지 참조
}
```

### EDU-001 — IEP (개별화교육계획)

```typescript
{
  school: string,
  academic_year: string,
  meeting_date: string,
  participants: string[],
  current_levels: {
    korean: string, math: string, social: string,
    communication: string, self_care: string
  },
  annual_goals: {
    area: string,
    goal: string,
    short_term_goals: { goal: string, period: string, evaluation: string }[],
  }[],
  support_services: { service: string, provider: string, frequency: string }[],
  transition_plan?: { goal: string, steps: string[] },
}
```

### MED-005 — 치료계획서

```typescript
{
  plan_period: { start: string, end: string },
  diagnosis: string,
  therapy_type: 'physical' | 'occupational' | 'speech' | 'psychological' | 'other',
  goals: {
    area: 'physical' | 'language' | 'cognitive' | 'social',
    long_term: string,
    short_term: string,
    target_score?: number,          // 0-100, 평가보고서(MED-007) domain_scores와 비교 기준
  }[],
  session_frequency: string,        // 예: '주 2회'
  responsible_therapist: string,
  precautions?: string,
}
```

### MED-006 — 회기 일지

```typescript
{
  session_date: string,
  therapy_plan_id: string,        // 연결된 치료계획서 ID
  session_number: number,
  planned_goals: string[],
  actual_progress: string,
  domain_scores: {
    physical: number,             // 0-100
    language: number,
    cognitive: number,
    social: number,
  },
  observations: string,
  next_session_plan?: string,
}
```

### MED-007 — 평가보고서

```typescript
{
  eval_type: 'initial' | 'interim' | 'final',
  eval_date: string,
  therapy_plan_id: string,          // 연결된 치료계획서(MED-005) ID
  domain_scores: {
    domain: 'physical' | 'language' | 'cognitive' | 'social',
    score: number,                  // 0-100
  }[],
  summary: string,
  recommendations?: string,
}
```

- TH-17 "평가보고서 3열 비교 뷰"는 동일 `therapy_plan_id`를 공유하는 `eval_type: 'initial'|'interim'|'final'` 세 레코드를 조회해 화면에서 나란히 비교 렌더링한다(증감 `Δ`는 저장 값이 아니라 조회 시 계산).

### WEL-004 — ISP (개별지원계획)

```typescript
{
  service_period: { start: string, end: string },
  reassessment_date: string,
  case_manager: string,
  needs: { area: string, needs: string, barriers: string }[],
  goals: {
    area: string,
    long_term: string,
    short_term: string,
    responsible: string,
    deadline: string,
    achievement_rate: number,
  }[],
  services: {
    service: string, provider: string, frequency: string, start: string
  }[],
}
```

### WEL-005 — 서비스 이용계획

```typescript
{
  services: {
    service_name: string,
    provider: string,
    frequency: string,
    start_date: string,
    end_date?: string,
    status: 'active' | 'paused' | 'ended',
  }[],
  monthly_cost?: number,
  funding_source?: string,          // 예: '발달재활서비스 바우처'
  case_manager: string,
  next_review_date: string,
}
```

- W-17 "서비스 이용 현황"(ST-07)은 `person_id` 기준 `WEL-005` 레코드의 `services[]`를 표 형태로 렌더링하고, `status`로 필터링한다.

### TRA-001 — 전환계획

```typescript
{
  roadmap_stage: 'exploration' | 'planning' | 'training' | 'employment',  // 탐색→계획→훈련→취업/자립
  career_goal: string,                // 희망 진로
  independent_living_plan?: string,   // 자립생활계획
  training_records: {
    program: string,
    provider: string,
    period: { start: string, end: string },
    status: 'planned' | 'ongoing' | 'completed',
  }[],
  linked_agencies?: string[],         // 연계 기관 (예: 발달장애인훈련센터, 지역 장애인복지관)
  case_manager: string,
  next_review_date: string,
}
```

- W-16 "전환계획 로드맵"(UIUX §7-5)은 `roadmap_stage` 값으로 `[탐색]→[계획]→[훈련]→[취업/자립]` 4단계 중 현재 위치를 마커로 표시한다.
- `EDU-001.transition_plan`(IEP 내 전환계획 서브섹션, 만 14세+ 조건부)과는 별개의 독립 레코드다 — IEP 쪽은 교육 목표 관점의 요약이고, TRA-001은 사회복지사가 작성하는 전환 로드맵 전체를 관리한다. 두 레코드 간 명시적 FK는 없으며 같은 `person_id`로만 연결된다.

---

## 4. RLS 정책

### 4-1. persons 테이블

```sql
-- 당사자 본인 또는 보호자만 SELECT
CREATE POLICY persons_select ON persons FOR SELECT
  USING (
    auth.uid() = primary_guardian_id
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = persons.id AND user_id = auth.uid()
    )
    OR (
      SELECT role FROM users WHERE id = auth.uid()
    ) = 'person'
    AND auth.uid()::text = id::text  -- 당사자는 자신의 레코드만
  );

-- 보호자만 INSERT
CREATE POLICY persons_insert ON persons FOR INSERT
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'guardian'
  );
```

### 4-2. records 테이블

```sql
-- 권한 있는 사용자만 SELECT
CREATE POLICY records_select ON records FOR SELECT
  USING (
    -- 당사자 본인
    (SELECT role FROM users WHERE id = auth.uid()) = 'person'
    AND auth.uid()::text = (SELECT id::text FROM persons WHERE id = records.person_id LIMIT 1)
    -- 또는 유효한 도메인 권한 보유
    OR EXISTS (
      SELECT 1 FROM permissions
      WHERE person_id = records.person_id
        AND grantee_id = auth.uid()
        AND domain = records.domain
        AND access_level IN ('read','write','edit')
        AND is_active = true
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    )
    -- 또는 보호자
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = records.person_id AND user_id = auth.uid()
    )
  );

-- 도메인 write/edit 권한 보유 시 INSERT
CREATE POLICY records_insert ON records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE person_id = records.person_id
        AND grantee_id = auth.uid()
        AND domain = records.domain
        AND access_level IN ('write','edit')
        AND is_active = true
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    )
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = records.person_id AND user_id = auth.uid()
    )
  );

-- 도메인 edit 권한 보유 시에만 UPDATE (write는 신규 작성까지, 기존 기록 수정은 edit부터)
CREATE POLICY records_update ON records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE person_id = records.person_id
        AND grantee_id = auth.uid()
        AND domain = records.domain
        AND access_level = 'edit'
        AND is_active = true
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    )
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = records.person_id AND user_id = auth.uid()
    )
  );
```

### 4-3. permissions 테이블

```sql
-- 주보호자만 INSERT/UPDATE/DELETE
CREATE POLICY permissions_write ON permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = permissions.person_id
        AND user_id = auth.uid()
        AND is_primary = true
    )
  );

-- 본인 또는 보호자는 SELECT 가능
CREATE POLICY permissions_select ON permissions FOR SELECT
  USING (
    grantee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = permissions.person_id AND user_id = auth.uid()
    )
  );
```

### 4-4. permission_logs, access_logs (불변 감사 로그)

```sql
-- INSERT ONLY (시스템 레벨에서만 트리거)
CREATE POLICY perm_logs_insert ON permission_logs FOR INSERT WITH CHECK (true);
ALTER TABLE permission_logs DISABLE ROW LEVEL SECURITY;  -- 시스템 서비스 역할에서만 접근

CREATE POLICY access_logs_insert ON access_logs FOR INSERT WITH CHECK (true);
-- SELECT는 주보호자만 허용
CREATE POLICY access_logs_select ON access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = access_logs.person_id
        AND user_id = auth.uid()
        AND is_primary = true
    )
  );
```

### 4-5. 권한 관리 라이프사이클 (권장안 — PRD §3-2, §3-3 연동)

`permissions`는 역할에 고정되지 않은 완전 동적 구조이므로, 아래는 애플리케이션 레이어에서 강제하는 **운영 정책**이다(스키마 CHECK 제약은 최소화하고 트리거/Edge Function으로 처리).

**① 부여 시 기본값 프리셋 (조회 테이블, 애플리케이션 상수 또는 config 테이블)**

```sql
-- 참고용 매핑 — 실제 강제 제약이 아니라 G-32 위자드의 초기값 자동완성에 사용
CREATE TABLE permission_presets (
  role          text NOT NULL,   -- 'supporter'|'teacher'|'social_worker'|'therapist'
  domain        text NOT NULL CHECK (domain IN ('MED','EDU','WEL','DAI','TRA','LEG')),
  access_level  text NOT NULL CHECK (access_level IN ('read','write','edit')),
  default_valid_days integer,    -- NULL이면 위자드에서 무기한 확인 모달 표시
  PRIMARY KEY (role, domain)
);
-- 시드 예시 (PRD §3-2 표 기준)
INSERT INTO permission_presets VALUES
  ('supporter','MED','read',180), ('supporter','DAI','write',180),
  ('teacher','EDU','edit',365), ('teacher','DAI','read',365), ('teacher','TRA','write',365),
  ('social_worker','MED','read',365), ('social_worker','WEL','edit',365),
  ('social_worker','TRA','write',365), ('social_worker','LEG','read',365),
  ('therapist','MED','edit',180), ('therapist','DAI','read',180);
```

**② 부여/수정/회수 시 `permission_logs` 자동 기록 — 트리거화**

```sql
CREATE OR REPLACE FUNCTION log_permission_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO permission_logs(permission_id, action, actor_id, before_state, after_state)
    VALUES (NEW.id, 'grant', auth.uid(), NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO permission_logs(permission_id, action, actor_id, before_state, after_state)
    VALUES (NEW.id,
      CASE WHEN NEW.is_active = false AND OLD.is_active = true THEN 'revoke' ELSE 'update' END,
      auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_permission_audit
AFTER INSERT OR UPDATE ON permissions
FOR EACH ROW EXECUTE FUNCTION log_permission_change();
```

**③ 자동 만료 배치 (매일 cron, Flow-SYS-05/06과 동일 Edge Function 스케줄)**

```sql
UPDATE permissions
SET is_active = false, updated_at = now()
WHERE is_active = true
  AND valid_until IS NOT NULL
  AND valid_until < CURRENT_DATE;
-- D-7 사전 알림 대상 조회 (ValidityBadge 트리거용)
SELECT * FROM permissions
WHERE is_active = true AND valid_until = CURRENT_DATE + INTERVAL '7 days';
```

**④ 회수 시 Redis 캐시 무효화 (NF-SEC-05)**

`permissions` UPDATE(특히 `is_active=false`)가 커밋되면 애플리케이션 레이어(Supabase Edge Function 또는 API route)에서 `perm:{grantee_id}:{person_id}:{domain}` 캐시 키를 즉시 `DEL` — RLS 재평가와 캐시 무효화가 원자적으로 처리되어야 회수 후 접근 잔존 시간차가 발생하지 않는다.

**⑤ 감사 조회 (분기별 정기 알림, F-G-10)**

```sql
-- 미사용 권한: 부여됐지만 access_logs에 기록이 없는 건
SELECT p.* FROM permissions p
WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM access_logs a
    WHERE a.person_id = p.person_id AND a.actor_id = p.grantee_id
      AND a.accessed_at > now() - INTERVAL '90 days'
  );
```

### 4-6. 기록 확인(Confirmation) 절차 — 승인 아님, handover_notes 패턴 확장

"승인/반려"가 아니라 "확인했음" 단일 상태만 남기는 절차다(§3-4 PRD 연동). 전문가(교사/사회복지사/치료사 등)가 작성한 공식 기록을 확정(`is_draft:true→false`) 제출할 때, `requires_confirmation=true`인 기록에 한해 확인 주체를 자동 지정한다.

**① 기본값 가이드 (record_type별, 애플리케이션 상수 — 스키마 강제 아님)**

| 구분 | requires_confirmation 기본값 | 이유 |
|---|---|---|
| IEP(`EDU-*` 공식), ISP(`WEL-*` 공식), 치료계획서(`MED-005`), 전환계획(`TRA-001`) | `true` | 법정·공식 서류, 보호자/당사자가 내용을 인지해야 함 |
| 관찰기록, 활동지원 일지, 회기일지, 자기표현(`SELF-*`) | `false` | 일상 기록, 확인 절차로 인한 알림 피로 방지 |

**② 확인 주체 자동 지정 — 트리거**

```sql
CREATE OR REPLACE FUNCTION assign_record_confirmer()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_stage text; v_guardian uuid;
BEGIN
  IF NEW.requires_confirmation = true AND NEW.is_draft = false
     AND (OLD IS NULL OR OLD.is_draft = true) THEN
    SELECT get_life_stage(birth_date) INTO v_stage FROM persons WHERE id = NEW.person_id;
    IF v_stage = 'adult' THEN
      NEW.confirmer_id := NEW.person_id;   -- 본인 확인 (persons.id = 당사자 auth.uid())
    ELSE
      SELECT primary_guardian_id INTO v_guardian FROM persons WHERE id = NEW.person_id;
      NEW.confirmer_id := v_guardian;
    END IF;
    NEW.confirmed_at := NULL;
    -- notifications INSERT(type:'record_confirm', data:{record_id, status:'requested'})는
    -- 별도 AFTER 트리거 또는 Edge Function에서 처리 (Flow-SYS-03 재사용)
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_confirmer
BEFORE INSERT OR UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION assign_record_confirmer();
```

**③ 확인 처리 — confirmer 본인만 `confirmed_at` 설정 가능**

`records_update` 정책(§4-2)은 편집 권한 보유자 대상이라 확인 처리와 목적이 다르다. 확인은 별도 컬럼(`confirmed_at`)에 한정된 쓰기이므로 트리거로 소유자 검증한다.

```sql
CREATE OR REPLACE FUNCTION enforce_confirmation_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
    IF auth.uid() <> OLD.confirmer_id THEN
      RAISE EXCEPTION '확인 권한이 없습니다 (confirmer_id 불일치)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_confirmation_owner
BEFORE UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION enforce_confirmation_owner();
```

- 반려 개념은 없다. 내용에 이견이 있으면 확인을 미루고 작성자에게 별도 코멘트/메시지로 정정을 요청하는 것을 권장(현재 스킴 밖의 커뮤니케이션 채널 — 인수인계·알림으로 대체).
- 확인 완료 시 작성자(`author_id`)에게 `notifications`(type:`record_confirm`, data:`{status:'confirmed'}`) 알림을 보내는 것을 권장.

**④ 재확인 트리거 — 확인된 기록을 수정하면 확인 대기 상태로 되돌림 (PRD §3-4, Flow-SYS-07 연동)**

`edit` 권한으로 이미 확인된(`confirmed_at IS NOT NULL`) 기록의 `content`를 수정하면, 확인 당시와 내용이 달라졌으므로 확인 상태를 초기화한다.

```sql
CREATE OR REPLACE FUNCTION reset_confirmation_on_edit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.requires_confirmation = true
     AND OLD.confirmed_at IS NOT NULL
     AND NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.confirmed_at := NULL;
    -- confirmer_id는 유지 (동일 확인 주체에게 재확인 요청)
    -- notifications INSERT(type:'record_confirm', data:{record_id, status:'requested'})는
    -- Edge Function에서 처리 (Flow-SYS-03 재사용)
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reset_confirmation_on_edit
BEFORE UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION reset_confirmation_on_edit();
```

- `trg_confirmation_owner`(③)보다 먼저 평가되어야 하므로, Postgres 트리거 실행 순서(알파벳순)상 `trg_confirmation_owner` → `trg_reset_confirmation_on_edit` 순으로 실행됨에 유의 — `confirmed_at`을 이번 UPDATE에서 함께 바꾸는 요청은 ③에서 먼저 소유자 검증되고, 그 다음 이 트리거가 `content` 변경 여부만으로 재초기화 여부를 판단한다.

---

## 5. 인덱스 전략

```sql
-- 타임라인 쿼리 (최신순 페이지네이션)
CREATE INDEX idx_records_timeline ON records(person_id, record_date DESC, id DESC);

-- 도메인별 필터
CREATE INDEX idx_records_domain ON records(person_id, domain, record_date DESC);

-- 기록 유형 조회
CREATE INDEX idx_records_type_date ON records(record_type, record_date DESC);

-- 권한 만료 확인 (자주 조회)
CREATE INDEX idx_permissions_active ON permissions(person_id, grantee_id, domain)
  WHERE is_active = true;

-- 인수인계 미확인 우선 정렬
CREATE INDEX idx_handover_unread ON handover_notes(to_user_id, acknowledged_at NULLS FIRST);

-- 알림 미읽음
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, is_read)
  WHERE is_read = false;
```

---

## 6. 데이터 흐름도

```
[클라이언트 Web/Mobile]
        │ HTTPS
        ▼
[Supabase Auth]  →  JWT (auth.uid() + role claim)
        │
        ▼
[PostgreSQL + RLS]
    ├── users
    ├── persons ←──── guardians (M:N)
    ├── permissions  ←──── permission_logs (불변)
    ├── records ←──── record_attachments
    ├── consents
    ├── access_logs (불변, 모든 접근 기록)
    ├── handover_notes
    └── notifications
        │
        ▼
[Supabase Storage]
    records-attachments/{person_id}/{record_id}/
        │  Presigned URL (만료 시간)
        ▼
[CDN] → 클라이언트
```

---

## 7. Prisma 스키마 참조

```prisma
// supabase/prisma/schema.prisma (핵심 모델)

model User {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email     String   @unique
  role      UserRole
  fullName  String   @map("full_name")
  avatarUrl String?  @map("avatar_url")
  fcmToken  String?  @map("fcm_token")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  guardianOf   Guardian[]    @relation("UserGuardian")
  permissions  Permission[]  @relation("Grantee")
  records      Record[]      @relation("Author")
  confirmedRecords Record[]  @relation("Confirmer")
  accessLogs   AccessLog[]   @relation("Actor")
  consents     Consent[]
  notifications Notification[]

  @@map("users")
}

enum UserRole {
  person
  guardian
  supporter
  teacher
  social_worker
  therapist
}

model Person {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  primaryGuardianId String    @map("primary_guardian_id") @db.Uuid
  fullName          String    @map("full_name")
  birthDate         DateTime  @map("birth_date") @db.Date
  gender            String?
  disabilityTypes   String[]  @map("disability_types")
  disabilityDegree  String?   @map("disability_degree")
  emergencyInfo     Json?     @map("emergency_info")
  avatarUrl         String?   @map("avatar_url")
  isAdult           Boolean   @default(false) @map("is_adult")
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  primaryGuardian User         @relation("PrimaryGuardian", fields: [primaryGuardianId], references: [id])
  guardians       Guardian[]
  permissions     Permission[]
  records         Record[]
  accessLogs      AccessLog[]
  consents        Consent[]
  handoverNotes   HandoverNote[]

  @@map("persons")
}

model Record {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  personId   String   @map("person_id") @db.Uuid
  authorId   String   @map("author_id") @db.Uuid
  domain     Domain
  recordType String   @map("record_type")
  content    Json
  isDraft    Boolean  @default(false) @map("is_draft")
  isMilestone Boolean @default(false) @map("is_milestone")
  isPinned   Boolean  @default(false) @map("is_pinned")
  tags       String[]
  recordDate DateTime @default(now()) @map("record_date") @db.Timestamptz
  requiresConfirmation Boolean   @default(false) @map("requires_confirmation")
  confirmerId          String?   @map("confirmer_id") @db.Uuid
  confirmedAt          DateTime? @map("confirmed_at") @db.Timestamptz
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz

  person      Person             @relation(fields: [personId], references: [id])
  author      User               @relation("Author", fields: [authorId], references: [id])
  confirmer   User?              @relation("Confirmer", fields: [confirmerId], references: [id])
  attachments RecordAttachment[]
  accessLogs  AccessLog[]

  @@index([personId, recordDate(sort: Desc)])
  @@index([personId, domain, recordDate(sort: Desc)])
  @@map("records")
}

enum Domain {
  MED
  EDU
  WEL
  DAI
  TRA
  LEG
}
```
