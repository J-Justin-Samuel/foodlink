import { getCurrentUser } from "@/lib/guards";

/** Shows why a registration was sent back, so people know what to fix. */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <>
      {user?.onboardingStatus === "REJECTED" && (
        <div
          role="alert"
          className="border-b-2 border-destructive bg-red-50 px-4 py-3 text-center text-sm text-red-950 dark:bg-red-950/40 dark:text-red-100"
        >
          <p className="font-semibold">Your details were sent back.</p>
          <p>
            {user.reviewNote ??
              "Please check your details and licence, then submit again."}
          </p>
        </div>
      )}
      {children}
    </>
  );
}
