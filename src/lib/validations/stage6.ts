import { z } from "zod";

export const quarterSchema = z.object({
  year: z.number().int().min(2024).max(2100),
  quarter: z.number().int().min(1).max(4),
});

export const reviewUserSchema = z.object({
  userId: z.string().uuid(),
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional(),
});

export const setActiveSchema = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
});

export const auditLicenseSchema = z.object({
  userId: z.string().uuid(),
  result: z.enum(["PASSED", "FAILED"]),
  note: z.string().trim().max(1000).optional(),
});

export const DISPUTE_CATEGORIES = [
  "QUALITY",
  "NO_SHOW",
  "WRONG_QUANTITY",
  "PAYMENT",
  "CONDUCT",
  "OTHER",
] as const;
export const DISPUTE_CATEGORY_LABELS: Record<
  (typeof DISPUTE_CATEGORIES)[number],
  string
> = {
  QUALITY: "Food quality",
  NO_SHOW: "Someone didn't show up",
  WRONG_QUANTITY: "Wrong quantity",
  PAYMENT: "Payment problem",
  CONDUCT: "Behaviour or conduct",
  OTHER: "Something else",
};

export const raiseDisputeSchema = z.object({
  deliveryId: z.string().uuid().optional(),
  againstUserId: z.string().uuid().optional(),
  category: z.enum(DISPUTE_CATEGORIES),
  description: z
    .string()
    .trim()
    .min(10, "Please write at least 10 characters")
    .max(2000),
});

export const resolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  outcome: z.enum(["IN_REVIEW", "RESOLVED", "DISMISSED"]),
  note: z.string().trim().max(2000).optional(),
  penaltyPoints: z.number().int().min(0).max(500).optional(),
});
