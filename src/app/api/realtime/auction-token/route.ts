import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError, requireUser } from "@/lib/rbac";
import { createAuctionToken, isRealtimeConfigured } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** GET /api/realtime/auction-token: a subscribe-only token for the shared auction price channel. */
export async function GET() {
  try {
    const user = await requireUser();
    if (!["BUYER", "DONOR", "ADMIN"].includes(user.role))
      return json({ error: "Not allowed." }, 403);
    if (!isRealtimeConfigured())
      return json({ error: "Live updates are not configured." }, 503);
    return json(await createAuctionToken(user.id));
  } catch (err) {
    if (err instanceof UnauthorizedError)
      return json({ error: "Sign in first." }, 401);
    if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
    console.error("auction token failed:", err);
    return json({ error: "Could not start live updates." }, 500);
  }
}
