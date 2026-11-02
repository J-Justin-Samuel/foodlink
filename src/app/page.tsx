import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import {
  ThermometerSnowflake,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Leaf,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FreshnessGauge } from "@/components/shared/freshness-gauge";
import { GlassBottomNav } from "@/components/shared/glass-bottom-nav";
import { Photo, PHOTOS } from "@/components/shared/photo";
import { computeFreshness } from "@/lib/freshness";

const SAMPLE = computeFreshness({
  tvocPpm: 410,
  surfaceTempC: 6,
  humidityPct: 64,
});

const STEPS = [
  {
    who: "Donor",
    title: "List surplus in seconds",
    what: "Add the dish, servings and a safe-to-eat window. Your location is attached automatically.",
    badge: "Fast dispatch",
    photo: PHOTOS.spread,
    icon: MapPin,
  },
  {
    who: "Volunteer",
    title: "Pick up and test freshness",
    what: "Get a nearby route alert, scan the sensor reading, and confirm pickup with a 6-digit PIN.",
    badge: "Sensor verified",
    photo: PHOTOS.plate,
    icon: ThermometerSnowflake,
  },
  {
    who: "NGO",
    title: "Confirm what arrived",
    what: "Check the handoff photo, enter the drop-off code, and the delivery is proven on both sides.",
    badge: "Two-party proof",
    photo: PHOTOS.veg,
    icon: ShieldCheck,
  },
];

const ROLES = [
  {
    label: "Hotels & caterers",
    blurb: "Turn tonight's extra into tomorrow's meal.",
    photo: PHOTOS.pizza,
  },
  {
    label: "Volunteers",
    blurb: "Deliver food on your way, on your schedule.",
    photo: PHOTOS.pancakes,
  },
  {
    label: "Shelters & NGOs",
    blurb: "Know exactly what is coming and when.",
    photo: PHOTOS.bowl,
  },
  {
    label: "Bulk buyers",
    blurb: "Bid on surplus that can't be donated.",
    photo: PHOTOS.market,
  },
];

