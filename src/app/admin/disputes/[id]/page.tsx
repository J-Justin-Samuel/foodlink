import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DisputeResolveForm } from "@/components/shared/dispute-resolve-form";
import { Pill } from "@/components/shared/status-badge";
import { getDisputeDetail } from "@/lib/admin-queries";
import { requireDashboardUser } from "@/lib/guards";
import { ROLE_LABEL } from "@/lib/routes";
import { DISPUTE_CATEGORY_LABELS } from "@/lib/validations/stage6";
import type { Role } from "@/types/roles";

export const dynamic = "force-dynamic";
const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(iso))
    : "-";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminDisputePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireDashboardUser(["ADMIN"]);
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const d = await getDisputeDetail(id);
  if (!d) notFound();
  const closed = d.status === "RESOLVED" || d.status === "DISMISSED";
  const person = (p: {
    id: string;
    name: string;
    role: string;
    email: string;
  }) => (
    <Link href={`/admin/users/${p.id}`} className="underline">
      {p.name}
      <span className="text-muted-foreground">
        {" "}
        ({ROLE_LABEL[p.role as Role] ?? p.role}, {p.email})
      </span>
    </Link>
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Link href="/admin/disputes" className="text-sm underline">
        ← All reports
      </Link>
      <div className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          {DISPUTE_CATEGORY_LABELS[
            d.category as keyof typeof DISPUTE_CATEGORY_LABELS
          ] ?? d.category}
          <Pill
            tone={
              d.status === "RESOLVED"
                ? "green"
                : d.status === "DISMISSED"
                  ? "gray"
                  : d.status === "IN_REVIEW"
                    ? "blue"
                    : "amber"
            }
          >
            {d.status.replace("_", " ").toLowerCase()}
          </Pill>
        </h1>
        <p className="text-sm text-muted-foreground">
          Reported {when(d.createdAt)}
        </p>
      </div>

      <section className="space-y-2 rounded-lg border-2 p-4">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Raised by</dt>
          <dd>{person(d.raisedBy)}</dd>
          <dt className="text-muted-foreground">About</dt>
          <dd>{d.against ? person(d.against) : "Nobody named"}</dd>
          <dt className="text-muted-foreground">Delivery</dt>
          <dd>
            {d.delivery
              ? `${d.delivery.title} (${d.delivery.status.replace("_", " ").toLowerCase()})`
              : "None, a general report"}
          </dd>
        </dl>
        <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
          {d.description}
        </p>
      </section>

      {closed ? (
        <section className="space-y-2 rounded-lg border-2 border-foreground p-4">
          <h2 className="font-semibold">Decision ({when(d.resolvedAt)})</h2>
          <p className="whitespace-pre-wrap text-sm">{d.resolutionNote}</p>
          {d.penaltyPoints > 0 && (
            <p className="text-sm">
              Penalty applied: {d.penaltyPoints} points.
            </p>
          )}
        </section>
      ) : (
        <DisputeResolveForm
          disputeId={d.id}
          status={d.status}
          canPenalise={d.against?.role === "VOLUNTEER"}
        />
      )}
      <Link
        href="/admin/disputes"
        className={buttonVariants({ variant: "outline" })}
      >
        Back to reports
      </Link>
    </main>
  );
}
