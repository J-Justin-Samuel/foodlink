import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="text-sm text-muted-foreground">
        Review and approve accounts arrives in a later stage.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Back to home
      </Link>
    </main>
  );
}
