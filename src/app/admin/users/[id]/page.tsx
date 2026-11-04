import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { AdminUserActions } from "@/components/shared/admin-user-actions";
import { Pill } from "@/components/shared/status-badge";
import { getUserDetail } from "@/lib/admin-queries";
import { requireDashboardUser } from "@/lib/guards";
import { ROLE_LABEL } from "@/lib/routes";
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

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireDashboardUser(["ADMIN"]);
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const u = await getUserDetail(id);
  if (!u) notFound();
  const canReview = u.role !== "ADMIN" && u.id !== admin.id;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <Link href="/admin/users" className="text-sm underline">
        ← All accounts
      </Link>
      <div className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          {u.organization ?? u.name ?? u.email}
          <Pill
            tone={
              u.status === "VERIFIED"
                ? "green"
                : u.status === "SUBMITTED"
                  ? "amber"
                  : u.status === "REJECTED"
                    ? "red"
                    : "gray"
            }
          >
            {u.status.replace("_", " ").toLowerCase()}
          </Pill>
          {!u.isActive && <Pill tone="red">Suspended</Pill>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ROLE_LABEL[u.role as Role] ?? u.role} · {u.email} · joined{" "}
          {when(u.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section
          className="space-y-2 rounded-lg border-2 border-foreground p-4"
          aria-labelledby="det-h"
        >
          <h2 id="det-h" className="font-semibold">
            Details they submitted
          </h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Contact name</dt>
            <dd>{u.name ?? "-"}</dd>
            <dt className="text-muted-foreground">Organisation</dt>
            <dd>{u.organization ?? "-"}</dd>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{u.phone ?? "-"}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd>{u.address || "-"}</dd>
            <dt className="text-muted-foreground">Licence</dt>
            <dd>
              {u.licenseNumber
                ? `${u.licenseType ?? ""} ${u.licenseNumber}`.trim()
                : "None on file"}
            </dd>
            <dt className="text-muted-foreground">Licence file</dt>
            <dd>
              {u.licenseDocumentUrl ? (
                <a
                  href={u.licenseDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Open document
                </a>
              ) : (
                "Not uploaded"
              )}
            </dd>
            <dt className="text-muted-foreground">Activity</dt>
            <dd>
              {u.counts.donations} donations · {u.counts.deliveries} deliveries
              · {u.counts.disputesRaised} reports raised ·{" "}
              {u.counts.disputesAgainst} against
            </dd>
            {u.role === "VOLUNTEER" && (
              <>
                <dt className="text-muted-foreground">Points</dt>
                <dd>{u.rewardPoints}</dd>
              </>
            )}
          </dl>
          {u.reviewNote && (
            <p className="rounded-md bg-muted p-2 text-sm">
              Last decision note: {u.reviewNote}
              <span className="block text-xs text-muted-foreground">
                {u.reviewedByName ?? "An admin"} · {when(u.reviewedAt)}
              </span>
            </p>
          )}
        </section>

        <AdminUserActions
          userId={u.id}
          status={u.status}
          isActive={u.isActive}
          hasLicense={!!u.licenseNumber}
          canReview={canReview}
        />
      </div>

      <section className="space-y-2" aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-semibold">
          Licence audit history
        </h2>
        {u.audits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Never audited.</p>
        ) : (
          <ul className="space-y-2">
            {u.audits.map((a) => (
              <li key={a.id} className="rounded-md border-2 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Pill tone={a.result === "PASSED" ? "green" : "red"}>
                    {a.result === "PASSED" ? "Passed" : "Failed"}
                  </Pill>
                  <span>{a.licenseNumber}</span>
                  <span className="text-muted-foreground">
                    {when(a.at)} · {a.auditor ?? "An admin"}
                  </span>
                </p>
                {a.note && <p className="mt-1">{a.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link
        href="/admin/users"
        className={buttonVariants({ variant: "outline" })}
      >
        Back to accounts
      </Link>
    </main>
  );
}
