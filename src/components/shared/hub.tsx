import Link from "next/link";
import { ArrowRight, PackageOpen } from "lucide-react";

/** Small building blocks for the role home pages, so every home reads the same way. */
export function StatTiles({
  items,
}: {
  items: { value: string | number; label: string; href?: string }[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((s) => {
        const body = (
          <>
            <p className="font-display text-3xl font-extrabold tabular-nums text-forest">
              {s.value}
            </p>
            <p className="text-xs font-medium text-ink/70">{s.label}</p>
          </>
        );
        return (
          <li key={s.label}>
            {s.href ? (
              <Link href={s.href} className="glass lift block rounded-3xl p-4">
                {body}
              </Link>
            ) : (
              <div className="glass rounded-3xl p-4">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="glass flex flex-col items-center gap-2 rounded-3xl border-dashed p-8 text-center text-sm">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-peach text-flame">
        <PackageOpen className="h-6 w-6" aria-hidden />
      </span>
      <p className="font-display text-base font-bold text-forest">{title}</p>
      {body && <p className="max-w-sm text-ink/70">{body}</p>}
      {href && cta && (
        <Link href={href} className="btn-flame btn-sm mt-2">
          {cta}
        </Link>
      )}
    </div>
  );
}

/** A highlighted "do this next" box at the top of a home page. */
export function NextStep({
  title,
  body,
  href,
  cta,
  tone = "default",
}: {
  title: string;
  body?: string;
  href: string;
  cta: string;
  tone?: "default" | "urgent";
}) {
  return (
    <section
      aria-label="What to do next"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5 shadow-[0_18px_40px_-20px_rgba(249,115,22,0.6)] ${
        tone === "urgent"
          ? "bg-gradient-to-br from-flame/90 to-[#fb923c] text-ink"
          : "bg-gradient-to-br from-peach to-white ring-1 ring-flame/30"
      }`}
    >
      <div className="min-w-0">
        <p className="font-display text-lg font-bold leading-snug text-ink">
          {title}
        </p>
        {body && <p className="text-sm text-ink/80">{body}</p>}
      </div>
      <Link
        href={href}
        className={
          tone === "urgent"
            ? "btn-glass btn-sm !bg-white !text-forest"
            : "btn-flame btn-sm"
        }
      >
        {cta} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

export function QuickLinks({
  items,
}: {
  items: { href: string; label: string; hint: string }[];
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="glass lift group flex h-full items-center justify-between gap-2 rounded-3xl p-4"
          >
            <span>
              <span className="block font-display font-bold text-forest">
                {l.label}
              </span>
              <span className="block text-xs text-ink/70">{l.hint}</span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-flame transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
