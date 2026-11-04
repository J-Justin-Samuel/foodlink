import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { UsersGrid } from "@/components/shared/users-grid";
import {
  USER_FILTERS,
  USER_SORTS,
  listUsers,
  parseGridQuery,
} from "@/lib/admin-queries";
import { requireDashboardUser } from "@/lib/guards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts - FoodLink admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireDashboardUser(["ADMIN"]);
  const state = parseGridQuery(await searchParams, {
    sorts: USER_SORTS,
    defaultSort: "createdAt",
    filters: USER_FILTERS,
  });
  const { rows, total } = await listUsers(state);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Approve new NGOs and partners, check licences and suspend accounts.
          </p>
        </div>
        <Link
          href="/admin/users?status=SUBMITTED"
          className={buttonVariants({ variant: "outline" })}
        >
          Waiting for review
        </Link>
      </div>
      <UsersGrid rows={rows} total={total} state={state} />
      <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
        Back to admin
      </Link>
    </main>
  );
}
