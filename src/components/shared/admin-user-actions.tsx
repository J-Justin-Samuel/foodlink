"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auditLicense, reviewUser, setUserActive } from "@/lib/actions/admin";
import type { ActionResult } from "@/types/action-result";

export function AdminUserActions({
  userId,
  status,
  isActive,
  hasLicense,
  canReview,
}: {
  userId: string;
  status: string;
  isActive: boolean;
  hasLicense: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [auditNote, setAuditNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (
    fn: () => Promise<ActionResult<unknown>>,
    done: string,
    after?: () => void,
  ) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (r.ok) {
        setMsg({ ok: true, text: done });
        after?.();
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });

  if (!canReview)
    return (
      <p className="text-sm text-muted-foreground">
        Admin accounts can&apos;t be changed here.
      </p>
    );

  return (
    <div className="space-y-6">
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`rounded-md border-2 p-3 text-sm ${msg.ok ? "border-green-600" : "border-destructive text-destructive"}`}
        >
          {msg.text}
        </p>
      )}

      <section
        className="space-y-2 rounded-lg border-2 p-4"
        aria-labelledby="review-h"
      >
        <h2 id="review-h" className="font-semibold">
          Registration decision
        </h2>
        {status === "SUBMITTED" || status === "VERIFIED" ? (
          <>
            <label className="grid gap-1 text-sm font-medium">
              Note (required to reject, shown to the person)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                className="rounded-md border-2 border-foreground bg-background p-2 text-sm font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {status === "SUBMITTED" && (
                <Button
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => reviewUser({ userId, decision: "APPROVE", note }),
                      "Account approved.",
                      () => setNote(""),
                    )
                  }
                >
                  Approve
                </Button>
              )}
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => reviewUser({ userId, decision: "REJECT", note }),
                    "Account rejected. They can fix the details and send them again.",
                    () => setNote(""),
                  )
                }
              >
                {status === "VERIFIED" ? "Withdraw approval" : "Reject"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {status === "REJECTED"
              ? "Rejected. They can fix their details and submit again, then it shows up here."
              : "This person hasn't submitted their details yet."}
          </p>
        )}
      </section>

      <section
        className="space-y-2 rounded-lg border-2 p-4"
        aria-labelledby="audit-h"
      >
        <h2 id="audit-h" className="font-semibold">
          Licence audit
        </h2>
        {hasLicense ? (
          <>
            <label className="grid gap-1 text-sm font-medium">
              Note (required if it fails)
              <textarea
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                rows={2}
                maxLength={1000}
                className="rounded-md border-2 border-foreground bg-background p-2 text-sm font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      auditLicense({
                        userId,
                        result: "PASSED",
                        note: auditNote,
                      }),
                    "Audit saved: licence passed.",
                    () => setAuditNote(""),
                  )
                }
              >
                Licence is valid
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      auditLicense({
                        userId,
                        result: "FAILED",
                        note: auditNote,
                      }),
                    "Audit saved: licence failed. Their approval was withdrawn.",
                    () => setAuditNote(""),
                  )
                }
              >
                Licence failed
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A failed audit withdraws approval and shows your note to the
              person.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No licence number on file, so there is nothing to audit.
          </p>
        )}
      </section>

      <section
        className="space-y-2 rounded-lg border-2 p-4"
        aria-labelledby="active-h"
      >
        <h2 id="active-h" className="font-semibold">
          Account access
        </h2>
        <p className="text-sm text-muted-foreground">
          {isActive
            ? "This account is active."
            : "This account is suspended and can't use FoodLink."}
        </p>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              () => setUserActive({ userId, active: !isActive }),
              isActive ? "Account suspended." : "Account reactivated.",
            )
          }
        >
          {isActive ? "Suspend account" : "Reactivate account"}
        </Button>
      </section>
    </div>
  );
}
