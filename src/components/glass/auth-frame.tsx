import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FoodImage } from "@/components/glass/food-image";
import { Logo } from "@/components/glass/logo";
import type { ImageKey } from "@/lib/images";

/** Shared layout for sign-in and sign-up: the form on frosted glass, a food photo beside it on wide screens. */
export function AuthFrame({
  children,
  photo,
  headline,
  note,
}: {
  children: React.ReactNode;
  photo: ImageKey;
  headline: string;
  note: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-6 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-forest transition-colors hover:bg-peach"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Home
          </Link>
        </div>
        <div className="flex justify-center">{children}</div>
        <p className="text-center text-sm text-ink/75">{note}</p>
      </div>
      <div className="group relative hidden h-[34rem] lg:block">
        <FoodImage
          name={photo}
          priority
          className="h-full w-full shadow-2xl"
          rounded="rounded-[2.5rem]"
        />
        <div className="glass-strong absolute inset-x-6 bottom-6 rounded-3xl p-5">
          <p className="font-display text-2xl font-extrabold text-forest">
            {headline}
          </p>
        </div>
      </div>
    </main>
  );
}
