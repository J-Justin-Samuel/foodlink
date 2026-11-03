"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { refreshPayoutStatus, startPayoutSetup } from "@/lib/actions/payouts";

export function PayoutSetupButtons({
  state,
}: {
  state: "NONE" | "INCOMPLETE" | "READY";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = () =>
    start(async () => {
      setError(null);
      const res = await startPayoutSetup();
      if (res.ok) window.location.assign(res.data.url);
      else setError(res.error);
    });
  const check = () =>
    start(async () => {
      setError(null);
      const res = await refreshPayoutStatus();
      if (res.ok) router.refresh();
      else setError(res.error);
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={go}
          disabled={pending}
          variant={state === "READY" ? "outline" : "default"}
        >
          {state === "NONE"
            ? "Set up payouts"
            : state === "INCOMPLETE"
              ? "Continue setup"
              : "Update bank details"}
        </Button>
        {state !== "READY" && (
          <Button onClick={check} disabled={pending} variant="outline">
            I finished, check again
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
