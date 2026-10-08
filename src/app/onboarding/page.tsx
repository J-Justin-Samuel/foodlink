"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/types/roles";
import { RoleSelectStep } from "./components/role-select-step";
import { OperationalDetailsStep } from "./components/operational-details-step";

type WizardStep = "ROLE" | "DETAILS";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("ROLE");
  const [role, setRole] = useState<Role | null>(null);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <StepDot active={step === "ROLE"} done={step === "DETAILS"} label="1" />
        <div className="h-px flex-1 bg-border" />
        <StepDot active={step === "DETAILS"} done={false} label="2" />
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
        <OperationalDetailsStep
          role={role}
          onComplete={() => router.push("/onboarding/pending")}
        />
      )}
    </div>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={[
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
        done && "border-primary bg-primary text-primary-foreground",
        active && !done && "border-primary text-primary",
        !active && !done && "border-border text-muted-foreground",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </div>
  );
}
