"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { buttonVariants } from "@/components/ui/button";
import {
  fallbackEtaSeconds,
  formatDistance,
  formatEta,
  haversineKm,
  type LatLng,
} from "@/lib/geo";
import {
  healthLabel,
  pickTarget,
  shouldRefetchRoute,
  trackingHealth,
  type TargetKind,
} from "@/lib/tracking-state";
import {
  STALE_AFTER_SECONDS,
  type LivePosition,
} from "@/lib/validations/stage4";
import { ShareControls } from "./share-controls";

const TrackingMapCanvas = dynamic(() => import("./tracking-map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

interface Point extends LatLng {
  label: string;
  address: string | null;
}

interface Props {
  deliveryId: string;
  status: string;
  active: boolean;
  viewer: "VOLUNTEER" | "DONOR" | "NGO" | "ADMIN";
  volunteerName: string;
  pickup: Point | null;
  dropoff: Point | null;
  /** Last saved position from the server (updates when the page refreshes). */
  position: LivePosition | null;
  /** True when ABLY_API_KEY is set on the server. */
  realtime: boolean;
}

type Link = "off" | "connecting" | "live" | "reconnecting";
interface RouteInfo {
  seconds: number;
  km: number;
  approx: boolean;
  line: [number, number][] | null;
  kind: TargetKind;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

async function fetchRoute(
  from: LatLng,
  to: LatLng,
  signal: AbortSignal,
): Promise<Omit<RouteInfo, "kind"> | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      routes?: {
        duration: number;
        distance: number;
        geometry: { coordinates: [number, number][] };
      }[];
    };
    const r = body.routes?.[0];
    if (!r) return null;
    return {
      seconds: r.duration,
      km: r.distance / 1000,
      approx: false,
      line: r.geometry.coordinates,
    };
  } catch {
    return null;
  }
}

