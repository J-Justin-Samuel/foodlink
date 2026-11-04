"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateMyReport } from "@/lib/actions/esg";

export function ReportButton({
  year,
  quarter,
  label,
}: {
  year: number;
  quarter: number;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        disabled={pending}
        aria-label={`Make the ${label} report`}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await generateMyReport({ year, quarter });
            if (r.ok) router.refresh();
            else setError(r.error);
          })
        }
      >
        {pending ? "Making…" : "Make report"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
