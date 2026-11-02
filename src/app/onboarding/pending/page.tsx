import Link from "next/link";
import { Clock, MailCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function OnboardingPendingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="glass-strong w-full space-y-4 rounded-[2rem] p-8">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-soft ring-8 ring-orange-soft/50">
          <Clock className="h-8 w-8 text-orange-vibrant" />
        </span>
        <h1 className="text-2xl font-bold text-forest">Details submitted</h1>
        <p className="text-sm leading-relaxed text-charcoal/75">
          We're checking your license and address. This usually takes under 24
          hours.
        </p>
        <p className="flex items-center justify-center gap-2 rounded-2xl bg-fresh/10 px-3 py-2 text-sm font-medium text-forest">
          <MailCheck className="h-4 w-4 text-fresh" />
          You'll get an email when your dashboard unlocks.
        </p>
        <Link
          href="/"
          className={buttonVariants({
            variant: "outline",
            className: "w-full",
          })}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
