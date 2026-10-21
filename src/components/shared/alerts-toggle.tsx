"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/lib/actions/push";

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "checking" | "unsupported" | "off" | "on" | "blocked";

/** Volunteer opt-in for "food expiring near you" notifications (Web Push). */
export function AlertsToggle({
  vapidPublicKey,
}: {
  vapidPublicKey: string | null;
}) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !vapidPublicKey ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidPublicKey]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(vapidPublicKey!),
        }));
      const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!res.ok) throw new Error(res.error);
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on alerts.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Couldn't turn off alerts.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="text-sm">
        <p className="font-semibold">Alerts for food that is about to expire</p>
        <p className="text-muted-foreground">
          {state === "on"
            ? "On for this device. We'll tell you when unclaimed food within 15 km has 45 minutes left."
            : state === "blocked"
              ? "Notifications are blocked for this site. Allow them in your browser settings, then reload."
              : state === "unsupported"
                ? "This browser or server isn't set up for notifications. If you added a phone number, you may get a text instead."
                : "Get a notification when unclaimed food within 15 km has 45 minutes left."}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-destructive">
            {error}
          </p>
        )}
      </div>
      {state === "off" && (
        <Button type="button" onClick={enable} disabled={busy}>
          {busy ? "Turning on…" : "Turn on alerts"}
        </Button>
      )}
      {state === "on" && (
        <Button
          type="button"
          variant="outline"
          onClick={disable}
          disabled={busy}
        >
          {busy ? "Turning off…" : "Turn off alerts"}
        </Button>
      )}
    </div>
  );
}
