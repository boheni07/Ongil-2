-- 온길 플랫폼 — 로컬 개발/QA용 목업 데이터
-- 실행: docker exec -i supabase_db_ongil psql -U postgres -d postgres -f - < supabase/seed.sql
-- (또는 `supabase db reset` 시 자동 실행 — Supabase CLI 관례상 seed.sql은 마이그레이션 이후 자동 적용된다)
--
-- 전제: 모든 prisma 마이그레이션이 적용된 상태(pnpm db:migrate 또는 prisma migrate deploy).
-- 멱등성: 고정 UUID + ON CONFLICT DO NOTHING(계정·당사자·권한)으로 재실행 안전. records·
--   handover_notes는 매 실행마다 테스트 당사자(p_a/p_b/p_c) 소유분을 먼저 DELETE한 뒤 새로
--   INSERT한다 — 예전 버전은 삭제 없이 계속 append만 해서 `supabase db reset`을 반복할 때마다
--   레코드가 누적되는 결함이 있었다(2026-07-20 정정, 사용자 요청 "기존 샘플데이터 삭제 후 재등록").
--   기존 pgTAP 테스트 잔여 데이터(guardian.test@ongil.dev 등 무작위 이메일)와는 별개 네임스페이스
--   (@ongil.test, 고정 UUID)를 쓴다.
--
-- 계정 비밀번호는 전부 동일: Ongil1234!  (로컬 전용 목업, 실서비스 값 아님)
--
-- record_type 16종 × 15건 이상(docs/08-record-taxonomy-workshop.md §5 최종 목록 기준):
--   SELF-001·DAI-002·EDU-001·EDU-002·EDU-003·EDU-005·MED-005·MED-006·MED-007·
--   WEL-004·WEL-005·WEL-006·TRA-001·LEG-001·LEG-002·GEN-001
-- EDU-005(ITP)는 청소년 전환기(p_b)만, LEG-001/002는 성인기 이상(p_c)만 대상 — 앱 레이어
-- 생애주기 가드와 동일 규칙을 시드에도 반영한다(가드 우회 데이터를 만들지 않는다).

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
  -- 3. permissions — 전문가 역할이 personA/personB/personC 기록을 작성할 수 있도록 도메인별 권한 부여
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
    (p_b, u_social1,    'TRA', 'write', true, CURRENT_DATE, CURRENT_DATE + 365, u_guardian2, now()),
    -- LEG-001/002는 성인기 이상 당사자만 대상이라 p_c(성년, 셀프 가입)에게만 권한을 준다.
    (p_c, u_social1,    'LEG', 'edit',  true, CURRENT_DATE, CURRENT_DATE + 365, u_person1, now())
  ON CONFLICT (person_id, grantee_id, domain) DO NOTHING;

  -- =========================================================================
  -- 4. records — 기존 테스트 당사자(p_a/p_b/p_c) 소유분을 전부 지우고 새로 채운다
  --    (사용자 요청 2026-07-20: "기존 샘플데이터 삭제 후 종류별 15건 이상 재등록")
  -- =========================================================================
  DELETE FROM public.records WHERE person_id IN (p_a, p_b, p_c);

  -- SELF-001 (당사자 자기표현) — personC 본인 작성, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, record_date, tags, updated_at)
    VALUES (
      p_c, u_person1, 'DAI', 'SELF-001',
      jsonb_build_object(
        'mood', (ARRAY['good','neutral','sad','angry','good'])[1 + (i % 5)],
        'meal', (ARRAY['full','partial','none'])[1 + (i % 3)],
        'activities', (ARRAY[
          ARRAY['exercise','study'], ARRAY['outing','hobby'], ARRAY['rest','tv'],
          ARRAY['study','hobby'], ARRAY['exercise','outing']
        ])[1 + (i % 5)],
        'health', (ARRAY['good','sick','tired'])[1 + (i % 3)],
        'memo', (ARRAY[
          '오늘은 산책을 했어요. 날씨가 좋아서 기분이 좋았습니다.',
          '친구를 만나서 같이 놀았어요. 즐거운 하루였습니다.',
          '조금 피곤했지만 할 일을 다 했어요.',
          '새로운 취미를 시작해봤어요. 재미있었습니다.',
          '오늘은 집에서 푹 쉬었어요.'
        ])[1 + (i % 5)]
      ),
      false, now() - (i || ' days')::interval, ARRAY['자기표현'], now()
    );
  END LOOP;

  -- DAI-002 (활동지원 일지) — supporter1 작성, personA/B 교차, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_supporter1, 'DAI', 'DAI-002',
      jsonb_build_object(
        'service_date', to_char(now() - (i || ' days')::interval, 'YYYY-MM-DD'),
        'start_time', (ARRAY['09:00','10:00','13:00','14:30'])[1 + (i % 4)],
        'end_time', (ARRAY['12:00','13:00','16:00','17:30'])[1 + (i % 4)],
        'scheduled_hours', 3, 'service_hours', 3 - (i % 2) * 0.5,
        'activities', (ARRAY[
          jsonb_build_array(jsonb_build_object('category','신변처리','minutes',60), jsonb_build_object('category','이동지원','minutes',120)),
          jsonb_build_array(jsonb_build_object('category','가사지원','minutes',90), jsonb_build_object('category','여가활동','minutes',90)),
          jsonb_build_array(jsonb_build_object('category','사회활동지원','minutes',150)),
          jsonb_build_array(jsonb_build_object('category','신변처리','minutes',30), jsonb_build_object('category','가사지원','minutes',150))
        ])[1 + (i % 4)],
        'health_status', (ARRAY['good','normal','tired'])[1 + (i % 3)],
        'meal_status', (ARRAY['full','partial','none'])[1 + (i % 3)],
        'handover_note', (ARRAY[
          '특이사항 없이 일정대로 진행했습니다.',
          '컨디션이 평소보다 좋아 활동량을 늘렸습니다.',
          '이동 중 잠시 휴식이 필요했습니다.',
          '보호자 요청으로 저녁 식사 준비를 도왔습니다.',
          '다음 방문 시 병원 동행 예정입니다.'
        ])[1 + (i % 5)]
      ),
      i % 7 = 0, now() - (i || ' days')::interval, ARRAY['활동지원'], now()
    );
  END LOOP;

  -- EDU-001 (IEP) — teacher1 작성, personA/B 교차, requires_confirmation=true, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_teacher1, 'EDU', 'EDU-001',
      jsonb_build_object(
        'school', '온길초등학교', 'academic_year', (ARRAY['2025','2026'])[1 + (i % 2)],
        'meeting_date', to_char(now() - (i || ' days')::interval, 'YYYY-MM-DD'),
        'participants', ARRAY['담임교사','특수교사','보호자'],
        'current_levels', jsonb_build_object('korean','기초','math','기초','social','보통','communication','보통','self_care','양호'),
        'annual_goals', jsonb_build_array(jsonb_build_object(
          'area', (ARRAY['의사소통','사회성','인지','자조기술'])[1 + (i % 4)],
          'goal', (ARRAY['2어문 표현하기','또래와 협동놀이하기','범주 분류하기','혼자 옷 입기'])[1 + (i % 4)],
          'short_term_goals', jsonb_build_array(jsonb_build_object('goal','1단계 목표','period','1학기','evaluation','관찰평가')))),
        'support_services', jsonb_build_array(jsonb_build_object('service', (ARRAY['언어치료','작업치료','물리치료'])[1 + (i % 3)], 'provider','온길복지관','frequency','주1회'))
      ),
      i % 8 = 0, true, now() - (i || ' days')::interval, ARRAY['IEP'], now()
    );
  END LOOP;

  -- EDU-002 (관찰기록) — teacher1 작성, requires_confirmation=false, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_teacher1, 'EDU', 'EDU-002',
      jsonb_build_object(
        'observedAt', (now() - (i || ' days')::interval)::text,
        'situation', (ARRAY['3교시 국어 모둠 활동','점심시간 급식지도','체육시간 협동놀이','미술시간 자유활동','하교 전 정리정돈'])[1 + (i % 5)],
        'tags', (ARRAY[ARRAY['사회성','언어'], ARRAY['행동','집중력'], ARRAY['정서','또래관계']])[1 + (i % 3)],
        'note', (ARRAY[
          '또래와의 상호작용이 늘었습니다.',
          '지시 따르기가 개선되었습니다.',
          '집중 시간이 짧아 자주 자리를 이탈했습니다.',
          '새로운 활동에 적극적으로 참여했습니다.',
          '갈등 상황에서 스스로 진정하는 모습을 보였습니다.'
        ])[1 + (i % 5)]
      ),
      false, false, now() - (i || ' days')::interval, ARRAY['행동','사회성'], now()
    );
  END LOOP;

  -- EDU-003 (행동중재계획 BIP) — teacher1 작성, personA/B 교차, requires_confirmation=true, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_teacher1, 'EDU', 'EDU-003',
      jsonb_build_object(
        'target_behavior', (ARRAY['수업 중 소리 지르기','과제 회피를 위한 자리 이탈','또래 물건 뺏기','지시 거부 후 눕기'])[1 + (i % 4)],
        'behavior_function', (ARRAY['attention','escape','sensory','other'])[1 + (i % 4)],
        'fba_basis', CASE WHEN i % 2 = 0 THEN jsonb_build_array('observation','teacher_interview') ELSE jsonb_build_array('guardian_interview','checklist') END,
        'antecedent_strategies', (ARRAY['과제 난이도를 낮추고 선택권 제공','사전 예고 후 전환 시간 확보','좌석을 교사 근처로 배치'])[1 + (i % 3)],
        'replacement_behavior', (ARRAY['손 들고 도움 요청하기','휴식 카드 제시하기','친구에게 말로 요청하기'])[1 + (i % 3)],
        'reinforcement_plan', (ARRAY['토큰 강화 후 선호 활동 제공','즉각적 언어 칭찬','스티커 5개 모으면 보상'])[1 + (i % 3)],
        'crisis_procedure', CASE WHEN i % 3 = 0 THEN NULL ELSE '심각한 자해·타해 시 안전 확보 후 보호자 즉시 연락' END,
        'review_date', to_char(now() + ((CASE WHEN i = 1 THEN -3 WHEN i = 2 THEN 4 ELSE 30 + i * 8 END) || ' days')::interval, 'YYYY-MM-DD')
      ),
      i % 9 = 0, true, now() - (i || ' days')::interval, ARRAY['행동중재'], now()
    );
  END LOOP;

  -- EDU-005 (개별화전환계획 ITP) — teacher1 작성, 청소년 전환기(personB)만, requires_confirmation=true, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      p_b, u_teacher1, 'EDU', 'EDU-005',
      jsonb_build_object(
        'career_interest_areas', (ARRAY[
          ARRAY['바리스타','제과제빵'], ARRAY['원예','포장'], ARRAY['사무보조','도서관보조'], ARRAY['조리보조','청소']
        ])[1 + (i % 4)],
        'work_experience_log', jsonb_build_array(jsonb_build_object(
          'activity', (ARRAY['카페 현장실습','도서관 봉사활동','원예농장 체험'])[1 + (i % 3)],
          'period', jsonb_build_object('start', to_char(now() - interval '60 days','YYYY-MM-DD'), 'end', to_char(now() - interval '30 days','YYYY-MM-DD')),
          'note', '적응도 양호, 지속 관찰 필요'
        )),
        'next_step_note', (ARRAY['현장실습 기관 추가 발굴 필요','자립생활 훈련과 병행 예정','직업평가 재실시 검토'])[1 + (i % 3)],
        'next_review_date', to_char(now() + ((CASE WHEN i = 1 THEN -2 WHEN i = 2 THEN 5 ELSE 30 + i * 7 END) || ' days')::interval, 'YYYY-MM-DD')
      ),
      i % 8 = 0, true, now() - (i || ' days')::interval, ARRAY['전환교육'], now()
    );
  END LOOP;

  -- MED-005 (치료계획서) — therapist1 작성, requires_confirmation=true, 15건(personA 8 + personB 7)
  -- 대표 계획서 id를 personA/B별로 하나씩 저장해 MED-006/007에서 참조
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i <= 8 THEN p_a ELSE p_b END, u_therapist1, 'MED', 'MED-005',
      jsonb_build_object(
        'plan_period', jsonb_build_object('start', to_char(now() - interval '90 days', 'YYYY-MM-DD'), 'end', to_char(now() + interval '90 days', 'YYYY-MM-DD')),
        'diagnosis', (ARRAY['발달지연','언어발달지연','전반적발달장애','근긴장저하'])[1 + (i % 4)],
        'therapy_type', (ARRAY['physical','occupational','speech'])[1 + (i % 3)],
        'goals', jsonb_build_array(jsonb_build_object('area','language','long_term','문장 표현','short_term','단어 조합','target_score',70)),
        'session_frequency', (ARRAY['주 1회','주 2회','격주 1회'])[1 + (i % 3)], 'responsible_therapist', '오치료',
        'precautions', CASE WHEN i % 4 = 0 THEN '심한 자극에 예민, 조도 낮은 환경 권장' ELSE NULL END
      ),
      i % 10 = 0, true, now() - (i || ' days')::interval, ARRAY['치료계획'], now()
    )
    RETURNING id INTO v_plan_a; -- 마지막 insert id를 임시로 캡처(아래에서 personA/B 대표값 재조회로 대체)
  END LOOP;

  SELECT id INTO v_plan_a FROM public.records WHERE person_id = p_a AND record_type = 'MED-005' AND is_draft = false ORDER BY record_date DESC LIMIT 1;
  SELECT id INTO v_plan_b FROM public.records WHERE person_id = p_b AND record_type = 'MED-005' AND is_draft = false ORDER BY record_date DESC LIMIT 1;

  -- MED-006 (회기 일지) — therapist1 작성, requires_confirmation=false, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i <= 8 THEN p_a ELSE p_b END, u_therapist1, 'MED', 'MED-006',
      jsonb_build_object(
        'session_date', to_char(now() - (i || ' days')::interval, 'YYYY-MM-DD'),
        'therapy_plan_id', (CASE WHEN i <= 8 THEN v_plan_a ELSE v_plan_b END)::text,
        'session_number', i,
        'planned_goals', (ARRAY[ARRAY['단어 조합 연습'], ARRAY['문장 완성 연습'], ARRAY['범주 분류 연습']])[1 + (i % 3)],
        'actual_progress', (ARRAY[
          format('%s회기: 목표의 70%% 달성', i),
          format('%s회기: 목표의 55%% 달성, 추가 반복 필요', i),
          format('%s회기: 목표 초과 달성, 난이도 상향 검토', i)
        ])[1 + (i % 3)],
        'domain_scores', jsonb_build_object(
          'physical', 50 + (i * 3) % 40, 'language', 55 + (i * 2) % 35,
          'cognitive', 60 + (i * 4) % 30, 'social', 58 + (i * 5) % 32
        ),
        'observations', (ARRAY['집중 시간이 늘었음','착석 유지가 어려웠음','자발적 언어 산출 증가','또래 모방 행동 관찰됨'])[1 + (i % 4)],
        'next_session_plan', CASE WHEN i % 3 = 0 THEN '다음 회기 목표를 문장 확장으로 조정' ELSE NULL END
      ),
      i % 9 = 0, false, now() - (i || ' days')::interval, ARRAY['회기일지'], now()
    );
  END LOOP;

  -- MED-007 (평가보고서) — therapist1 작성, requires_confirmation=true, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i <= 8 THEN p_a ELSE p_b END, u_therapist1, 'MED', 'MED-007',
      jsonb_build_object(
        'eval_type', (ARRAY['initial','interim','final'])[1 + (i % 3)],
        'eval_date', to_char(now() - (i || ' days')::interval, 'YYYY-MM-DD'),
        'therapy_plan_id', (CASE WHEN i <= 8 THEN v_plan_a ELSE v_plan_b END)::text,
        'domain_scores', jsonb_build_array(
          jsonb_build_object('domain','physical','score', 55 + i),
          jsonb_build_object('domain','language','score', 50 + i)
        ),
        'summary', (ARRAY[
          format('%s차 평가: 전반적 향상 추세', i),
          format('%s차 평가: 정체 구간, 접근법 변경 검토', i),
          format('%s차 평가: 목표 영역 전반 유의미한 개선', i)
        ])[1 + (i % 3)],
        'recommendations', CASE WHEN i % 2 = 0 THEN '가정에서의 반복 연습을 병행할 것을 권장합니다.' ELSE NULL END
      ),
      i % 10 = 0, true, now() - (i || ' days')::interval, ARRAY['평가보고서'], now()
    );
  END LOOP;

  -- WEL-004 (ISP) — social1 작성, requires_confirmation=true, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_social1, 'WEL', 'WEL-004',
      jsonb_build_object(
        'service_period', jsonb_build_object('start', to_char(now() - interval '90 days','YYYY-MM-DD'), 'end', to_char(now() + interval '90 days','YYYY-MM-DD')),
        'reassessment_date', to_char(now() + ((CASE WHEN i = 1 THEN -1 WHEN i = 2 THEN 3 ELSE 40 + i * 6 END) || ' days')::interval, 'YYYY-MM-DD'),
        'case_manager', '한복지',
        'needs', jsonb_build_array(jsonb_build_object('area', (ARRAY['일상생활','사회참여','건강관리'])[1 + (i % 3)], 'needs','자립훈련','barriers','이동제약')),
        'goals', jsonb_build_array(jsonb_build_object('area','자립','long_term','독립생활','short_term','대중교통 이용','responsible','한복지','deadline', to_char(now()+interval '180 days','YYYY-MM-DD'),'achievement_rate', (i*7)%100)),
        'services', jsonb_build_array(jsonb_build_object('service', (ARRAY['주간보호','방과후돌봄','단기보호'])[1 + (i % 3)], 'provider','온길복지관','frequency','주5회','start', to_char(now() - interval '30 days','YYYY-MM-DD')))
      ),
      i % 8 = 0, true, now() - (i || ' days')::interval, ARRAY['ISP'], now()
    );
  END LOOP;

  -- WEL-005 (서비스 이용계획) — social1 작성, requires_confirmation=false, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_social1, 'WEL', 'WEL-005',
      jsonb_build_object(
        'services', jsonb_build_array(jsonb_build_object(
          'service_name', (ARRAY['주간보호','언어재활바우처','활동지원서비스','단기보호'])[1 + (i % 4)],
          'provider','온길복지관','frequency','주5회',
          'start_date', to_char(now() - interval '30 days','YYYY-MM-DD'), 'status', (ARRAY['active','active','paused'])[1 + (i % 3)])),
        'monthly_cost', 150000 + i * 1000, 'funding_source', (ARRAY['발달재활서비스 바우처','장애인활동지원 급여'])[1 + (i % 2)],
        'case_manager', '한복지',
        'next_review_date', to_char(now() + ((CASE WHEN i = 1 THEN -4 WHEN i = 2 THEN 2 ELSE 40 + i * 5 END) || ' days')::interval, 'YYYY-MM-DD')
      ),
      false, false, now() - (i || ' days')::interval, ARRAY['서비스이용'], now()
    );
  END LOOP;

  -- WEL-006 (사례회의록) — social1 작성, requires_confirmation=false, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END, u_social1, 'WEL', 'WEL-006',
      jsonb_build_object(
        'meetingDate', (now() - (i || ' days')::interval)::text,
        'participants', (ARRAY[
          ARRAY['한복지','김보호','정교사'], ARRAY['한복지','이보호','오치료'], ARRAY['한복지','최지원','정교사']
        ])[1 + (i % 3)],
        'discussion', (ARRAY[
          'ISP 재사정 결과와 서비스 조정 필요 여부를 논의했습니다.',
          '학교-복지기관 간 정보 공유 체계를 점검했습니다.',
          '전환계획 진행 상황과 다음 단계를 협의했습니다.'
        ])[1 + (i % 3)],
        'decisions', CASE WHEN i % 3 = 0 THEN NULL ELSE '다음 달 재사정 전까지 관찰 강화하기로 결정' END
      ),
      false, false, now() - (i || ' days')::interval, ARRAY['사례회의'], now()
    );
  END LOOP;

  -- TRA-001 (전환계획) — social1 작성, personB(청소년 전환기)/personC(성년) 대상만, requires_confirmation=true, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_b ELSE p_c END, u_social1, 'TRA', 'TRA-001',
      jsonb_build_object(
        'roadmap_stage', (ARRAY['exploration','planning','training','employment'])[1 + (i % 4)],
        'career_goal', (ARRAY['바리스타','포장보조','사무보조','원예사'])[1 + (i % 4)],
        'independent_living_plan', '단계별 자립 훈련 중',
        'training_records', jsonb_build_array(jsonb_build_object('program', (ARRAY['바리스타 양성과정','사무보조 훈련과정'])[1 + (i % 2)], 'provider','온길훈련센터',
          'period', jsonb_build_object('start', to_char(now() - interval '60 days','YYYY-MM-DD'), 'end', to_char(now() + interval '30 days','YYYY-MM-DD')), 'status', (ARRAY['ongoing','completed'])[1 + (i % 2)])),
        'linked_agencies', ARRAY['발달장애인훈련센터'], 'case_manager', '한복지',
        'next_review_date', to_char(now() + ((CASE WHEN i = 1 THEN -6 WHEN i = 2 THEN 1 ELSE 45 + i * 5 END) || ' days')::interval, 'YYYY-MM-DD')
      ),
      i % 9 = 0, true, now() - (i || ' days')::interval, ARRAY['전환계획'], now()
    );
  END LOOP;

  -- LEG-001 (후견감독보고서) — social1 작성, 성년기 이상(personC)만, requires_confirmation=true, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      p_c, u_social1, 'LEG', 'LEG-001',
      jsonb_build_object(
        'report_kind', CASE WHEN i = 15 THEN 'initial' ELSE 'periodic' END,
        'report_period', jsonb_build_object('start', to_char(now() - interval '180 days','YYYY-MM-DD'), 'end', to_char(now() - interval '1 days','YYYY-MM-DD')),
        'guardian_type', (ARRAY['adult','limited','specific','voluntary'])[1 + (i % 4)],
        'guardian_name', '박당사 후견인',
        'property_management_summary', (ARRAY[
          '월 생활비 지출 내역 정상 관리, 잔여 재산 변동 없음.',
          '의료비 지출 증가로 예산 재조정 필요.',
          '정기예금 만기 도래로 재예치 처리 완료.'
        ])[1 + (i % 3)],
        'personal_care_summary', (ARRAY[
          '정기 건강검진 수검 완료, 특이사항 없음.',
          '주간활동 참여 빈도 증가, 정서적으로 안정적.',
          '복약 관리 보조 지속 중.'
        ])[1 + (i % 3)],
        'incidents', CASE WHEN i % 4 = 0 THEN '경미한 낙상 발생, 병원 진료 후 특이사항 없음' ELSE NULL END,
        'next_report_due', to_char(now() + ((CASE WHEN i = 1 THEN -5 WHEN i = 2 THEN 6 ELSE 60 + i * 6 END) || ' days')::interval, 'YYYY-MM-DD')
      ),
      i % 10 = 0, true, now() - (i || ' days')::interval, ARRAY['후견감독'], now()
    );
  END LOOP;

  -- LEG-002 (권익옹호 상담기록) — social1 작성, 성년기 이상(personC)만, requires_confirmation=false, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      p_c, u_social1, 'LEG', 'LEG-002',
      jsonb_build_object(
        'consultedAt', (now() - (i || ' days')::interval)::text,
        'issueType', (ARRAY['rights_violation','discrimination','abuse_suspected','other'])[1 + (i % 4)],
        'content', (ARRAY[
          '직장 내 부당한 처우에 대한 상담을 진행했습니다.',
          '지역사회 활동 참여 제한 사례를 접수해 상담했습니다.',
          '가족과의 갈등 상황에 대해 상담을 진행했습니다.',
          '서비스 이용 중 차별적 대우 신고를 접수했습니다.'
        ])[1 + (i % 4)],
        'actionTaken', CASE WHEN i % 3 = 0 THEN '관련 기관에 시정 요청 공문 발송' ELSE NULL END,
        'referralAgency', CASE WHEN i % 4 = 0 THEN '국가인권위원회' ELSE NULL END
      ),
      false, false, now() - (i || ' days')::interval, ARRAY['권익옹호'], now()
    );
  END LOOP;

  -- GEN-001 (보호자 범용 기록) — guardian1/guardian2 작성, requires_confirmation=false, 15건
  FOR i IN 1..15 LOOP
    INSERT INTO public.records (person_id, author_id, domain, record_type, content, is_draft, requires_confirmation, record_date, tags, updated_at)
    VALUES (
      CASE WHEN i % 2 = 0 THEN p_a ELSE p_b END,
      CASE WHEN i % 2 = 0 THEN u_guardian1 ELSE u_guardian2 END,
      (ARRAY['DAI','MED','EDU','WEL','TRA','LEG'])[1 + (i % 6)]::"Domain", 'GEN-001',
      jsonb_build_object(
        'title', format('%s번째 보호자 메모', i),
        'body', (ARRAY[
          '오늘 컨디션이 좋았고 특이사항 없었습니다.',
          '병원 진료 다녀왔습니다, 별다른 이상 없음.',
          '학교에서 즐겁게 지냈다고 합니다.',
          '식사량이 평소보다 적었습니다, 관찰 필요.',
          '주말 나들이 다녀왔습니다, 기분이 좋아 보였습니다.'
        ])[1 + (i % 5)]
      ),
      false, false, now() - (i || ' days')::interval, ARRAY['보호자메모'], now()
    );
  END LOOP;

  -- =========================================================================
  -- 5. handover_notes — 기존 소유분 삭제 후 10건 재등록(지원사→교사, 교사→복지사 등 교차)
  -- =========================================================================
  DELETE FROM public.handover_notes WHERE person_id IN (p_a, p_b, p_c);

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
