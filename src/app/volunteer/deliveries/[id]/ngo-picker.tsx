"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { setDeliveryNgo } from "@/lib/actions/deliveries";
import type { NgoOption } from "@/lib/queries";

export function NgoPicker({
  deliveryId,
  options,
  currentId,
}: {
  deliveryId: string;
  options: NgoOption[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (options.length === 0) {
    return (
      <p role="alert" className="text-sm text-destructive">
        No NGO has finished signing up yet, so there is nowhere to deliver this.
        Ask an NGO to register, or release this pickup.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="ngo-pick" className="text-sm font-medium">
        Deliver to
      </Label>
      <select
        id="ngo-pick"
        value={currentId ?? ""}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          start(async () => {
            const res = await setDeliveryNgo({
              deliveryId,
              ngoId: e.target.value,
            });
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
        className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
      >
        {!currentId && <option value="">Choose an NGO…</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} {o.city ? `(${o.city})` : ""} · {o.distanceKm.toFixed(1)}{" "}
            km from pickup
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
