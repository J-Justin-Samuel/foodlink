"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LatLng } from "@/lib/geo";

export interface MapPoint extends LatLng {
  label: string;
}
export interface Vehicle extends LatLng {
  heading: number | null;
}

interface Props {
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
  vehicle: Vehicle | null;
  /** [lng, lat] pairs of the road route to the current destination. */
  route: [number, number][] | null;
  /** Changes whenever the map should re-frame (first fix, new destination). */
  frameKey: string;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const ROUTE_SOURCE = "route";

function pin(letter: string, color: string, label: string) {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  el.textContent = letter;
  Object.assign(el.style, {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: color,
    color: "white",
    font: "700 14px system-ui",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "3px solid white",
    boxShadow: "0 1px 5px rgba(0,0,0,.45)",
  });
  return el;
}

function vehicleEl() {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Volunteer's current position");
  el.innerHTML = `<svg viewBox="0 0 40 40" width="40" height="40" style="transition:transform .6s ease;display:block">
    <circle cx="20" cy="20" r="17" fill="#2563eb" fill-opacity=".18"/>
    <circle cx="20" cy="20" r="11" fill="#2563eb" stroke="white" stroke-width="3"/>
    <path d="M20 9 L25 20 L20 17.5 L15 20 Z" fill="white"/></svg>`;
  return el;
}

/** Mapbox canvas: pickup, NGO, a vehicle that glides between fixes, and the route line. */
export default function TrackingMapCanvas({
  pickup,
  dropoff,
  vehicle,
  route,
  frameKey,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const pickupRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffRef = useRef<mapboxgl.Marker | null>(null);
  const vehicleMarker = useRef<mapboxgl.Marker | null>(null);
  const vehicleSvg = useRef<SVGElement | null>(null);
  const shown = useRef<LatLng | null>(null);
  const raf = useRef(0);
  const latest = useRef({ pickup, dropoff, vehicle, route });
  latest.current = { pickup, dropoff, vehicle, route };

  // Create the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const start = latest.current.vehicle ??
      latest.current.pickup ??
      latest.current.dropoff ?? { lat: 12.9716, lng: 77.5946 };
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [start.lng, start.lat],
      zoom: 13,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => {
      loadedRef.current = true;
      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });
      applyRoute(map, latest.current.route);
    });
    mapRef.current = map;
    return () => {
      cancelAnimationFrame(raf.current);
      pickupRef.current?.remove();
      dropoffRef.current?.remove();
      vehicleMarker.current?.remove();
      pickupRef.current = dropoffRef.current = vehicleMarker.current = null;
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Pickup and NGO pins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickupRef.current?.remove();
    dropoffRef.current?.remove();
    pickupRef.current = pickup
      ? new mapboxgl.Marker({
          element: pin("P", "#d97706", `Pickup: ${pickup.label}`),
        })
          .setLngLat([pickup.lng, pickup.lat])
          .addTo(map)
      : null;
    dropoffRef.current = dropoff
      ? new mapboxgl.Marker({
          element: pin("N", "#16a34a", `Drop-off: ${dropoff.label}`),
        })
          .setLngLat([dropoff.lng, dropoff.lat])
          .addTo(map)
      : null;
  }, [pickup, dropoff]);

  // Vehicle: glide to each new position instead of jumping.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!vehicle) {
      vehicleMarker.current?.remove();
      vehicleMarker.current = null;
      shown.current = null;
      return;
    }
    if (!vehicleMarker.current) {
      const el = vehicleEl();
      vehicleSvg.current = el.querySelector("svg");
      vehicleMarker.current = new mapboxgl.Marker({
        element: el,
        rotationAlignment: "map",
      })
        .setLngLat([vehicle.lng, vehicle.lat])
        .addTo(map);
      shown.current = { lat: vehicle.lat, lng: vehicle.lng };
    } else if (shown.current) {
      const from = shown.current;
      const to = vehicle;
      const t0 = performance.now();
      cancelAnimationFrame(raf.current);
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 900);
        const e = 1 - (1 - k) * (1 - k);
        const cur = {
          lat: from.lat + (to.lat - from.lat) * e,
          lng: from.lng + (to.lng - from.lng) * e,
        };
        shown.current = cur;
        vehicleMarker.current?.setLngLat([cur.lng, cur.lat]);
        if (k < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    }
    if (vehicleSvg.current && vehicle.heading != null)
      vehicleSvg.current.style.transform = `rotate(${vehicle.heading}deg)`;
  }, [vehicle]);

  // Route line.
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyRoute(map, route);
  }, [route]);

  // Re-frame on first fix / new destination only, so the viewer can pan freely in between.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { pickup: p, dropoff: d, vehicle: v, route: r } = latest.current;
    const pts: [number, number][] = [];
    if (v) pts.push([v.lng, v.lat]);
    if (p) pts.push([p.lng, p.lat]);
    if (d) pts.push([d.lng, d.lat]);
    if (r) pts.push(...r);
    if (pts.length === 0) return;
    const b = new mapboxgl.LngLatBounds(pts[0], pts[0]);
    pts.forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: 70, maxZoom: 16, duration: 700 });
  }, [frameKey]);

  if (!TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground">
        Set <code className="mx-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> in .env.local
        and restart the dev server to show the map.
      </div>
    );
  }
  return <div ref={containerRef} className="h-full w-full" />;
}

function applyRoute(map: mapboxgl.Map, route: [number, number][] | null) {
  const src = map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
  src?.setData({
    type: "FeatureCollection",
    features:
      route && route.length > 1
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: route },
            },
          ]
        : [],
  });
}
