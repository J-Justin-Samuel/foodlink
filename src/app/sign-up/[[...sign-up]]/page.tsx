import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { buttonVariants } from "@/components/ui/button";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <SignUp forceRedirectUrl="/post-auth" signInUrl="/sign-in" />
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-muted-foreground">Already have an account?</span>
        <Link
          href="/sign-in"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Sign in
        </Link>
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
