"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton, useSession } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
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
    try {
      await session?.reload();
    } catch {
      /* dashboards check the database, so a stale token is harmless */
    }
    router.push("/post-auth");
  }

  return (
    <>
      <header className="sticky top-0 z-40 px-4 pt-3">
        <div className="glass mx-auto flex h-14 max-w-2xl items-center justify-between rounded-full pl-5 pr-3">
          <Link
            href="/"
            className="font-display text-lg font-extrabold tracking-tight"
          >
            <span className="text-forest">Food</span>
            <span className="text-orange-vibrant">Link</span>
          </Link>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-2xl flex-col justify-center px-4 py-8">
        <div className="mb-5">
          <div className="mb-2 flex gap-2" aria-hidden>
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  i <= (step === "ROLE" ? 0 : 1)
                    ? "bg-orange-vibrant"
                    : "bg-white/70"
                }`}
              />
            ))}
          </div>
          <p className="text-sm font-medium text-charcoal/70">
            Step {step === "ROLE" ? 1 : 2} of 2:{" "}
            {step === "ROLE"
              ? "Choose how you'll use FoodLink"
              : "Tell us about your operation"}
          </p>
        </div>

        <div className="glass-strong rounded-[2rem] p-5 sm:p-8">
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
                className="mt-3"
                onClick={() => setStep("ROLE")}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Change role
              </Button>
            </>
          )}
        </div>
      </main>
    </>
  );
}
