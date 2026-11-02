import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="glass-strong space-y-4 rounded-[2rem] p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-soft">
          <ShieldCheck className="h-6 w-6 text-orange-vibrant" />
        </span>
        <h1 className="text-3xl font-bold text-forest">Admin</h1>
        <p className="text-sm text-charcoal/70">
          Account review and approval is coming in a later stage.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to home
        </Link>
      </div>
    </main>
  );
}
