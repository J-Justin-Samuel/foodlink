import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { adminOverview } from "@/lib/admin-queries";
import { requireDashboardUser } from "@/lib/guards";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireDashboardUser(["ADMIN"]);
  const o = await adminOverview();
  const cards = [
    {
      n: o.pendingReviews,
      label: "Accounts waiting for review",
      href: "/admin/users?status=SUBMITTED",
      cta: "Review accounts",
      urgent: o.pendingReviews > 0,
    },
    {
      n: o.openDisputes,
      label: "Open reported problems",
      href: "/admin/disputes?status=OPEN",
      cta: "Handle reports",
      urgent: o.openDisputes > 0,
    },
    {
      n: o.failedAudits,
      label: "Accounts with a failed licence audit",
      href: "/admin/users?audit=FAILED",
      cta: "See accounts",
      urgent: false,
    },
    {
      n: o.suspended,
      label: "Suspended accounts",
      href: "/admin/users?active=no",
      cta: "See accounts",
      urgent: false,
    },
  ];
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          {o.users} accounts on FoodLink.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <li
            key={c.label}
            className={`flex flex-col justify-between gap-3 rounded-lg border-2 p-4 ${c.urgent ? "border-amber-500" : "border-foreground"}`}
          >
            <div>
              <p className="text-3xl font-bold">{c.n}</p>
              <p className="text-sm">{c.label}</p>
            </div>
            <Link
              href={c.href}
              className={buttonVariants({
                variant: c.urgent ? "default" : "outline",
              })}
            >
              {c.cta}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/users"
          className={buttonVariants({ variant: "outline" })}
        >
          All accounts
        </Link>
        <Link
          href="/admin/disputes"
          className={buttonVariants({ variant: "outline" })}
        >
          All reports
        </Link>
        <Link
          href="/admin/impact"
          className={buttonVariants({ variant: "outline" })}
        >
          Impact and reports
        </Link>
      </div>
    </main>
  );
}
