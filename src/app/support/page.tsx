import Link from "next/link";
import { Pill } from "@/components/shared/status-badge";
import { RaiseDisputeForm } from "@/components/shared/raise-dispute-form";
import { myDeliveryOptions, myDisputes } from "@/lib/admin-queries";
import { requireDashboardUser } from "@/lib/guards";
import { ROLE_HOME } from "@/lib/routes";
import { DISPUTE_CATEGORY_LABELS } from "@/lib/validations/stage6";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help - FoodLink" };
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
const STATUS: Record<string, [string, "green" | "amber" | "blue" | "gray"]> = {
  OPEN: ["Open", "amber"],
  IN_REVIEW: ["In review", "blue"],
  RESOLVED: ["Resolved", "green"],
  DISMISSED: ["Closed", "gray"],
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ delivery?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireDashboardUser([
    "DONOR",
    "VOLUNTEER",
    "NGO",
    "BUYER",
    "ADMIN",
  ]);
  const isAdmin = user.role === "ADMIN";
  const [deliveries, mine] = isAdmin
    ? [[], []]
    : await Promise.all([myDeliveryOptions(user.id), myDisputes(user.id)]);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-7 px-4 pb-8 pt-4">
      <div>
        <h1 className="text-3xl font-extrabold">Help</h1>
        <p className="text-sm text-ink/70">
          Something wrong with a delivery, a person or a payment? Tell us and an
          admin will look into it.
        </p>
      </div>
      {isAdmin ? (
        <p className="glass-strong rounded-3xl p-5 text-sm">
          Admins handle reports instead of sending them.{" "}
          <Link
            href="/admin/disputes"
            className="font-bold text-flame underline underline-offset-4"
          >
            Open reported problems
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="glass-strong rounded-3xl p-5">
            <RaiseDisputeForm
              deliveries={deliveries}
              initialDeliveryId={sp.delivery}
            />
          </div>
          <section className="space-y-3" aria-labelledby="mine-h">
            <h2 id="mine-h" className="text-xl font-bold">
              Your reports
            </h2>
            {mine.length === 0 ? (
              <p className="text-sm text-ink/70">
                You haven&apos;t reported anything.
              </p>
            ) : (
              <ul className="space-y-3">
                {mine.map((d) => {
                  const [label, tone] = STATUS[d.status] ?? [
                    d.status,
                    "gray" as const,
                  ];
                  return (
                    <li
                      key={d.id}
                      className="glass-strong space-y-1 rounded-3xl p-4 text-sm"
                    >
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {DISPUTE_CATEGORY_LABELS[
                          d.category as keyof typeof DISPUTE_CATEGORY_LABELS
                        ] ?? d.category}{" "}
                        <Pill tone={tone}>{label}</Pill>
                      </p>
                      <p className="text-xs text-ink/70">
                        {when(d.createdAt)}
                        {d.deliveryTitle ? ` · ${d.deliveryTitle}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap">{d.description}</p>
                      {d.resolutionNote && (
                        <p className="rounded-2xl bg-peach/60 p-3">
                          <strong>FoodLink:</strong> {d.resolutionNote}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
      <Link href={ROLE_HOME[user.role]} className="btn-glass">
        Back to my home page
      </Link>
    </main>
  );
}
