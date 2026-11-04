"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateLastQuarterReports } from "@/lib/actions/esg";

export function GenerateReportsButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await generateLastQuarterReports();
            if (r.ok) {
              setMsg({
                ok: true,
                text: `${label}: ${r.data.created} new, ${r.data.existing} already made${r.data.failed ? `, ${r.data.failed} failed` : ""}.`,
              });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        {pending ? "Working…" : `Generate reports for ${label}`}
      </Button>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`text-sm ${msg.ok ? "" : "text-destructive"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
