import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
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
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Help</h1>
        <p className="text-sm text-muted-foreground">
          Something wrong with a delivery, a person or a payment? Tell us and an
          admin will look into it.
        </p>
      </div>
      {isAdmin ? (
        <p className="rounded-lg border-2 p-4 text-sm">
          Admins handle reports instead of sending them.{" "}
          <Link href="/admin/disputes" className="font-semibold underline">
            Open reported problems
          </Link>
          .
        </p>
      ) : (
        <>
          <RaiseDisputeForm
            deliveries={deliveries}
            initialDeliveryId={sp.delivery}
          />
          <section className="space-y-3" aria-labelledby="mine-h">
            <h2 id="mine-h" className="font-semibold">
              Your reports
            </h2>
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">
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
                      className="space-y-1 rounded-lg border-2 p-4 text-sm"
                    >
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {DISPUTE_CATEGORY_LABELS[
                          d.category as keyof typeof DISPUTE_CATEGORY_LABELS
                        ] ?? d.category}{" "}
                        <Pill tone={tone}>{label}</Pill>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {when(d.createdAt)}
                        {d.deliveryTitle ? ` · ${d.deliveryTitle}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap">{d.description}</p>
                      {d.resolutionNote && (
                        <p className="rounded-md bg-muted p-2">
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
      <Link
        href={ROLE_HOME[user.role]}
        className={buttonVariants({ variant: "outline" })}
      >
        Back to my dashboard
      </Link>
    </main>
  );
}
