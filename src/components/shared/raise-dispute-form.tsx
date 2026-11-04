"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { raiseDispute } from "@/lib/actions/disputes";
import type { MyDeliveryOption } from "@/lib/admin-queries";
import {
  DISPUTE_CATEGORIES,
  DISPUTE_CATEGORY_LABELS,
} from "@/lib/validations/stage6";

export function RaiseDisputeForm({
  deliveries,
  initialDeliveryId,
}: {
  deliveries: MyDeliveryOption[];
  initialDeliveryId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deliveryId, setDeliveryId] = useState(
    initialDeliveryId && deliveries.some((d) => d.id === initialDeliveryId)
      ? initialDeliveryId
      : "",
  );
  const [against, setAgainst] = useState("");
  const [category, setCategory] = useState<string>("QUALITY");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const parties = deliveries.find((d) => d.id === deliveryId)?.parties ?? [];
  const field =
    "h-10 rounded-md border-2 border-foreground bg-background px-2 text-sm font-normal";

  return (
    <form
      className="space-y-4 rounded-lg border-2 border-foreground p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMsg(null);
          const r = await raiseDispute({
            deliveryId: deliveryId || undefined,
            againstUserId: deliveryId && against ? against : undefined,
            category,
            description,
          });
          if (r.ok) {
            setMsg({
              ok: true,
              text: "Thank you. Our team will look at this and leave a note here.",
            });
            setDescription("");
            setAgainst("");
            router.refresh();
          } else setMsg({ ok: false, text: r.error });
        });
      }}
    >
      <h2 className="font-semibold">Report a problem</h2>
      <label className="grid gap-1 text-sm font-medium">
        What happened?
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={field}
        >
          {DISPUTE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {DISPUTE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Which delivery? (optional)
        <select
          value={deliveryId}
          onChange={(e) => {
            setDeliveryId(e.target.value);
            setAgainst("");
          }}
          className={field}
        >
          <option value="">Not about one delivery</option>
          {deliveries.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title} ({d.status.replace("_", " ").toLowerCase()})
            </option>
          ))}
        </select>
      </label>
      {deliveryId && parties.length > 0 && (
        <label className="grid gap-1 text-sm font-medium">
          Who is it about? (optional)
          <select
            value={against}
            onChange={(e) => setAgainst(e.target.value)}
            className={field}
          >
            <option value="">Nobody in particular</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="grid gap-1 text-sm font-medium">
        Tell us what went wrong
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          minLength={10}
          maxLength={2000}
          required
          className="rounded-md border-2 border-foreground bg-background p-2 text-sm font-normal"
        />
        <span className="text-xs font-normal text-muted-foreground">
          {description.trim().length}/2000, at least 10 characters
        </span>
      </label>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`rounded-md border-2 p-2 text-sm ${msg.ok ? "border-green-600" : "border-destructive text-destructive"}`}
        >
          {msg.text}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending || description.trim().length < 10}
      >
        {pending ? "Sending…" : "Send report"}
      </Button>
    </form>
  );
}
