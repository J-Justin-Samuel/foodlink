import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/guards";
import { ROLE_HOME } from "@/lib/routes";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

/**
 * Every sign-in and sign-up lands here. It decides where the person goes next:
 *   signed out            -> /sign-in
 *   no role chosen yet    -> /onboarding
 *   onboarding unfinished -> /onboarding
 *   otherwise             -> their own dashboard
 */
export default async function PostAuthPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");
  if (["PENDING", "IN_PROGRESS", "REJECTED"].includes(user.onboardingStatus))
    redirect("/onboarding");
  if (!user.isActive) redirect("/unauthorized");
  redirect(ROLE_HOME[user.role]);
}
