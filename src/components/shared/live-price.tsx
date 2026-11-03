"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  atFloor,
  nextDropAtMs,
  priceAt,
  type AuctionPricing,
} from "@/lib/auction-price";
import { formatMoney } from "@/lib/money";

export interface LivePricingProps {
  auctionId: string;
  pricing: AuctionPricing;
  /** Server clock when the page was rendered; corrects for a wrong clock on the viewer's device. */
  serverNowMs: number;
  /** True when ABLY_API_KEY is set, so price-change events can be received. */
  realtime: boolean;
  currency?: string;
}

/**
 * The live price. It is calculated here from the clock with the same formula the
 * server uses, so it ticks down on its own; Ably events (price step, sold, cancelled)
 * just make the page refresh right away.
 */
export function useAuctionClock({
  auctionId,
  pricing,
  serverNowMs,
  realtime,
}: LivePricingProps) {
  const router = useRouter();
  // offset = server time minus this device's time, measured once when the page arrives
  const offset = useMemo(() => serverNowMs - Date.now(), [serverNowMs]);
  const [now, setNow] = useState(() => serverNowMs);
  const [link, setLink] = useState<"off" | "live" | "reconnecting">("off");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);

  useEffect(() => {
    if (!realtime) return;
    let closed = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const { Realtime } = await import("ably");
      if (closed) return;
      const client = new Realtime({
        authCallback: async (_p, cb) => {
          try {
            const res = await fetch("/api/realtime/auction-token", {
              cache: "no-store",
            });
            if (!res.ok) throw new Error(`token ${res.status}`);
            cb(null, await res.json());
          } catch (e) {
            cb(e instanceof Error ? e.message : "token error", null);
          }
        },
      });
      client.connection.on((c) => {
        if (closed) return;
        setLink(
          c.current === "connected"
            ? "live"
            : c.current === "failed" || c.current === "closed"
              ? "off"
              : "reconnecting",
        );
      });
      const channel = client.channels.get("auctions:live");
      await channel.subscribe("auction", (msg) => {
        const e = msg.data as { auctionId?: string };
        if (e?.auctionId === auctionId) router.refresh();
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
  }, [realtime, auctionId, router]);

  const priceMinor = priceAt(pricing, now);
  const nextDrop = nextDropAtMs(pricing, now);
  return {
    now,
    priceMinor,
    atFloor: atFloor(pricing, now),
    secondsToDrop:
      nextDrop === null
        ? null
        : Math.max(0, Math.ceil((nextDrop - now) / 1000)),
    nextDropMinor: nextDrop === null ? null : priceAt(pricing, nextDrop),
    link,
  };
}

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** A compact price with a countdown to the next drop. Used on the auction list. */
export function LivePrice(props: LivePricingProps) {
  const c = useAuctionClock(props);
  return (
    <div>
      <p className="text-2xl font-black tabular-nums" aria-live="off">
        {formatMoney(c.priceMinor, props.currency)}
      </p>
      <p className="text-xs text-muted-foreground">
        {c.secondsToDrop === null
          ? "Lowest price reached"
          : `Drops to ${formatMoney(c.nextDropMinor!, props.currency)} in ${mmss(c.secondsToDrop)}`}
      </p>
    </div>
  );
}
