export default function OnboardingPendingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">Details submitted</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Our team is verifying your license and address. This usually takes under
        24 hours. You&apos;ll get an email once your account is approved and
        your dashboard unlocks.
      </p>
    </div>
  );
}
