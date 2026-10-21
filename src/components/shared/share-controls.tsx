"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { reportLocation } from "@/lib/actions/tracking";
import { cleanMotion } from "@/lib/tracking-state";
import { REPORT_EVERY_MS } from "@/lib/validations/stage4";

interface Props {
  deliveryId: string;
  /** Called with every GPS fix so the map can show the volunteer instantly. */
  onFix: (fix: {
    lat: number;
    lng: number;
    heading: number | null;
    speedMps: number | null;
  }) => void;
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Volunteer-only. Watches the phone's GPS and sends the latest fix to the
 * server every 10 seconds (the server then publishes it to the donor and NGO).
 * Works only while this page stays open; browsers pause GPS in background tabs.
 */
export function ShareControls({ deliveryId, onFix }: Props) {
  const storageKey = `foodlink:share:${deliveryId}`;
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(true);
  const latest = useRef<GeolocationPosition | null>(null);
  const firstSent = useRef(false);

  const stop = useCallback(
    (why?: string) => {
      setSharing(false);
      latest.current = null;
      firstSent.current = false;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      if (why) setMessage(why);
    },
    [storageKey],
  );

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setMessage("This browser can't share a location.");
      return;
    }
    setMessage(null);
    setSharing(true);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {}
  }, [storageKey]);

  // Resume after navigating away and back, but only when permission was already given (no surprise prompts).
  useEffect(() => {
    let wanted = false;
    try {
      wanted = sessionStorage.getItem(storageKey) === "1";
    } catch {}
    if (!wanted || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (p.state === "granted") setSharing(true);
      })
      .catch(() => {});
  }, [storageKey]);

  useEffect(() => {
    if (!sharing) return;
    let cancelled = false;
    let wake: WakeLockSentinelLike | null = null;

    const send = async () => {
      const p = latest.current;
      if (!p) return;
      const { heading, speedMps } = cleanMotion(
        p.coords.heading,
        p.coords.speed,
      );
      const res = await reportLocation({
        deliveryId,
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        heading,
        speedMps,
      });
      if (cancelled) return;
      if (res.ok) {
        setLastSentAt(Date.now());
        setLive(res.data.live);
        setMessage(null);
      } else if (res.code === "CONFLICT" || res.code === "NOT_FOUND") {
        stop(res.error);
      } else if (res.code !== "LIMIT") {
        setMessage("Couldn't send your location. Retrying…");
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latest.current = pos;
        const { heading, speedMps } = cleanMotion(
          pos.coords.heading,
          pos.coords.speed,
        );
        onFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading,
          speedMps,
        });
        if (!firstSent.current) {
          firstSent.current = true;
          void send();
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED)
          stop(
            "Location is blocked. Allow location access for this site, then try again.",
          );
        else
          setMessage(
            "Can't get a GPS fix right now. Move to a spot with a clearer sky view.",
          );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    const timer = setInterval(() => void send(), REPORT_EVERY_MS);
    const clock = setInterval(() => setTick((n) => n + 1), 1000);

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {
            request: (t: "screen") => Promise<WakeLockSentinelLike>;
          };
        };
        wake = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {}
    };
    void acquire();
    const onVisible = () =>
      document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
      void wake?.release().catch(() => {});
    };
  }, [sharing, deliveryId, onFix, stop]);

  void tick; // re-render each second for the "sent N s ago" text
  const ago = lastSentAt
    ? Math.max(0, Math.round((Date.now() - lastSentAt) / 1000))
    : null;

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {sharing
              ? "Sharing your live location"
              : "Share your live location"}
          </p>
          <p className="text-sm text-muted-foreground">
            {sharing
              ? ago === null
                ? "Getting your first GPS fix…"
                : `Last sent ${ago} s ago${live ? "" : " (live updates are offline, the donor sees it on refresh)"}`
              : "The donor and NGO can follow you on a map. Keep this page open while you drive."}
          </p>
        </div>
        {sharing ? (
          <Button type="button" variant="outline" onClick={() => stop()}>
            Stop sharing
          </Button>
        ) : (
          <Button type="button" onClick={start}>
            Start sharing
          </Button>
        )}
      </div>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
