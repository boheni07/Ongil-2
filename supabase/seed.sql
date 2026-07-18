-- 온길 플랫폼 — 로컬 개발/QA용 목업 데이터
-- 실행: docker exec -i supabase_db_ongil psql -U postgres -d postgres -f - < supabase/seed.sql
-- (또는 `supabase db reset` 시 자동 실행 — Supabase CLI 관례상 seed.sql은 마이그레이션 이후 자동 적용된다)
--
-- 전제: 모든 prisma 마이그레이션이 적용된 상태(pnpm db:migrate 또는 prisma migrate deploy).
-- 멱등성: 고정 UUID + ON CONFLICT DO NOTHING으로 재실행 안전. 기존 pgTAP 테스트 잔여 데이터
--   (guardian.test@ongil.dev 등 무작위 이메일)와는 별개 네임스페이스(@ongil.test, 고정 UUID)를 쓴다.
--
-- 계정 비밀번호는 전부 동일: Ongil1234!  (로컬 전용 목업, 실서비스 값 아님)

SET client_encoding = 'UTF8';

DO $$
DECLARE
  v_password_hash text := crypt('Ongil1234!', gen_salt('bf'));

  -- 계정 UUID (고정)
  u_guardian1   uuid := 'a0000000-0000-0000-0000-000000000001';
  u_guardian2   uuid := 'a0000000-0000-0000-0000-000000000002';
  u_person1     uuid := 'a0000000-0000-0000-0000-000000000003';
  u_supporter1  uuid := 'a0000000-0000-0000-0000-000000000004';
  u_teacher1    uuid := 'a0000000-0000-0000-0000-000000000005';
  u_social1     uuid := 'a0000000-0000-0000-0000-000000000006';
  u_therapist1  uuid := 'a0000000-0000-0000-0000-000000000007';

  -- 당사자 UUID (고정) — personC는 셀프 가입 모델이라 u_person1과 동일해야 함
  p_a uuid := 'b0000000-0000-0000-0000-000000000001'; -- 김민준, 아동기, guardian1
  p_b uuid := 'b0000000-0000-0000-0000-000000000002'; -- 이서연, 청소년 전환기, guardian2
  p_c uuid := u_person1;                                -- 박당사, 성년기(셀프)

  -- 루프 변수
  i int;
  v_plan_a uuid; -- personA MED-005 치료계획서 대표 id (MED-006/007 참조용)
  v_plan_b uuid; -- personB MED-005 치료계획서 대표 id
