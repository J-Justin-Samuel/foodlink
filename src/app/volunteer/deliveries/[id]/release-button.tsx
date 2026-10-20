"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { releaseDelivery } from "@/lib/actions/deliveries";

export function ReleaseButton({ deliveryId }: { deliveryId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Give this pickup back? Another volunteer will be able to claim it.",
            )
          )
            return;
          setError(null);
          start(async () => {
            const res = await releaseDelivery({ deliveryId });
            if (res.ok) router.push("/volunteer/discover");
            else setError(res.error);
          });
        }}
      >
        {pending ? "Releasing…" : "I can't do this pickup"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
