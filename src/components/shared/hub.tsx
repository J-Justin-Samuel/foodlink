import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

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
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </>
        );
        return (
          <li key={s.label}>
            {s.href ? (
              <Link
                href={s.href}
                className="block rounded-lg border-2 border-foreground p-3 hover:bg-muted"
              >
                {body}
              </Link>
            ) : (
              <div className="rounded-lg border-2 border-foreground p-3">
                {body}
              </div>
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
    <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm">
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 text-muted-foreground">{body}</p>}
      {href && cta && (
        <Link href={href} className={`${buttonVariants()} mt-4`}>
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
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 p-4 ${tone === "urgent" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-foreground bg-muted"}`}
    >
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {body && <p className="text-sm text-muted-foreground">{body}</p>}
      </div>
      <Link href={href} className={buttonVariants()}>
        {cta}
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
            className="block h-full rounded-lg border-2 p-3 hover:border-foreground hover:bg-muted"
          >
            <span className="font-semibold">{l.label}</span>
            <span className="block text-xs text-muted-foreground">
              {l.hint}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
