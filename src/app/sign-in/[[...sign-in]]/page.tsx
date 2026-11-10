import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { AuthFrame } from "@/components/glass/auth-frame";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <AuthFrame
      photo="plate"
      headline="Welcome back. Someone's waiting on a good meal."
      note={
        <>
          New to FoodLink?{" "}
          <Link
            href="/sign-up"
            className="font-bold text-flame underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <SignIn
        appearance={clerkAppearance}
        fallbackRedirectUrl="/post-auth"
        signUpUrl="/sign-up"
      />
    </AuthFrame>
  );
}
