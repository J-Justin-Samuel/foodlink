import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">
        This page is for a different role
      </h1>
      <p className="text-sm text-muted-foreground">
        Your account can&apos;t open that page. Your own dashboard is one click
        away.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/post-auth" className={buttonVariants()}>
          Go to my dashboard
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Home
        </Link>
      </div>
    </main>
  );
}
