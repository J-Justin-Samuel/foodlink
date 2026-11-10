import Link from "next/link";
import { BadgeCheck, ShieldAlert, SearchX, Ban } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { Logo } from "@/components/glass/logo";
import { verifySerial } from "@/lib/certificates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify a FoodLink document" };

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ serial: string }>;
  searchParams: Promise<{ h?: string }>;
}) {
  const { serial } = await params;
  const { h } = await searchParams;
  const result = await verifySerial(
    decodeURIComponent(serial),
    h && /^[0-9a-f]{8,64}$/i.test(h) ? h : null,
  );
  const valid = result.status === "VALID";
  const Icon = valid
    ? BadgeCheck
    : result.status === "NOT_FOUND"
      ? SearchX
      : result.status === "REVOKED"
        ? Ban
        : ShieldAlert;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-5 px-4 py-10">
      <Logo />
      <GlassCard
        strong
        role="status"
        className={`space-y-3 p-6 ring-2 ${valid ? "ring-fresh" : "ring-destructive/60"}`}
      >
        <span
          className={`grid h-14 w-14 place-items-center rounded-2xl ${valid ? "bg-fresh/15 text-forest" : "bg-red-100 text-destructive"}`}
        >
          <Icon className="h-8 w-8" aria-hidden />
        </span>
        {result.status === "VALID" && (
          <>
            <h1 className="text-2xl font-extrabold">
              This {result.kind === "CERTIFICATE" ? "certificate" : "report"} is
              genuine.
            </h1>
            <p className="text-lg font-semibold">{result.name}</p>
            <p className="text-sm text-ink/75">{result.summary}</p>
            <p className="text-sm text-ink/75">
              Issued{" "}
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "long",
                timeZone: "Asia/Kolkata",
              }).format(result.issuedAt)}{" "}
              · No. {result.serial}
            </p>
          </>
        )}
        {result.status === "NOT_FOUND" && (
          <>
            <h1 className="text-2xl font-extrabold !text-destructive">
              We have no record of this document.
            </h1>
            <p className="text-sm text-ink/75">
              Check the number {result.serial} against the printed document. It
              may have been copied wrongly or forged.
            </p>
          </>
        )}
        {result.status === "INVALID" && (
          <>
            <h1 className="text-2xl font-extrabold !text-destructive">
              This document does not match our records.
            </h1>
            <p className="text-sm text-ink/75">
              The number exists, but the code or the details do not match. Treat
              the document as altered.
            </p>
          </>
        )}
        {result.status === "REVOKED" && (
          <>
            <h1 className="text-2xl font-extrabold !text-destructive">
              This certificate was withdrawn.
            </h1>
            <p className="text-sm text-ink/75">
              FoodLink has cancelled certificate {result.serial}.
            </p>
          </>
        )}
      </GlassCard>
      <Link href="/" className="btn-glass self-start">
        Back to home
      </Link>
    </main>
  );
}
