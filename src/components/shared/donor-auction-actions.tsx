"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { giveAwayFree } from "@/lib/actions/auctions";

/** Stops a running auction and turns the batch into a free donation for volunteers. */
export function GiveAwayFreeButton({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !confirm("Stop the auction and give this food away free instead?")
          )
            return;
          setError(null);
          start(async () => {
            const res = await giveAwayFree({ auctionId });
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
      >
        {pending ? "Stopping…" : "Give away free instead"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
