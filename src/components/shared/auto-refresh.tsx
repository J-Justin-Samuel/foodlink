"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the server data on an interval so a page updates when someone
 * ELSE does their step (donor enters a code, NGO confirms). Pauses while the
 * tab is hidden. Real-time push replaces this in a later stage.
 */
export function AutoRefresh({ everyMs = 6000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const t = setInterval(tick, everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}
