import "server-only";
import type { ZodError } from "zod";
import type { ActionFailure } from "@/types/action-result";
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac";

/** Maps anything thrown inside a Server Action to a serialisable failure. */
export function toFailure(err: unknown): ActionFailure {
  if (err instanceof UnauthorizedError) {
    return { ok: false, error: err.message, code: "UNAUTHORIZED" };
  }
  if (err instanceof ForbiddenError) {
    return { ok: false, error: err.message, code: "FORBIDDEN" };
  }
  console.error("Server Action failed:", err);
  return {
    ok: false,
    error: "Something went wrong. Please try again.",
    code: "UNKNOWN",
  };
}

export function validationFailure(error: ZodError): ActionFailure {
  return {
    ok: false,
    error: "Please fix the highlighted fields",
    code: "VALIDATION",
    fieldErrors: error.flatten().fieldErrors as Record<
      string,
      string[] | undefined
    >,
  };
}

/** Postgres unique_violation (23505), whether or not the driver wrapped it. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}
