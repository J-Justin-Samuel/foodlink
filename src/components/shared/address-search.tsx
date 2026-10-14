"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export interface ResolvedAddress {
  address: string;
  lat: number;
  lng: number;
}

interface Suggestion extends ResolvedAddress {
  id: string;
  name: string;
}

interface Props {
  /** Called when the user picks a suggestion (exact coordinates resolved). */
  onSelect: (value: ResolvedAddress) => void;
  /** Called when the user edits the text after selecting, invalidating the pin. */
  onClear: () => void;
  resolved: ResolvedAddress | null;
  error?: string;
  placeholder?: string;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Autocomplete address field backed by the Mapbox Geocoding API (v6).
 * Selecting a suggestion yields exact latitude/longitude for PostGIS.
 */
export function AddressSearch({
  onSelect,
  onClear,
  resolved,
  error,
  placeholder = "Start typing the pickup address…",
}: Props) {
  const [query, setQuery] = useState(resolved?.address ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const justSelected = useRef(false);

  // Keep the text in sync if the parent resets the form.
  useEffect(() => {
    if (!resolved) return;
    setQuery(resolved.address);
  }, [resolved]);

  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    if (!TOKEN || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
        url.searchParams.set("q", query.trim());
        url.searchParams.set("access_token", TOKEN);
        url.searchParams.set("limit", "5");
        url.searchParams.set("autocomplete", "true");

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
        const json = (await res.json()) as {
          features: Array<{
            id: string;
            geometry: { coordinates: [number, number] };
            properties: {
              name?: string;
              full_address?: string;
              place_formatted?: string;
            };
          }>;
        };

        setSuggestions(
          json.features.map((f) => ({
            id: f.id,
            name: f.properties.name ?? "",
            address:
              f.properties.full_address ??
              [f.properties.name, f.properties.place_formatted]
                .filter(Boolean)
                .join(", "),
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          })),
        );
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setFetchError("Couldn't search addresses. Check your connection.");
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function handleChange(value: string) {
    setQuery(value);
    if (resolved) onClear();
  }

  function handlePick(s: Suggestion) {
    justSelected.current = true;
    setQuery(s.address);
    setSuggestions([]);
    setOpen(false);
    onSelect({ address: s.address, lat: s.lat, lng: s.lng });
  }

  if (!TOKEN) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        Missing <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in <code>.env.local</code>
        . Address search is disabled until it is set (restart{" "}
        <code>npm run dev</code> afterwards).
      </p>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-invalid={!!error}
      />

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(s)}
              >
                {s.address}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1 min-h-4 text-xs">
        {loading && <span className="text-muted-foreground">Searching…</span>}
        {fetchError && <span className="text-destructive">{fetchError}</span>}
        {!loading && !fetchError && resolved && (
          <span className="text-muted-foreground">
            Pinned at {resolved.lat.toFixed(5)}, {resolved.lng.toFixed(5)}
          </span>
        )}
        {error && !resolved && (
          <span className="text-destructive">{error}</span>
        )}
      </div>
    </div>
  );
}
