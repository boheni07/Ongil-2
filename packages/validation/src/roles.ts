import { z } from "zod";

/** docs/01-prd.md §2 사용자 유형 (6역할) */
export const roleSchema = z.enum([
  "person",
  "guardian",
  "supporter",
  "teacher",
  "social_worker",
  "therapist",
]);

export type Role = z.infer<typeof roleSchema>;
