"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { FoodImage } from "@/components/glass/food-image";
import type { ImageKey } from "@/lib/images";
import { cn } from "@/lib/utils";
import { selectRole } from "@/app/onboarding/actions";
import type { Role } from "@/types/roles";

const ROLE_OPTIONS: Array<{
  value: Role;
  label: string;
  blurb: string;
  img: ImageKey;
}> = [
  {
    value: "DONOR",
    img: "plate",
    label: "Donor",
    blurb: "Hotels, restaurants & event caterers listing surplus food",
  },
  {
    value: "VOLUNTEER",
    img: "market",
    label: "Volunteer",
    blurb: "Pick up donations and deliver them to shelters",
  },
  {
    value: "NGO",
    img: "healthy",
    label: "NGO / Shelter",
    blurb: "Receive deliveries and redistribute to beneficiaries",
  },
  {
    value: "BUYER",
    img: "pancakes",
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
        <h2 className="text-2xl font-extrabold">How will you use FoodLink?</h2>
        <p className="text-sm text-ink/75">
          This decides your dashboard and what your account can do.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Your role"
        className="grid grid-cols-2 gap-3"
      >
        {ROLE_OPTIONS.map((opt) => {
          const on = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSelected(opt.value)}
              className={cn(
                "glass lift group relative flex flex-col overflow-hidden rounded-3xl text-left",
                on &&
                  "ring-2 ring-flame shadow-[0_18px_40px_-16px_rgba(249,115,22,0.6)]",
              )}
            >
              <FoodImage
                name={opt.img}
                className="h-24 w-full sm:h-32"
                rounded="rounded-none"
              />
              {on && (
                <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-flame text-ink shadow-md">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
              )}
              <span className="space-y-1 p-3 sm:p-4">
                <span className="block font-display text-base font-bold text-forest">
                  {opt.label}
                </span>
                <span className="block text-xs leading-snug text-ink/75 sm:text-sm">
                  {opt.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={isPending}
        className="btn-flame w-full text-base disabled:opacity-60"
      >
        {isPending ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}
