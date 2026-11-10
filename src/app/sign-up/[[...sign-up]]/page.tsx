import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { AuthFrame } from "@/components/glass/auth-frame";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <AuthFrame
      photo="bowl"
      headline="Join in. Rescue a meal this week."
      note={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-bold text-flame underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUp
        appearance={clerkAppearance}
        forceRedirectUrl="/post-auth"
        signInUrl="/sign-in"
      />
    </AuthFrame>
  );
}
