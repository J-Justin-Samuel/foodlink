export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EXPIRED"
  | "LIMIT"
  | "UNKNOWN";

export type ActionFailure = {
  ok: false;
  error: string;
  code: ActionErrorCode;
  fieldErrors?: Record<string, string[] | undefined>;
};

/** Server Actions return this instead of throwing across the network boundary. */
export type ActionResult<T = void> = { ok: true; data: T } | ActionFailure;
