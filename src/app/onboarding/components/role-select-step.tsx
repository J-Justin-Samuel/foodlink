"use client";

import { useState, useTransition } from "react";
import {
  Utensils,
  Bike,
  HeartHandshake,
  Gavel,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { selectRole } from "@/app/onboarding/actions";
import type { Role } from "@/types/roles";

const ROLE_OPTIONS: Array<{
  value: Role;
  label: string;
  blurb: string;
  icon: LucideIcon;
}> = [
  {
    value: "DONOR",
    label: "Donor",
    blurb: "Hotels, restaurants and caterers listing surplus food",
    icon: Utensils,
  },
  {
    value: "VOLUNTEER",
    label: "Volunteer",
    blurb: "Pick up donations and deliver them to shelters",
    icon: Bike,
  },
  {
    value: "NGO",
    label: "NGO / Shelter",
    blurb: "Receive deliveries and share them with people in need",
    icon: HeartHandshake,
  },
  {
    value: "BUYER",
    label: "Commercial buyer",
    blurb: "Bid on bulk surplus in flash auctions",
    icon: Gavel,
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
        <h2 className="text-2xl font-bold text-forest">
          How will you use FoodLink?
        </h2>
        <p className="mt-1 text-sm text-charcoal/70">
          This sets your dashboard and what you can do in the app.
        </p>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Role"
      >
        {ROLE_OPTIONS.map(({ value, label, blurb, icon: Icon }) => {
          const active = selected === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(value)}
              className={cn(
                "group relative flex items-start gap-3 rounded-2xl border bg-white/60 p-4 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-lg hover:shadow-orange-500/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-vibrant/25",
                active
                  ? "border-orange-vibrant bg-orange-soft/70 shadow-lg shadow-orange-500/15"
                  : "border-white/70",
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                  active
                    ? "bg-orange-vibrant text-white"
                    : "bg-orange-soft text-orange-600 group-hover:bg-orange-vibrant group-hover:text-white",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block font-display text-base font-bold text-forest">
                  {label}
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-charcoal/70">
                  {blurb}
                </span>
              </span>
              {active && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-fresh text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        variant="cta"
        size="lg"
        onClick={handleContinue}
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}
