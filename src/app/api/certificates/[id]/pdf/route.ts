import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates } from "@/db/schema";
import { renderCertificatePdf } from "@/lib/pdf/certificate";
import { ForbiddenError, UnauthorizedError, requireUser } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (msg: string, status: number) =>
  new Response(msg, { status, headers: { "Cache-Control": "no-store" } });

/** GET /api/certificates/:id/pdf — the volunteer (or an admin) downloads the certificate. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return text("Not found", 404);
    const user = await requireUser();
    const [c] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id));
    if (!c || (c.userId !== user.id && user.role !== "ADMIN"))
      return text("Not found", 404);
    if (c.revokedAt) return text("This certificate was withdrawn.", 410);
    const pdf = await renderCertificatePdf({
      serial: c.serial,
      hash: c.hash,
      holderName: c.holderName,
      deliveriesCount: c.deliveriesCount,
      foodKg: Number(c.foodKg),
      meals: c.meals,
      points: c.points,
      issuedAt: c.issuedAt,
    });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="foodlink-certificate-${c.serial}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return text("Sign in first.", 401);
    if (err instanceof ForbiddenError) return text("Not allowed.", 403);
    console.error("certificate pdf failed:", err);
    return text("Could not create the PDF.", 500);
  }
}
