"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAuction } from "@/lib/actions/auctions";
import {
  CHARITY_CUTOFF_MINUTES,
  DEFAULT_INTERVAL_MINUTES,
  floorReachedAtMs,
  toMinor,
  validateAuctionTerms,
} from "@/lib/auction-price";
import { formatMoney } from "@/lib/money";

interface Props {
  donationId: string;
  title: string;
  quantityKg: number;
  expiresAtMs: number;
  /** Server clock at render time, so the preview and the server agree. */
  nowMs: number;
}

export function AuctionForm({
  donationId,
  title,
  quantityKg,
  expiresAtMs,
  nowMs,
}: Props) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [floor, setFloor] = useState("");
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const preview = useMemo(() => {
    const s = Number(start),
      f = Number(floor),
      d = Number(step);
    if (!start || !floor || !step || ![s, f, d].every(Number.isFinite))
      return null;
    const terms = {
      startMinor: toMinor(s),
      floorMinor: toMinor(f),
      stepMinor: toMinor(d),
      intervalMinutes: DEFAULT_INTERVAL_MINUTES,
      expiresAtMs,
      nowMs,
    };
    const problem = validateAuctionTerms(terms);
    if (problem) return { problem } as const;
    const minutes = Math.round(
      (floorReachedAtMs({ ...terms, startsAtMs: nowMs }) - nowMs) / 60000,
    );
    return { minutes } as const;
  }, [start, floor, step, expiresAtMs, nowMs]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    run(async () => {
      const res = await createAuction({
        donationId,
        startPrice: Number(start),
        reservePrice: Number(floor),
        decrementStep: Number(step),
      });
      if (res.ok) router.push("/donor");
      else setError(res.error);
    });
  }

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    hint: string,
  ) => (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder="0"
        className="max-w-48"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {title} · {quantityKg} kg. Buyers see the price fall every{" "}
        {DEFAULT_INTERVAL_MINUTES} minutes until someone buys it or it reaches
        your lowest price.
      </p>
      {field(
        "start",
        "Starting price (₹)",
        start,
        setStart,
        "The price when the auction opens.",
      )}
      {field(
        "floor",
        "Lowest price (₹)",
        floor,
        setFloor,
        "The price never goes below this.",
      )}
      {field(
        "step",
        `Drop every ${DEFAULT_INTERVAL_MINUTES} minutes (₹)`,
        step,
        setStep,
        "How much the price falls at each step.",
      )}

      <div className="rounded-md border p-3 text-sm" aria-live="polite">
        {!preview && (
          <p className="text-muted-foreground">
            Fill in the three prices to see how the auction will run.
          </p>
        )}
        {preview && "problem" in preview && (
          <p className="text-destructive">{preview.problem}</p>
        )}
        {preview && "minutes" in preview && (
          <p>
            Starts at {formatMoney(toMinor(start))} and reaches{" "}
            {formatMoney(toMinor(floor))} in about {preview.minutes} minutes. If
            nobody has bought it by then, and the food has{" "}
            {CHARITY_CUTOFF_MINUTES} minutes left, it is given away free to an
            NGO.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={pending || !preview || "problem" in preview}
        >
          {pending ? "Starting…" : "Start auction"}
        </Button>
        <Link href="/donor" className={buttonVariants({ variant: "outline" })}>
          Back to donor home
        </Link>
      </div>
    </form>
  );
}
