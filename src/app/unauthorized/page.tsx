import Link from "next/link";
import { Compass } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <GlassCard strong className="w-full space-y-4 p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-peach text-flame">
          <Compass className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold">
          This page is for a different role
        </h1>
        <p className="text-sm text-ink/75">
          Your account can&apos;t open that page. Your own dashboard is one tap
          away.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link href="/post-auth" className="btn-flame">
            Go to my dashboard
          </Link>
          <Link href="/" className="btn-glass">
            Home
          </Link>
        </div>
      </GlassCard>
    </main>
  );
}
