import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveries } from "@/db/schema";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/rbac";
import {
  buildHandoffKey,
  devBypassKey,
  isStorageConfigured,
  isStorageDevBypass,
  presignUpload,
} from "@/lib/storage";
import { presignSchema } from "@/lib/validations/stage3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/uploads/presign
 * body: { deliveryId, contentType, contentLength }
 * Returns a short-lived URL the browser PUTs the photo to directly, so image
 * bytes never pass through the Next.js server. Only the volunteer holding the
 * delivery may ask, and only after the donor confirmed pickup. The object key
 * is generated here — the client never chooses where a file is written.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole(["VOLUNTEER"]);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }
    const parsed = presignSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { error: "Photos must be JPEG, PNG or WebP and under 8 MB." },
        400,
      );
    }
    const { deliveryId, contentType, contentLength } = parsed.data;

    const [delivery] = await db
      .select({ status: deliveries.status })
      .from(deliveries)
      .where(
        and(eq(deliveries.id, deliveryId), eq(deliveries.volunteerId, user.id)),
      );
    if (!delivery) return json({ error: "Delivery not found." }, 404);
    if (delivery.status !== "PICKED_UP") {
      return json(
        { error: "Photos can be added after the donor confirms pickup." },
        409,
      );
    }

    if (isStorageDevBypass()) {
      return json({ mode: "bypass", key: devBypassKey(deliveryId) });
    }
    if (!isStorageConfigured()) {
      return json(
        {
          error:
            "Photo storage isn't configured on this server (see README: S3_* variables).",
        },
        503,
      );
    }

    const key = buildHandoffKey(deliveryId, contentType);
    const url = await presignUpload({ key, contentType, contentLength });
    return json({
      mode: "s3",
      url,
      key,
      headers: { "Content-Type": contentType },
      expiresIn: 300,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError)
      return json({ error: "Please sign in." }, 401);
    if (err instanceof ForbiddenError)
      return json({ error: "Only volunteers can upload handoff photos." }, 403);
    console.error("presign failed:", err);
    return json({ error: "Could not prepare the upload." }, 500);
  }
}