BEGIN

  -- =========================================================================
  -- 1. auth.users + auth.identities (7개 역할별 테스트 계정)
  -- =========================================================================
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    last_sign_in_at
  )
  VALUES
    ('00000000-0000-0000-0000-000000000000', u_guardian1, 'authenticated', 'authenticated',
     'guardian1@ongil.test', v_password_hash, now(),
     '{"provider":"email","providers":["email"]}', '{"role":"guardian","full_name":"김보호"}',
     false, now(), now(), '', '', '', '', now()),
    ('00000000-0000-0000-0000-000000000000', u_guardian2, 'authenticated', 'authenticated',
     'guardian2@ongil.test', v_password_hash, now(),
     '{"provider":"email","providers":["email"]}', '{"role":"guardian","full_name":"이보호"}',
     false, now(), now(), '', '', '', '', now()),
    ('00000000-0000-0000-0000-000000000000', u_person1, 'authenticated', 'authenticated',
     'person1@ongil.test', v_password_hash, now(),
     '{"provider":"email","providers":["email"]}', '{"role":"person","full_name":"박당사"}',
     false, now(), now(), '', '', '', '', now()),
    ('00000000-0000-0000-0000-000000000000', u_supporter1, 'authenticated', 'authenticated',
     'supporter1@ongil.test', v_password_hash, now(),
     '{"provider":"email","providers":["email"]}', '{"role":"supporter","full_name":"최지원"}',
     false, now(), now(), '', '', '', '', now()),
    ('00000000-0000-0000-0000-000000000000', u_teacher1, 'authenticated', 'authenticated',
     'teacher1@ongil.test', v_password_hash, now(),
     '{"provider":"email","providers":["email"]}', '{"role":"teacher","full_name":"정교사"}',
     false, now(), now(), '', '', '', '', now()),
    ('00000000-0000-0000-0000-000000000000', u_social1, 'authenticated', 'authenticated',
     'social1@ongil.test', v_password_hash, now(),
     '{"provider":"email","providers":["email"]}', '{"role":"social_worker","full_name":"한복지"}',
     false, now(), now(), '', '', '', '', now()),
    ('00000000-0000-0000-0000-000000000000', u_therapist1, 'authenticated', 'authenticated',
     'therapist1@ongil.test', v_password_hash, now(),
     '{"provider":"email","providers":["email"]}', '{"role":"therapist","full_name":"오치료"}',
     false, now(), now(), '', '', '', '', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  SELECT gen_random_uuid(), u.id::text, u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email),
         'email', now(), now(), now()
  FROM auth.users u
  WHERE u.id IN (u_guardian1, u_guardian2, u_person1, u_supporter1, u_teacher1, u_social1, u_therapist1)
  ON CONFLICT DO NOTHING;

  -- on_auth_user_created 트리거가 public.users를 자동 생성한다(핸들러 참조: 20260709042335_p0_5_auth_trigger).

  -- =========================================================================
  -- 2. persons + guardians
  -- =========================================================================
  INSERT INTO public.persons (id, primary_guardian_id, full_name, birth_date, gender, disability_types, disability_degree, emergency_info, is_adult, updated_at)
  VALUES
    (p_a, u_guardian1, '김민준', '2016-03-15', 'M', ARRAY['지적장애'], 'severe',
     '{"allergies":[],"medications":[],"contacts":[{"name":"김보호","phone":"010-1111-2222","relation":"모"}]}'::jsonb, false, now()),
    (p_b, u_guardian2, '이서연', '2011-05-20', 'F', ARRAY['자폐성장애'], 'mild',
     '{"allergies":["땅콩"],"medications":[],"contacts":[{"name":"이보호","phone":"010-3333-4444","relation":"부"}]}'::jsonb, false, now()),
    (p_c, u_person1,   '박당사', '2003-01-10', 'M', ARRAY['지체장애'], 'mild',
     '{"allergies":[],"medications":[],"contacts":[{"name":"박당사","phone":"010-5555-6666","relation":"본인"}]}'::jsonb, true, now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.guardians (user_id, person_id, is_primary)
  VALUES (u_guardian1, p_a, true), (u_guardian2, p_b, true)
  ON CONFLICT (user_id, person_id) DO NOTHING;

  -- =========================================================================
  -- 3. permissions — 전문가 역할이 personA/personB 기록을 작성할 수 있도록 도메인별 권한 부여
  -- =========================================================================
  INSERT INTO public.permissions (person_id, grantee_id, domain, access_level, is_active, valid_from, valid_until, granted_by, updated_at)
  VALUES
    (p_a, u_supporter1, 'DAI', 'write', true, CURRENT_DATE, CURRENT_DATE + 180, u_guardian1, now()),
    (p_b, u_supporter1, 'DAI', 'write', true, CURRENT_DATE, CURRENT_DATE + 180, u_guardian2, now()),
    (p_a, u_teacher1,   'EDU', 'edit',  true, CURRENT_DATE, CURRENT_DATE + 365, u_guardian1, now()),
    (p_b, u_teacher1,   'EDU', 'edit',  true, CURRENT_DATE, CURRENT_DATE + 365, u_guardian2, now()),
    (p_a, u_therapist1, 'MED', 'edit',  true, CURRENT_DATE, CURRENT_DATE + 180, u_guardian1, now()),
    (p_b, u_therapist1, 'MED', 'edit',  true, CURRENT_DATE, CURRENT_DATE + 180, u_guardian2, now()),
    (p_a, u_social1,    'WEL', 'edit',  true, CURRENT_DATE, CURRENT_DATE + 365, u_guardian1, now()),
    (p_b, u_social1,    'WEL', 'edit',  true, CURRENT_DATE, CURRENT_DATE + 365, u_guardian2, now()),
    (p_a, u_social1,    'TRA', 'write', true, CURRENT_DATE, CURRENT_DATE + 365, u_guardian1, now()),
    (p_b, u_social1,    'TRA', 'write', true, CURRENT_DATE, CURRENT_DATE + 365, u_guardian2, now())
  ON CONFLICT (person_id, grantee_id, domain) DO NOTHING;

  -- =========================================================================
  -- 4. records — record_type별 10건 이상
  -- =========================================================================

  -- SELF-001 (당사자 자기표현) — personC 본인 작성, 10건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, record_date, tags, updated_at)
    VALUES (
      p_c, u_person1, 'DAI', 'SELF-001',
      jsonb_build_object(
        'mood', (ARRAY['good','neutral','sad','angry'])[1 + (i % 4)],
        'meal', (ARRAY['full','partial','none'])[1 + (i % 3)],
        'activities', ARRAY['exercise','study'],
        'health', (ARRAY['good','sick','tired'])[1 + (i % 3)],
        'memo', format('%s번째 자기표현 기록입니다. 오늘은 산책을 했어요.', i)
      ),
      false, now() - (i || ' days')::interval, ARRAY['자기표현'], now()
    );
  END LOOP;

  -- DAI-002 (활동지원 일지) — supporter1 작성, personA 6건 + personB 4건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i <= 6 THEN p_a ELSE p_b END, u_supporter1, 'DAI', 'DAI-002',
      jsonb_build_object(
        'service_date', to_char(now() - (i || ' days')::interval, 'YYYY-MM-DD'),
        'start_time', '09:00', 'end_time', '12:00', 'service_hours', 3,
        'activities', jsonb_build_array(jsonb_build_object('category','신변처리','minutes',60), jsonb_build_object('category','이동지원','minutes',120)),
        'health_status', 'good', 'meal_status', 'full',
        'handover_note', format('%s회차 활동지원 특이사항 없음', i)
      ),
      false, now() - (i || ' days')::interval, ARRAY['활동지원'], now()
    );
  END LOOP;

  -- EDU-001 (IEP) — teacher1 작성, personA/B 교차, requires_confirmation=true, 10건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_teacher1, 'EDU', 'EDU-001',
      jsonb_build_object(
        'school', '온길초등학교', 'academic_year', '2026', 'meeting_date', to_char(now() - (i || ' days')::interval, 'YYYY-MM-DD'),
        'participants', ARRAY['담임교사','특수교사','보호자'],
        'current_levels', jsonb_build_object('korean','기초','math','기초','social','보통','communication','보통','self_care','양호'),
        'annual_goals', jsonb_build_array(jsonb_build_object('area','의사소통','goal', format('%s차 목표: 2어문 표현하기', i),
          'short_term_goals', jsonb_build_array(jsonb_build_object('goal','1어문 표현','period','1학기','evaluation','관찰평가')))),
        'support_services', jsonb_build_array(jsonb_build_object('service','언어치료','provider','온길복지관','frequency','주1회'))
      ),
      false, true, now() - (i || ' days')::interval, ARRAY['IEP'], now()
    );
  END LOOP;

  -- EDU-002 (관찰기록) — teacher1 작성, requires_confirmation=false, 10건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_teacher1, 'EDU', 'EDU-002',
      jsonb_build_object(
        'observedAt', (now() - (i || ' days')::interval)::text,
        'situation', '3교시 국어 모둠 활동',
        'tags', ARRAY['사회성','언어'],
        'note', format('%s번째 관찰: 또래와의 상호작용이 늘었습니다.', i)
      ),
      false, false, now() - (i || ' days')::interval, ARRAY['행동','사회성'], now()
    );
  END LOOP;

  -- MED-005 (치료계획서) — therapist1 작성, requires_confirmation=true, 10건(personA 5 + personB 5)
  -- 대표 계획서 id를 personA/B별로 하나씩 저장해 MED-006/007에서 참조
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i <= 5 THEN p_a ELSE p_b END, u_therapist1, 'MED', 'MED-005',
      jsonb_build_object(
        'plan_period', jsonb_build_object('start', to_char(now() - interval '90 days', 'YYYY-MM-DD'), 'end', to_char(now() + interval '90 days', 'YYYY-MM-DD')),
        'diagnosis', '발달지연', 'therapy_type', (ARRAY['physical','occupational','speech'])[1 + (i % 3)],
        'goals', jsonb_build_array(jsonb_build_object('area','language','long_term','문장 표현','short_term','단어 조합','target_score',70)),
        'session_frequency', '주 2회', 'responsible_therapist', '오치료'
      ),
      false, true, now() - (i || ' days')::interval, ARRAY['치료계획'], now()
    )
    RETURNING id INTO v_plan_a; -- 마지막 insert id를 임시로 캡처(아래에서 personA/B 대표값 재조회로 대체)
  END LOOP;

  SELECT id INTO v_plan_a FROM public.records WHERE person_id = p_a AND record_type = 'MED-005' ORDER BY record_date DESC LIMIT 1;
  SELECT id INTO v_plan_b FROM public.records WHERE person_id = p_b AND record_type = 'MED-005' ORDER BY record_date DESC LIMIT 1;

  -- MED-006 (회기 일지) — therapist1 작성, requires_confirmation=false, 10건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i <= 5 THEN p_a ELSE p_b END, u_therapist1, 'MED', 'MED-006',
      jsonb_build_object(
        'session_date', to_char(now() - (i || ' days')::interval, 'YYYY-MM-DD'),
        'therapy_plan_id', (CASE WHEN i <= 5 THEN v_plan_a ELSE v_plan_b END)::text,
        'session_number', i, 'planned_goals', ARRAY['단어 조합 연습'],
        'actual_progress', format('%s회기: 목표의 70%% 달성', i),
        'domain_scores', jsonb_build_object('physical',60,'language',65,'cognitive',70,'social',68),
        'observations', '집중 시간이 늘었음'
      ),
      false, false, now() - (i || ' days')::interval, ARRAY['회기일지'], now()
    );
  END LOOP;

  -- MED-007 (평가보고서) — therapist1 작성, requires_confirmation=true, 10건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i <= 5 THEN p_a ELSE p_b END, u_therapist1, 'MED', 'MED-007',
      jsonb_build_object(
        'eval_type', (ARRAY['initial','interim','final'])[1 + (i % 3)],
        'eval_date', to_char(now() - (i || ' days')::interval, 'YYYY-MM-DD'),
        'therapy_plan_id', (CASE WHEN i <= 5 THEN v_plan_a ELSE v_plan_b END)::text,
        'domain_scores', jsonb_build_array(
          jsonb_build_object('domain','physical','score', 60 + i),
          jsonb_build_object('domain','language','score', 55 + i)
        ),
        'summary', format('%s차 평가: 전반적 향상 추세', i)
      ),
      false, true, now() - (i || ' days')::interval, ARRAY['평가보고서'], now()
    );
  END LOOP;

  -- WEL-004 (ISP) — social1 작성, requires_confirmation=true, 10건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_social1, 'WEL', 'WEL-004',
      jsonb_build_object(
        'service_period', jsonb_build_object('start', to_char(now() - interval '90 days','YYYY-MM-DD'), 'end', to_char(now() + interval '90 days','YYYY-MM-DD')),
        'reassessment_date', to_char(now() + interval '90 days', 'YYYY-MM-DD'), 'case_manager', '한복지',
        'needs', jsonb_build_array(jsonb_build_object('area','일상생활','needs','자립훈련','barriers','이동제약')),
        'goals', jsonb_build_array(jsonb_build_object('area','자립','long_term','독립생활','short_term','대중교통 이용','responsible','한복지','deadline', to_char(now()+interval '180 days','YYYY-MM-DD'),'achievement_rate', (i*7)%100)),
        'services', jsonb_build_array(jsonb_build_object('service','주간보호','provider','온길복지관','frequency','주5회','start', to_char(now() - interval '30 days','YYYY-MM-DD')))
      ),
      false, true, now() - (i || ' days')::interval, ARRAY['ISP'], now()
    );
  END LOOP;

  -- WEL-005 (서비스 이용계획) — social1 작성, requires_confirmation=false, 10건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_social1, 'WEL', 'WEL-005',
      jsonb_build_object(
        'services', jsonb_build_array(jsonb_build_object('service_name','주간보호','provider','온길복지관','frequency','주5회',
          'start_date', to_char(now() - interval '30 days','YYYY-MM-DD'), 'status','active')),
        'monthly_cost', 150000 + i * 1000, 'funding_source', '발달재활서비스 바우처',
        'case_manager', '한복지', 'next_review_date', to_char(now() + interval '90 days','YYYY-MM-DD')
      ),
      false, false, now() - (i || ' days')::interval, ARRAY['서비스이용'], now()
    );
  END LOOP;

  -- TRA-001 (전환계획) — social1 작성, personB(청소년 전환기)/personC(성년) 대상만, requires_confirmation=true, 10건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_b ELSE p_c END, u_social1, 'TRA', 'TRA-001',
      jsonb_build_object(
        'roadmap_stage', (ARRAY['exploration','planning','training','employment'])[1 + (i % 4)],
        'career_goal', '바리스타', 'independent_living_plan', '단계별 자립 훈련 중',
        'training_records', jsonb_build_array(jsonb_build_object('program','바리스타 양성과정','provider','온길훈련센터',
          'period', jsonb_build_object('start', to_char(now() - interval '60 days','YYYY-MM-DD'), 'end', to_char(now() + interval '30 days','YYYY-MM-DD')), 'status','ongoing')),
        'linked_agencies', ARRAY['발달장애인훈련센터'], 'case_manager', '한복지',
        'next_review_date', to_char(now() + interval '90 days','YYYY-MM-DD')
      ),
      false, true, now() - (i || ' days')::interval, ARRAY['전환계획'], now()
    );
  END LOOP;

  -- GEN-001 (보호자 범용 기록) — guardian1/guardian2 작성, requires_confirmation=false, 10건
  FOR i IN 1..10 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END,
      CASE WHEN i % 2 = 0 THEN u_guardian1 ELSE u_guardian2 END,
      (ARRAY['DAI','MED','EDU','WEL','TRA','LEG'])[1 + (i % 6)]::"Domain", 'GEN-001',
      jsonb_build_object('title', format('%s번째 보호자 메모', i), 'body', '오늘 컨디션이 좋았고 특이사항 없었습니다.'),
      false, false, now() - (i || ' days')::interval, ARRAY['보호자메모'], now()
    );
  END LOOP;

  -- =========================================================================
  -- 5. handover_notes — 10건 (지원사→교사, 교사→복지사 등 교차)
  -- =========================================================================
  FOR i IN 1..10 LOOP
    INSERT INTO public.handover_notes (person_id, from_user_id, to_user_id, content, priority, created_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END,
      CASE WHEN i % 3 = 0 THEN u_supporter1 WHEN i % 3 = 1 THEN u_teacher1 ELSE u_social1 END,
      CASE WHEN i % 3 = 0 THEN u_teacher1 WHEN i % 3 = 1 THEN u_social1 ELSE u_therapist1 END,
      format('%s번째 인수인계: 오늘 오전 활동 중 특이사항을 공유합니다.', i),
      (ARRAY['high','normal','low'])[1 + (i % 3)]::"HandoverPriority",
      now() - (i || ' days')::interval
    );
  END LOOP;

END $$;

-- =========================================================================
-- 확인용 요약
-- =========================================================================
SELECT 'users' AS table_name, count(*) FROM public.users WHERE email LIKE '%@ongil.test'
UNION ALL SELECT 'persons', count(*) FROM public.persons WHERE id IN ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003')
UNION ALL SELECT 'records', count(*) FROM public.records
UNION ALL SELECT 'handover_notes', count(*) FROM public.handover_notes;

SELECT record_type, count(*) FROM public.records GROUP BY record_type ORDER BY 1;
