import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-forest",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-fresh to-forest text-base shadow-md"
      >
        🌿
      </span>
      FoodLink
    </Link>
  );
}
