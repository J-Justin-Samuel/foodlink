import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PHOTOS, unsplash } from "@/components/shared/photo";

/** Full-screen photo background with a glass column for Clerk forms. */
export function AuthShell({
  children,
  prompt,
  altHref,
  altLabel,
}: {
  children: React.ReactNode;
  prompt: string;
  altHref: string;
  altLabel: string;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-5 px-4 py-10">
      <Image
        src={unsplash(PHOTOS.spread, 1600)}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-cream/90 via-orange-soft/75 to-fresh/30 backdrop-blur-sm"
      />

      {children}

      <div className="glass flex flex-wrap items-center justify-center gap-2 rounded-full px-4 py-2 text-sm">
        <span className="text-charcoal/70">{prompt}</span>
        <Link
          href={altHref}
          className={buttonVariants({ variant: "cta", size: "sm" })}
        >
          {altLabel}
        </Link>
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>
      </div>
    </main>
  );
}

export const clerkAppearance = {
  elements: {
    card: "!bg-white/75 !backdrop-blur-2xl !border !border-white/80 !shadow-2xl !rounded-3xl",
    formButtonPrimary:
      "!bg-gradient-to-br !from-orange-400 !to-orange-600 hover:!from-orange-500 hover:!to-orange-700 !rounded-full !shadow-lg !shadow-orange-500/30 !normal-case !font-semibold",
    footerActionLink: "!text-orange-600 hover:!text-orange-700",
    headerTitle: "!text-forest !font-bold",
    formFieldInput: "!rounded-2xl focus:!ring-orange-400",
  },
};
