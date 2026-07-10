import type { Role } from "@ongil/validation";

/**
 * docs/05-erd.md §2 13개 테이블에 대응하는 최소 타입.
 * Prisma 스키마 확정(P0-3) 후 prisma-generated 타입으로 교체 예정.
 */
export interface User {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Person {
  id: string;
  userId: string;
  birthDate: string;
  lifeStage: "child" | "youth_transition" | "adult";
}

export interface Guardian {
  id: string;
  userId: string;
  personId: string;
}

export interface Permission {
  id: string;
  granteeUserId: string;
  personId: string;
  scope: string;
  grantedAt: string;
  revokedAt: string | null;
}

export interface RecordEntry {
  id: string;
  personId: string;
  authorUserId: string;
  recordType: string;
  content: unknown;
  confirmedAt: string | null;
  createdAt: string;
}
