import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DisputesGrid } from "@/components/shared/disputes-grid";
import {
  DISPUTE_FILTERS,
  DISPUTE_SORTS,
  listDisputes,
  parseGridQuery,
} from "@/lib/admin-queries";
import { requireDashboardUser } from "@/lib/guards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reported problems - FoodLink admin" };

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireDashboardUser(["ADMIN"]);
  const state = parseGridQuery(await searchParams, {
    sorts: DISPUTE_SORTS,
    defaultSort: "createdAt",
    filters: DISPUTE_FILTERS,
  });
  const { rows, total } = await listDisputes(state);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reported problems</h1>
          <p className="text-sm text-muted-foreground">
            Read each report, decide, and leave a note the reporter can see.
          </p>
        </div>
        <Link
          href="/admin/disputes?status=OPEN"
          className={buttonVariants({ variant: "outline" })}
        >
          Only open
        </Link>
      </div>
      <DisputesGrid rows={rows} total={total} state={state} />
      <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
        Back to admin
      </Link>
    </main>
  );
}
