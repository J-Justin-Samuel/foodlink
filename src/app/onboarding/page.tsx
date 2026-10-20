"use client";

import { useState } from "react";
import Link from "next/link";
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
      <header className="flex h-16 items-center justify-between border-b-2 px-4">
        <Link href="/" className="text-lg font-black tracking-tight">
          FoodLink
        </Link>
        <UserButton />
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col justify-center px-4 py-12">
        <p className="mb-6 text-sm text-muted-foreground">
          Step {step === "ROLE" ? 1 : 2} of 2 ·{" "}
          {step === "ROLE"
            ? "Choose how you'll use FoodLink"
            : "Tell us about your operation"}
        </p>

        {step === "ROLE" && (
          <RoleSelectStep
            onComplete={(chosenRole) => {
              setRole(chosenRole);
              setStep("DETAILS");
            }}
          />
        )}

        {step === "DETAILS" && role !== null && (
          <>
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
          </>
        )}
      </main>
    </>
  );
}
