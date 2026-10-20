import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { buttonVariants } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <SignIn fallbackRedirectUrl="/post-auth" signUpUrl="/sign-up" />
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-muted-foreground">New to FoodLink?</span>
        <Link
          href="/sign-up"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Create an account
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
