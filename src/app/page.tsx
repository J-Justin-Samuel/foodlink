import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { buttonVariants } from "@/components/ui/button";
import { FreshnessGauge } from "@/components/shared/freshness-gauge";
import { computeFreshness } from "@/lib/freshness";

const SAMPLE = computeFreshness({
  tvocPpm: 410,
  surfaceTempC: 6,
  humidityPct: 64,
});

const STEPS = [
  {
    who: "Donor",
    what: "lists surplus food with its address and expiry time.",
  },
  {
    who: "Volunteer",
    what: "claims a nearby pickup, scans the food's freshness, and collects it with a code from the donor.",
  },
  {
    who: "NGO",
    what: "checks the handoff photo and confirms delivery with a second code.",
  },
];

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4">
      <header className="flex h-16 items-center justify-between border-b-2">
        <span className="text-lg font-black tracking-tight">FoodLink</span>
        <nav className="flex items-center gap-2" aria-label="Account">
          {userId ? (
            <Link href="/post-auth" className={buttonVariants({ size: "sm" })}>
              Open my dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Sign in
              </Link>
              <Link href="/sign-up" className={buttonVariants({ size: "sm" })}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="grid items-center gap-10 py-16 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Good food shouldn&apos;t go to waste. Check it, move it, prove it
            arrived.
          </h1>
          <p className="max-w-prose text-muted-foreground">
            FoodLink connects restaurants and shops with volunteers and NGOs. A
            sensor checks how fresh each batch is, and two one-time codes plus a
            photo confirm every handoff.
          </p>
          <div className="flex flex-wrap gap-3">
            {userId ? (
              <Link
                href="/post-auth"
                className={buttonVariants({ size: "lg" })}
              >
                Open my dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className={buttonVariants({ size: "lg" })}
                >
                  Create an account
                </Link>
                <Link
                  href="/sign-in"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>

        <figure className="rounded-lg border-2 border-foreground p-5 text-center">
          <FreshnessGauge score={SAMPLE.score} />
          <figcaption className="mt-2 text-sm text-muted-foreground">
            Example scan: chilled rice at 6 °C, TVOC 410 ppm.
          </figcaption>
        </figure>
      </section>

      <section className="border-t-2 py-12" aria-labelledby="how">
        <h2 id="how" className="mb-6 text-2xl font-bold">
          How a rescue works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.who} className="rounded-lg border p-4">
              <p className="mb-1 text-sm font-bold">Step {i + 1}</p>
              <p>
                <strong>{s.who}</strong> {s.what}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted-foreground">
          Food that fails the freshness check is never given out to eat. It is
          rerouted to composting or an animal shelter.
        </p>
      </section>

      <footer className="mt-auto border-t py-6 text-sm text-muted-foreground">
        Signing up asks you to pick a role: donor, volunteer, NGO or buyer.
      </footer>
    </main>
  );
}
