"use client";

import { useState } from "react";
import { Logo } from "@/components/glass/logo";
import { useRouter } from "next/navigation";
import { UserButton, useSession } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import type { Role } from "@/types/roles";
import { RoleSelectStep } from "./components/role-select-step";
import { OperationalDetailsStep } from "./components/operational-details-step";

type WizardStep = "ROLE" | "DETAILS";

export default function OnboardingPage() {
  const router = useRouter();
  const { session } = useSession();
  const [step, setStep] = useState<WizardStep>("ROLE");
  const [role, setRole] = useState<Role | null>(null);

  async function finish() {
    // Refresh the session token so it carries the new role, then let /post-auth pick the dashboard.
    try {
      await session?.reload();
    } catch {
      /* the dashboards check the database, so a stale token is harmless */
    }
    router.push("/post-auth");
  }

  return (
    <>
      <header className="sticky top-3 z-30 mx-auto mt-3 w-[calc(100%-1.5rem)] max-w-2xl">
        <div className="glass-strong flex h-14 items-center justify-between rounded-full pl-4 pr-3">
          <Logo />
          <UserButton />
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl flex-col justify-center px-4 py-8">
        <div
          className="mb-6 space-y-2"
          aria-label={`Step ${step === "ROLE" ? 1 : 2} of 2`}
        >
          <div className="flex gap-2" aria-hidden>
            <span className="h-1.5 flex-1 rounded-full bg-flame" />
            <span
              className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${step === "DETAILS" ? "bg-flame" : "bg-forest/15"}`}
            />
          </div>
          <p className="text-sm font-medium text-ink/75">
            Step {step === "ROLE" ? 1 : 2} of 2 ·{" "}
            {step === "ROLE"
              ? "Choose how you'll use FoodLink"
              : "Tell us about your operation"}
          </p>
        </div>

        {step === "ROLE" && (
          <RoleSelectStep
            onComplete={(chosenRole) => {
              setRole(chosenRole);
              setStep("DETAILS");
            }}
          />
        )}

        {step === "DETAILS" && role !== null && (
          <div className="glass-strong rounded-3xl p-5 sm:p-7">
            <OperationalDetailsStep role={role} onComplete={finish} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-4 self-start"
              onClick={() => setStep("ROLE")}
            >
              ← Change role
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
