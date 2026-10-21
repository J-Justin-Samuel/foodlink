import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError, requireUser } from "@/lib/rbac";
import { createWatchToken, isRealtimeConfigured } from "@/lib/realtime";
import { getTrackingSnapshot } from "@/lib/tracking-queries";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/realtime/token?deliveryId=...
 * Hands the browser an Ably token request that can only SUBSCRIBE to this one
 * delivery's channel. Only people allowed to watch the delivery get one, and
 * only while it is active.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const id = z
      .string()
      .uuid()
      .safeParse(new URL(req.url).searchParams.get("deliveryId"));
    if (!id.success) return json({ error: "Missing delivery." }, 400);

    const snapshot = await getTrackingSnapshot(id.data, user);
    if (!snapshot) return json({ error: "Delivery not found." }, 404);
    if (!snapshot.active)
      return json({ error: "This delivery is finished." }, 409);
    if (!isRealtimeConfigured())
      return json({ error: "Live updates are not configured." }, 503);

    return json(await createWatchToken(id.data, user.id));
  } catch (err) {
    if (err instanceof UnauthorizedError)
      return json({ error: "Sign in first." }, 401);
    if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
    console.error("realtime token failed:", err);
    return json({ error: "Could not start live updates." }, 500);
  }
}
