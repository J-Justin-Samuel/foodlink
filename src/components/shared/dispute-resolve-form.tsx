"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolveDispute } from "@/lib/actions/disputes";

export function DisputeResolveForm({
  disputeId,
  status,
  canPenalise,
}: {
  disputeId: string;
  status: string;
  canPenalise: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [penalty, setPenalty] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = (outcome: "IN_REVIEW" | "RESOLVED" | "DISMISSED") =>
    start(async () => {
      setMsg(null);
      const pts = penalty.trim() === "" ? undefined : Number(penalty);
      const r = await resolveDispute({
        disputeId,
        outcome,
        note,
        penaltyPoints: outcome === "RESOLVED" ? pts : undefined,
      });
      if (r.ok) {
        setMsg({
          ok: true,
          text:
            outcome === "IN_REVIEW"
              ? "Marked as in review."
              : "Decision saved.",
        });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });

  return (
    <div className="space-y-3 rounded-lg border-2 border-foreground p-4">
      <h2 className="font-semibold">Your decision</h2>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`rounded-md border-2 p-2 text-sm ${msg.ok ? "border-green-600" : "border-destructive text-destructive"}`}
        >
          {msg.text}
        </p>
      )}
      <label className="grid gap-1 text-sm font-medium">
        Note for the reporter (required to close)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={2000}
          className="rounded-md border-2 border-foreground bg-background p-2 text-sm font-normal"
        />
      </label>
      {canPenalise && (
        <label className="grid max-w-48 gap-1 text-sm font-medium">
          Penalty points (optional, 0 to 500)
          <input
            type="number"
            min={0}
            max={500}
            value={penalty}
            onChange={(e) => setPenalty(e.target.value)}
            className="h-10 rounded-md border-2 border-foreground bg-background px-3 text-sm font-normal"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "OPEN" && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => send("IN_REVIEW")}
          >
            Take into review
          </Button>
        )}
        <Button disabled={pending} onClick={() => send("RESOLVED")}>
          Resolve
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => send("DISMISSED")}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
