"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { selectRole } from "@/app/onboarding/actions";
import type { Role } from "@/types/roles";

const ROLE_OPTIONS: Array<{ value: Role; label: string; blurb: string }> = [
  {
    value: "DONOR",
    label: "Donor",
    blurb: "Hotels, restaurants & event caterers listing surplus food",
  },
  {
    value: "VOLUNTEER",
    label: "Volunteer",
    blurb: "Pick up donations and deliver them to shelters",
  },
  {
    value: "NGO",
    label: "NGO / Shelter",
    blurb: "Receive deliveries and redistribute to beneficiaries",
  },
  {
    value: "BUYER",
    label: "Commercial Buyer",
    blurb: "Bid on bulk surplus via flash auctions",
  },
];

export function RoleSelectStep({
  onComplete,
}: {
  onComplete: (role: Role) => void;
}) {
  const [selected, setSelected] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleContinue() {
    if (!selected) {
      setError("Choose a role to continue");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await selectRole(selected);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onComplete(selected);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">How will you use FoodLink?</h2>
        <p className="text-sm text-muted-foreground">
          This determines your dashboard and the permissions on your account.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ROLE_OPTIONS.map((opt) => (
          <Card
            key={opt.value}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setSelected(opt.value);
            }}
            className={cn(
              "cursor-pointer transition-colors hover:border-primary",
              selected === opt.value && "border-primary ring-1 ring-primary"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{opt.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {opt.blurb}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleContinue} disabled={isPending} className="w-full">
        {isPending ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}
