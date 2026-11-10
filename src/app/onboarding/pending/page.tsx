import { Hourglass } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";

export default function OnboardingPendingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <GlassCard strong className="space-y-3 p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-peach text-flame">
          <Hourglass className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold">Details submitted</h1>
        <p className="text-sm text-ink/75">
          Our team is verifying your licence and address. This usually takes
          under 24 hours. You&apos;ll get an email once your account is approved
          and your dashboard unlocks.
        </p>
      </GlassCard>
    </main>
  );
}
