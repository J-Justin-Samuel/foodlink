"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { TIER_META, urgencyTier } from "@/lib/urgency";
import type { NearbyDonation } from "@/types/donation";

interface Props {
  center: { lat: number; lng: number };
  donations: NearbyDonation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Mapbox canvas with pins coloured by urgency tier (red / amber / green). */
export default function DiscoveryMap({
  center,
  donations,
  selectedId,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pinsRef = useRef<mapboxgl.Marker[]>([]);
  const homeRef = useRef<mapboxgl.Marker | null>(null);
  const centerRef = useRef(center);
  centerRef.current = center;

  // Create the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [centerRef.current.lng, centerRef.current.lat],
      zoom: 12,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      pinsRef.current.forEach((m) => m.remove());
      pinsRef.current = [];
      homeRef.current?.remove();
      homeRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // "You are here" marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!homeRef.current) {
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Your location");
      Object.assign(el.style, {
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: "#2563eb",
        border: "3px solid white",
        boxShadow: "0 0 0 2px #2563eb55",
      });
      homeRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([center.lng, center.lat])
        .addTo(map);
    } else {
      homeRef.current.setLngLat([center.lng, center.lat]);
    }
  }, [center]);

  // Donation pins. Number = rank in the urgency-sorted list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    pinsRef.current.forEach((m) => m.remove());
    pinsRef.current = donations.map((d, i) => {
      const tier = urgencyTier(d.urgencyScore);
      const selected = d.id === selectedId;
      const size = selected ? 36 : 28;

      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", `${d.title} — ${TIER_META[tier].label}`);
      el.textContent = String(i + 1);
      Object.assign(el.style, {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: TIER_META[tier].hex,
        color: "white",
        fontSize: "12px",
        fontWeight: "600",
        border: selected ? "3px solid #111827" : "3px solid white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        cursor: "pointer",
        zIndex: selected ? "10" : "1",
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(d.id);
      });

      return new mapboxgl.Marker({ element: el })
        .setLngLat([d.lng, d.lat])
        .addTo(map);
    });
  }, [donations, selectedId, onSelect]);

  // Frame the search point + all results when the result set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (donations.length === 0) {
      map.easeTo({ center: [center.lng, center.lat], zoom: 12 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds(
      [center.lng, center.lat],
      [center.lng, center.lat],
    );
    donations.forEach((d) => bounds.extend([d.lng, d.lat]));
    map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 });
  }, [donations, center]);

  // Pan to the selected donation.
  useEffect(() => {
    const map = mapRef.current;
    const sel = donations.find((d) => d.id === selectedId);
    if (map && sel) map.easeTo({ center: [sel.lng, sel.lat], duration: 400 });
    // Only react to selection changes, not to every result refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground">
        Set <code className="mx-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> in .env.local
        and restart the dev server to enable the map.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
