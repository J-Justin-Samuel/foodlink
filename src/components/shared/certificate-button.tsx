"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { issueMyCertificate } from "@/lib/actions/rewards";

export function CertificateButton({
  disabled,
  hint,
}: {
  disabled: boolean;
  hint?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await issueMyCertificate();
            if (r.ok) {
              setMsg({
                ok: true,
                text: r.data.isNew
                  ? "Certificate ready. Download it below."
                  : "Your latest certificate is already up to date.",
              });
              router.refresh();
            } else setMsg({ ok: false, text: r.error });
          })
        }
      >
        {pending ? "Preparing…" : "Get my certificate"}
      </Button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
