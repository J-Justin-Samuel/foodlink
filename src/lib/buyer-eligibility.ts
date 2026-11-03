import "server-only";

/**
 * Who may buy. Until the admin approval screen exists (Stage 6), buyers who
 * finished onboarding (SUBMITTED) can buy. Set REQUIRE_VERIFIED_BUYERS=true to
 * allow only admin-approved (VERIFIED) buyers.
 */
export function buyerCanBuy(user: {
  role: string;
  isActive: boolean;
  onboardingStatus: string;
}): string | null {
  if (user.role !== "BUYER") return "Only buyer accounts can buy.";
  if (!user.isActive) return "Your account is suspended.";
  const allowed =
    process.env.REQUIRE_VERIFIED_BUYERS === "true"
      ? ["VERIFIED"]
      : ["SUBMITTED", "VERIFIED"];
  if (!allowed.includes(user.onboardingStatus)) {
    return process.env.REQUIRE_VERIFIED_BUYERS === "true"
      ? "Your buyer account is waiting for verification."
      : "Finish setting up your buyer account first.";
  }
  return null;
}