export function LiveTracker({
  deliveryId,
  status,
  active,
  viewer,
  volunteerName,
  pickup,
  dropoff,
  position,
  realtime,
}: Props) {
  const [live, setLive] = useState<LivePosition | null>(position);
  const [link, setLink] = useState<Link>("off");
  const [now, setNow] = useState(() => Date.now());
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const lastRoute = useRef<null | {
    from: LatLng;
    kind: TargetKind;
    atMs: number;
  }>(null);
  const abort = useRef<AbortController | null>(null);

  // A fresher fix from the server (page refresh) replaces an older one.
  useEffect(() => {
    if (!position) return;
    setLive((cur) =>
      !cur || new Date(position.at) > new Date(cur.at) ? position : cur,
    );
  }, [position]);

  // Re-render every few seconds so "signal lost" appears without any new data.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // Watchers (donor, NGO, admin) subscribe to the delivery channel.
  useEffect(() => {
    if (!active || !realtime || viewer === "VOLUNTEER") return;
    let closed = false;
    let cleanup: (() => void) | undefined;
    setLink("connecting");
    (async () => {
      const { Realtime } = await import("ably");
      if (closed) return;
      const client = new Realtime({
        authCallback: async (_params, callback) => {
          try {
            const res = await fetch(
              `/api/realtime/token?deliveryId=${deliveryId}`,
              { cache: "no-store" },
            );
            if (!res.ok) throw new Error(`token ${res.status}`);
            callback(null, await res.json());
          } catch (e) {
            callback(e instanceof Error ? e.message : "token error", null);
          }
        },
      });
      client.connection.on((change) => {
        if (closed) return;
        if (change.current === "connected") setLink("live");
        else if (
          change.current === "disconnected" ||
          change.current === "suspended" ||
          change.current === "connecting"
        )
          setLink("reconnecting");
        else if (change.current === "failed" || change.current === "closed")
          setLink("off");
      });
      const channel = client.channels.get(`delivery:${deliveryId}:location`);
      await channel.subscribe("position", (msg) => {
        const p = msg.data as LivePosition;
        if (typeof p?.lat === "number" && typeof p?.lng === "number")
          setLive(p);
      });
      cleanup = () => {
        channel.unsubscribe();
        client.close();
      };
      if (closed) cleanup();
    })().catch(() => setLink("off"));
    return () => {
      closed = true;
      cleanup?.();
    };
  }, [active, realtime, viewer, deliveryId]);

  // The volunteer's own GPS fixes show on their map immediately.
  const onFix = useCallback(
    (fix: {
      lat: number;
      lng: number;
      heading: number | null;
      speedMps: number | null;
    }) => {
      setLive({ ...fix, at: new Date().toISOString() });
    },
    [],
  );

  const target = useMemo(
    () => pickTarget(status, pickup, dropoff),
    [status, pickup, dropoff],
  );
  const health = trackingHealth(
    viewer === "VOLUNTEER" && live
      ? new Date(now).toISOString()
      : (live?.at ?? null),
    now,
    STALE_AFTER_SECONDS,
  );

  // ETA + route, recalculated when the vehicle has moved, the destination changed, or the answer is old.
  const liveLat = live?.lat;
  const liveLng = live?.lng;
  useEffect(() => {
    if (!active || !target || liveLat == null || liveLng == null) {
      setRoute(null);
      lastRoute.current = null;
      return;
    }
    const from = { lat: liveLat, lng: liveLng };
    const next = { from, kind: target.kind, atMs: Date.now() };
    if (!shouldRefetchRoute(lastRoute.current, next)) return;
    lastRoute.current = next;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    fetchRoute(from, target.point, ctl.signal).then((r) => {
      if (ctl.signal.aborted) return;
      if (r) setRoute({ ...r, kind: target.kind });
      else
        setRoute({
          seconds: fallbackEtaSeconds(from, target.point),
          km: haversineKm(from, target.point) * 1.3,
          approx: true,
          line: null,
          kind: target.kind,
        });
    });
    return () => ctl.abort();
  }, [active, target, liveLat, liveLng, now]);

  const dest = target?.kind === "DROPOFF" ? "the NGO" : "the pickup";
  const frameKey = `${target?.kind ?? "none"}:${live ? "fix" : "nofix"}`;
  const navHref = target
    ? `https://www.google.com/maps/dir/?api=1&destination=${target.point.lat},${target.point.lng}&travelmode=driving`
    : null;

  return (
    <section className="space-y-4" aria-label="Live delivery map">
      {viewer === "VOLUNTEER" && active && (
        <ShareControls deliveryId={deliveryId} onFix={onFix} />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-2 border-foreground p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            {!active
              ? "This delivery is finished."
              : target
                ? `On the way to ${dest}${target.point.label ? `: ${target.point.label}` : ""}`
                : "Destination not set yet"}
          </p>
          {active && route && target ? (
            <p className="text-2xl font-black" aria-live="polite">
              {formatEta(route.seconds)}
              <span className="ml-2 text-base font-medium text-muted-foreground">
                {formatDistance(route.km)}
                {route.approx ? " · approximate" : ""}
              </span>
            </p>
          ) : active ? (
            <p className="text-sm font-medium">
              {viewer === "VOLUNTEER"
                ? "Start sharing to see your ETA."
                : `${volunteerName} hasn't shared a location yet.`}
            </p>
          ) : null}
        </div>
        {active && (
          <p
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              health === "LIVE"
                ? "border-green-600 text-green-700 dark:text-green-400"
                : health === "STALE"
                  ? "border-destructive text-destructive"
                  : ""
            }`}
            role="status"
          >
            {viewer === "VOLUNTEER"
              ? live
                ? "Sharing"
                : "Not sharing yet"
              : healthLabel(health, live?.at ?? null, now)}
            {viewer !== "VOLUNTEER" && realtime && link === "reconnecting"
              ? " · reconnecting…"
              : ""}
          </p>
        )}
        {viewer === "VOLUNTEER" && active && navHref && (
          <a
            href={navHref}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Navigate in Google Maps
          </a>
        )}
      </div>

      <div className="h-[55vh] min-h-72 overflow-hidden rounded-lg border">
        <TrackingMapCanvas
          pickup={pickup}
          dropoff={dropoff}
          vehicle={
            active && live
              ? { lat: live.lat, lng: live.lng, heading: live.heading }
              : null
          }
          route={active ? (route?.line ?? null) : null}
          frameKey={frameKey}
        />
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">P</strong> Pickup
          {pickup
            ? `: ${pickup.label}${pickup.address ? `, ${pickup.address}` : ""}`
            : ""}
        </li>
        <li>
          <strong className="text-foreground">N</strong> Drop-off
          {dropoff
            ? `: ${dropoff.label}${dropoff.address ? `, ${dropoff.address}` : ""}`
            : ": not chosen yet"}
        </li>
        <li>Blue arrow: {volunteerName}</li>
      </ul>
    </section>
  );
}
