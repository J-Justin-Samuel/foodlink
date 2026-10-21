import "server-only";
import Ably from "ably";
import type { LivePosition } from "@/lib/validations/stage4";

/*
 * Realtime transport (Ably). Channel per delivery: `delivery:<id>:location`.
 *
 * Browsers never hold the API key and never publish:
 *  - the volunteer's position goes to a Server Action, which validates it,
 *    saves it, then publishes from the server;
 *  - watchers (donor, NGO) get a short-lived token that can ONLY subscribe to
 *    that one delivery's channel.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000;

export const deliveryChannel = (deliveryId: string) =>
  `delivery:${deliveryId}:location`;

export function isRealtimeConfigured(): boolean {
  return !!process.env.ABLY_API_KEY;
}

let rest: Ably.Rest | null = null;
function client(): Ably.Rest {
  const key = process.env.ABLY_API_KEY;
  if (!key) throw new Error("ABLY_API_KEY is not set");
  rest ??= new Ably.Rest({ key });
  return rest;
}

/** Publishes a position. Never throws: the database already has the fix, so a realtime outage only delays watchers. */
export async function publishPosition(
  deliveryId: string,
  position: LivePosition,
): Promise<boolean> {
  if (!isRealtimeConfigured()) return false;
  try {
    await client()
      .channels.get(deliveryChannel(deliveryId))
      .publish("position", position);
    return true;
  } catch (err) {
    console.error("Ably publish failed:", err);
    return false;
  }
}

/** Token request the browser exchanges for a subscribe-only connection to one delivery. */
export async function createWatchToken(deliveryId: string, clientId: string) {
  return client().auth.createTokenRequest({
    clientId,
    ttl: TOKEN_TTL_MS,
    capability: JSON.stringify({
      [deliveryChannel(deliveryId)]: ["subscribe"],
    }),
  });
}
