"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { claimDonation } from "@/lib/actions/claims";
import { findNearbyDonations } from "@/lib/actions/matching";
import { TIER_META, formatTimeLeft, urgencyTier } from "@/lib/urgency";
import {
  CLASSIFICATION_LABELS,
  FOOD_CLASSIFICATIONS,
  type FoodClassification,
  type NearbyDonation,
} from "@/types/donation";

// mapbox-gl touches `window`, so it must never render on the server.
const DiscoveryMap = dynamic(
  () => import("@/components/shared/discovery-map"),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
  },
);

type Center = { lat: number; lng: number };

const REFRESH_MS = 60_000;
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function DiscoveryView({
  initialCenter,
}: {
  initialCenter: Center | null;
}) {
  const [center, setCenter] = useState<Center | null>(initialCenter);
  const [radiusKm, setRadiusKm] = useState(10);
  const [classification, setClassification] = useState<"" | FoodClassification>(
    "",
  );
  const [maxHours, setMaxHours] = useState(0); // 0 = any
  const [donations, setDonations] = useState<NearbyDonation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  const load = useCallback(() => {
    if (!center) return;
    const id = ++requestId.current;
    startTransition(async () => {
      const res = await findNearbyDonations({
        ...center,
        radiusKm,
        classification: classification || undefined,
        maxHoursUntilExpiry: maxHours || undefined,
      });
      if (id !== requestId.current) return; // a newer request superseded this one
      if (res.ok) {
        setDonations(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
    });
  }, [center, radiusKm, classification, maxHours]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll so claimed/expired batches drop off (real-time push arrives in a later stage).
  useEffect(() => {
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    document
      .getElementById(`donation-${id}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation isn't supported in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError(
          "Couldn't read your location. Allow location access and retry.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function handleClaim(id: string) {
    setClaimingId(id);
    setNotice(null);
    const res = await claimDonation(id);
    setClaimingId(null);

    if (res.ok) {
      setDonations((prev) => prev.filter((d) => d.id !== id));
      setSelectedId(null);
      setNotice("Claimed! Head to the pickup address before the food expires.");
      return;
    }
    setNotice(res.error);
    if (["CONFLICT", "EXPIRED", "NOT_FOUND"].includes(res.code)) load();
  }

  return (
    <div className="grid h-[calc(100vh-4rem)] gap-0 lg:grid-cols-[440px_1fr]">
      {/* Left: filters + cards */}
      <div className="flex min-h-0 flex-col border-r">
        <div className="space-y-3 border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Nearby pickups</h1>
            <Button
              size="sm"
              variant="outline"
              onClick={useMyLocation}
              disabled={locating}
            >
              {locating ? "Locating…" : "Use my location"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="mb-1 block text-xs">
                Radius: {radiusKm} km
              </Label>
              <input
                type="range"
                min={1}
                max={25}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Food type</Label>
              <select
                className={selectClass}
                value={classification}
                onChange={(e) =>
                  setClassification(e.target.value as "" | FoodClassification)
                }
              >
                <option value="">All types</option>
                {FOOD_CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {CLASSIFICATION_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Expires within</Label>
              <select
                className={selectClass}
                value={maxHours}
                onChange={(e) => setMaxHours(Number(e.target.value))}
              >
                <option value={0}>Any time</option>
                <option value={2}>2 hours</option>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
              </select>
            </div>
          </div>
        </div>

        {notice && (
          <p role="status" className="border-b bg-muted px-4 py-2 text-sm">
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="border-b px-4 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {!center && (
            <p className="text-sm text-muted-foreground">
              We don&apos;t have a base location for you yet. Tap “Use my
              location” to see pickups around you.
            </p>
          )}
          {center && donations.length === 0 && !isPending && (
            <p className="text-sm text-muted-foreground">
              No active donations match these filters. Try a larger radius.
            </p>
          )}

          {donations.map((d, i) => (
            <DonationCard
              key={d.id}
              rank={i + 1}
              donation={d}
              selected={d.id === selectedId}
              claiming={claimingId === d.id}
              onSelect={() => handleSelect(d.id)}
              onClaim={() => handleClaim(d.id)}
            />
          ))}
        </div>
      </div>

      {/* Right: map */}
      <div className="h-[60vh] lg:h-full">
        {center ? (
          <DiscoveryMap
            center={center}
            donations={donations}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
            Share your location to load the map.
          </div>
        )}
      </div>
    </div>
  );
}

function DonationCard({
  rank,
  donation: d,
  selected,
  claiming,
  onSelect,
  onClaim,
}: {
  rank: number;
  donation: NearbyDonation;
  selected: boolean;
  claiming: boolean;
  onSelect: () => void;
  onClaim: () => void;
}) {
  const tier = urgencyTier(d.urgencyScore);
  const meta = TIER_META[tier];

  return (
    <div
      id={`donation-${d.id}`}
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
        selected
          ? "border-primary ring-1 ring-primary"
          : "hover:border-foreground/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: meta.hex }}
          >
            {rank}
          </span>
          <h2 className="font-medium leading-tight">{d.title}</h2>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {d.donorName ?? "Donor"} · {CLASSIFICATION_LABELS[d.classification]}
      </p>

      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Distance</dt>
          <dd className="font-medium">{d.distanceKm.toFixed(1)} km</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Time left</dt>
          <dd className="font-medium">{formatTimeLeft(d.expiresAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Servings</dt>
          <dd className="font-medium">{d.estimatedServings}</dd>
        </div>
      </dl>

      {selected && (
        <div className="mt-3 space-y-2 border-t pt-3 text-sm">
          <ul className="list-inside list-disc text-xs">
            {d.items.map((it, idx) => (
              <li key={idx}>
                {it.name} — {it.quantity}
                {it.notes ? ` (${it.notes})` : ""}
              </li>
            ))}
          </ul>
          {d.pickupAddress && <p className="text-xs">📍 {d.pickupAddress}</p>}
          {d.pickupInstructions && (
            <p className="text-xs text-muted-foreground">
              {d.pickupInstructions}
            </p>
          )}
        </div>
      )}

      <Button
        className="mt-3 w-full"
        size="sm"
        disabled={claiming}
        onClick={(e) => {
          e.stopPropagation();
          onClaim();
        }}
      >
        {claiming ? "Claiming…" : "Claim pickup"}
      </Button>
    </div>
  );
}