export default async function HomePage() {
  const { userId } = await auth();
  const primaryHref = userId ? "/post-auth" : "/sign-up";

  return (
    <div className="relative min-h-screen overflow-x-clip pb-32">
      {/* ambient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-orange-vibrant/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-[38rem] h-72 w-72 rounded-full bg-fresh/20 blur-3xl"
      />

      {/* Header */}
      <header className="sticky top-0 z-40 px-4 pt-3">
        <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full pl-3 pr-2">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-soft p-1.5 ring-1 ring-orange-200">
              <Image
                src="/logo.png"
                alt=""
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight">
              <span className="text-forest">Food</span>
              <span className="text-orange-vibrant">Link</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {userId ? (
              <Link
                href="/post-auth"
                className={buttonVariants({ variant: "cta", size: "sm" })}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className={buttonVariants({ variant: "cta", size: "sm" })}
                >
                  Join
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="home" className="mx-auto max-w-6xl px-4">
        {/* HERO */}
        <section className="grid items-center gap-10 pb-16 pt-10 md:grid-cols-[1.05fr_1fr] md:pt-16">
          <div className="animate-rise space-y-6">
            <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-forest">
              <Leaf className="h-3.5 w-3.5 text-fresh" />
              Surplus food, checked by sensors
            </span>

            <h1 className="text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-forest sm:text-6xl lg:text-7xl">
              Good food belongs on a plate, not in the bin.
            </h1>

            <p className="max-w-lg text-base leading-relaxed text-charcoal/75 sm:text-lg">
              FoodLink connects kitchens with nearby volunteers and shelters. A
              freshness sensor checks every batch, and a PIN on each end proves
              it arrived.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className={buttonVariants({ variant: "cta", size: "lg" })}
              >
                List surplus food
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Volunteer or partner
              </Link>
            </div>

            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs font-medium text-charcoal/70">
              {[
                "Live nearby routing",
                "Sensor-graded freshness",
                "PIN-confirmed handoff",
              ].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-fresh" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Photo collage with floating glass chips */}
          <div className="animate-rise relative mx-auto w-full max-w-md [animation-delay:150ms] md:max-w-none">
            <div className="group relative aspect-[4/5] overflow-hidden rounded-[2.5rem] shadow-2xl shadow-orange-900/20 ring-4 ring-white/70">
              <Photo
                id={PHOTOS.bowl}
                alt="Fresh rice bowl with vegetables"
                className="absolute inset-0"
                sizes="(min-width: 768px) 45vw, 90vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            </div>

            <div className="glass-strong animate-float absolute -left-2 top-8 flex items-center gap-3 rounded-2xl p-3 sm:-left-8">
              <div className="scale-[0.55] origin-left -mr-14 -my-6">
                <FreshnessGauge score={SAMPLE.score} />
              </div>
              <div className="pl-12">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Freshness
                </p>
                <p className="text-sm font-bold text-forest">Ready to eat</p>
              </div>
            </div>

            <div className="glass-strong animate-float absolute -right-2 bottom-24 flex items-center gap-2.5 rounded-2xl p-3 [animation-delay:1.5s] sm:-right-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fresh/15">
                <CheckCircle2 className="h-5 w-5 text-fresh" />
              </span>
              <div>
                <p className="text-sm font-bold text-charcoal">Delivered</p>
                <p className="text-[11px] text-muted-foreground">
                  40 servings · 2.1 km
                </p>
              </div>
            </div>

            <div className="glass-orange absolute inset-x-4 bottom-4 flex items-center justify-between rounded-2xl px-4 py-3 text-white">
              <div>
                <p className="text-xs font-medium text-white/85">
                  Nearby pickup
                </p>
                <p className="font-display text-base font-bold">
                  Veg biryani, 40 servings
                </p>
              </div>
              <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-bold">
                1.2 km
              </span>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="scroll-mt-24 py-12">
          <div className="mb-8 max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
              From kitchen counter to shelter table
            </h2>
            <p className="mt-2 text-sm text-charcoal/70 sm:text-base">
              Three people, three quick actions, one verified delivery.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <article
                key={s.title}
                className="glass group overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-orange-900/15"
              >
                <Photo id={s.photo} alt="" className="h-44 w-full" />
                <div className="space-y-2 p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-bold text-orange-vibrant">
                      <s.icon className="h-4 w-4" />
                      {s.who}
                    </span>
                    <span className="rounded-full bg-fresh/15 px-2.5 py-0.5 text-[11px] font-semibold text-forest">
                      {s.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-forest">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-charcoal/75">
                    {s.what}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SENSOR SPOTLIGHT */}
        <section className="py-12">
          <div className="glass-strong relative grid items-center gap-8 overflow-hidden rounded-[2rem] p-6 sm:p-10 md:grid-cols-2">
            <div
              aria-hidden
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-vibrant/20 blur-3xl"
            />
            <div className="relative space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
                A freshness score you can trust
              </h2>
              <p className="text-charcoal/75">
                Temperature, humidity and gas readings are combined into one
                score before anyone picks up. Batches that fail are sent to
                composters or animal rescue instead.
              </p>
              <Link
                href={primaryHref}
                className={buttonVariants({ variant: "cta" })}
              >
                Try it with your first batch
              </Link>
            </div>
            <div className="relative flex flex-col items-center rounded-3xl bg-white/60 p-6 backdrop-blur-xl">
              <FreshnessGauge score={SAMPLE.score} />
              <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
                {[
                  ["Temp", "6.0 °C"],
                  ["TVOC", "410 ppm"],
                  ["Humidity", "64%"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-2xl bg-orange-soft/70 p-2.5 transition-colors hover:bg-orange-soft"
                  >
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {k}
                    </p>
                    <p className="text-sm font-bold text-charcoal">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ROLES */}
        <section id="roles" className="scroll-mt-24 py-12">
          <h2 className="mb-8 text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
            Find your place in the network
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {ROLES.map((r) => (
              <Link
                key={r.label}
                href={primaryHref}
                className="group relative aspect-[3/4] overflow-hidden rounded-3xl shadow-lg ring-1 ring-white/60 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-orange-900/25"
              >
                <Photo
                  id={r.photo}
                  alt=""
                  className="absolute inset-0"
                  sizes="(min-width: 768px) 25vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="glass absolute inset-x-2 bottom-2 rounded-2xl p-3 transition-colors duration-300 group-hover:bg-white/80">
                  <p className="font-display text-sm font-bold text-forest sm:text-base">
                    {r.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-charcoal/75 sm:text-xs">
                    {r.blurb}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="join" className="scroll-mt-24 py-12">
          <div className="group relative overflow-hidden rounded-[2rem] shadow-2xl shadow-orange-900/25">
            <Photo
              id={PHOTOS.spread}
              alt=""
              className="absolute inset-0"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-orange-600/90 via-orange-500/80 to-forest/80" />
            <div className="relative flex flex-col items-start gap-5 p-8 text-white sm:p-14">
              <h2 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-5xl">
                Tonight's leftovers can feed someone tonight.
              </h2>
              <p className="max-w-md text-white/90">
                Sign up, choose your role, and get verified. Most accounts are
                approved within a day.
              </p>
              <Link
                href={primaryHref}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-base font-bold text-orange-600 shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-orange-soft"
              >
                Join FoodLink
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pt-6 text-center text-xs text-muted-foreground">
        © 2026 FoodLink · Public Good Initiative
      </footer>

      <GlassBottomNav
        items={[
          { href: "#home", label: "Home", icon: "home" },
          { href: "#how", label: "How it works", icon: "compass" },
          { href: "#roles", label: "Roles", icon: "users" },
          userId
            ? { href: "/post-auth", label: "Dashboard", icon: "dashboard" }
            : { href: "/sign-in", label: "Sign in", icon: "login" },
        ]}
      />
    </div>
  );
}
