import type { Role } from "@/types/roles";

export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: Role;
      onboardingStatus?:
        | "PENDING"
        | "IN_PROGRESS"
        | "SUBMITTED"
        | "VERIFIED"
        | "REJECTED";
    };
  }
}
