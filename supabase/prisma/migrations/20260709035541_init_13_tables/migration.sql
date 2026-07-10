-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('person', 'guardian', 'supporter', 'teacher', 'social_worker', 'therapist');

-- CreateEnum
CREATE TYPE "Domain" AS ENUM ('MED', 'EDU', 'WEL', 'DAI', 'TRA', 'LEG');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('read', 'write', 'edit');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F', 'other');

-- CreateEnum
CREATE TYPE "DisabilityDegree" AS ENUM ('severe', 'mild');

-- CreateEnum
CREATE TYPE "PermissionLogAction" AS ENUM ('grant', 'revoke', 'update');

-- CreateEnum
CREATE TYPE "AccessLogAction" AS ENUM ('view', 'create', 'update', 'delete', 'export');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('terms', 'privacy', 'marketing', 'sensitive', 'unique_id');

-- CreateEnum
CREATE TYPE "HandoverPriority" AS ENUM ('high', 'normal', 'low');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('record_new', 'permission_grant', 'handover', 'reminder', 'record_confirm');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "full_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "fcm_token" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "primary_guardian_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" "Gender",
    "disability_types" TEXT[],
    "disability_degree" "DisabilityDegree",
    "emergency_info" JSONB,
    "avatar_url" TEXT,
    "is_adult" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardians" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "grantee_id" UUID NOT NULL,
    "domain" "Domain" NOT NULL,
    "access_level" "AccessLevel" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATE,
    "granted_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "permission_id" UUID,
    "action" "PermissionLogAction" NOT NULL,
    "actor_id" UUID,
    "before_state" JSONB,
    "after_state" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "author_id" UUID,
    "domain" "Domain" NOT NULL,
    "record_type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "is_milestone" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "record_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "confirmer_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "record_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "consent_type" "ConsentType" NOT NULL,
    "is_agreed" BOOLEAN NOT NULL,
    "on_behalf" BOOLEAN NOT NULL DEFAULT false,
    "on_behalf_of" UUID,
    "version" TEXT NOT NULL,
    "ip_address" TEXT,
    "agreed_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "person_id" UUID,
    "record_id" UUID,
    "action" "AccessLogAction" NOT NULL,
    "domain" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "accessed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "from_user_id" UUID,
    "to_user_id" UUID,
    "content" TEXT NOT NULL,
    "priority" "HandoverPriority" NOT NULL DEFAULT 'normal',
    "acknowledged_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "fcm_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_presets" (
    "role" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "access_level" "AccessLevel" NOT NULL,
    "default_valid_days" INTEGER,

    CONSTRAINT "permission_presets_pkey" PRIMARY KEY ("role","domain")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_user_id_person_id_key" ON "guardians"("user_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_person_id_grantee_id_domain_key" ON "permissions"("person_id", "grantee_id", "domain");

-- CreateIndex
CREATE INDEX "idx_records_person_domain" ON "records"("person_id", "domain");

-- CreateIndex
CREATE INDEX "idx_records_person_date" ON "records"("person_id", "record_date" DESC);

-- CreateIndex
CREATE INDEX "idx_records_type" ON "records"("record_type");

-- CreateIndex
CREATE INDEX "idx_access_logs_person" ON "access_logs"("person_id", "accessed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_access_logs_actor" ON "access_logs"("actor_id", "accessed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_handover_to_user" ON "handover_notes"("to_user_id", "acknowledged_at" ASC);

-- CreateIndex
CREATE INDEX "idx_notifications_recipient" ON "notifications"("recipient_id", "is_read", "sent_at" DESC);

-- CreateIndex (partial index — Prisma declarative schema does not support WHERE clauses,
-- so this is added manually per docs/05-erd.md §2-6)
CREATE INDEX "idx_records_pending_confirm" ON "records"("confirmer_id", "confirmed_at" ASC)
  WHERE "requires_confirmation" = true;

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_type_key" ON "notification_preferences"("user_id", "type");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_primary_guardian_id_fkey" FOREIGN KEY ("primary_guardian_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_grantee_id_fkey" FOREIGN KEY ("grantee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_logs" ADD CONSTRAINT "permission_logs_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_logs" ADD CONSTRAINT "permission_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_confirmer_id_fkey" FOREIGN KEY ("confirmer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_attachments" ADD CONSTRAINT "record_attachments_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_attachments" ADD CONSTRAINT "record_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_on_behalf_of_fkey" FOREIGN KEY ("on_behalf_of") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_notes" ADD CONSTRAINT "handover_notes_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────
-- get_life_stage() 함수 + persons_with_stage 뷰
-- 원문: docs/05-erd.md §2-2-1 (Prisma 선언적 스키마로 표현 불가하여 수동 추가)
-- ─────────────────────────────────────────────────────────

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
