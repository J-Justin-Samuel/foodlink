import { eq } from "drizzle-orm";
import { db } from "@/db";
import { esgReports } from "@/db/schema";
import { reportPdfData } from "@/lib/esg-reports";
import { renderReportPdf } from "@/lib/pdf/esg-report";
import { ForbiddenError, UnauthorizedError, requireUser } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (msg: string, status: number) =>
  new Response(msg, { status, headers: { "Cache-Control": "no-store" } });

/** GET /api/reports/:id/pdf — a donor (or an admin) downloads a quarterly CSR report. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return text("Not found", 404);
    const user = await requireUser();
    const [r] = await db.select().from(esgReports).where(eq(esgReports.id, id));
    if (!r || (r.donorId !== user.id && user.role !== "ADMIN"))
      return text("Not found", 404);
    const pdf = await renderReportPdf(await reportPdfData(r));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="foodlink-impact-Q${r.quarter}-${r.year}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return text("Sign in first.", 401);
    if (err instanceof ForbiddenError) return text("Not allowed.", 403);
    console.error("report pdf failed:", err);
    return text("Could not create the PDF.", 500);
  }
}
