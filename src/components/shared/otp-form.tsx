"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types/action-result";

interface Props {
  deliveryId: string;
  /** A Server Action, e.g. confirmPickup or confirmDropoff. */
  action: (input: {
    deliveryId: string;
    code: string;
  }) => Promise<ActionResult<unknown>>;
  label: string;
  submitLabel: string;
  /** When set, the form is shown but locked, with this explanation. */
  disabledReason?: string;
}

/** Six-digit code entry shared by the donor (pickup) and NGO (drop-off) screens. */
export function OtpForm({
  deliveryId,
  action,
  label,
  submitLabel,
  disabledReason,
}: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const inputId = `otp-${deliveryId}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await action({ deliveryId, code });
      if (res.ok) {
        setDone(true);
        setCode("");
        router.refresh();
      } else {
        setError(res.error);
        setCode("");
      }
    });
  }

  if (done) {
    return (
      <p
        role="status"
        className="text-sm font-medium text-green-700 dark:text-green-400"
      >
        Code accepted.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          disabled={!!disabledReason || pending}
          aria-describedby={error ? `${inputId}-err` : undefined}
          className="h-11 max-w-44 font-mono text-xl tracking-[0.4em]"
        />
        <Button
          type="submit"
          disabled={code.length !== 6 || !!disabledReason || pending}
          className="h-11"
        >
          {pending ? "Checking…" : submitLabel}
        </Button>
      </div>
      {disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
      {error && (
        <p
          id={`${inputId}-err`}
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </form>
  );
}
