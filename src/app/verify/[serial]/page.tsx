import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-5 px-4 py-10">
      <Link href="/" className="text-lg font-black tracking-tight">
        FoodLink
      </Link>
      <div
        role="status"
        className={`space-y-3 rounded-lg border-2 p-5 ${valid ? "border-green-600" : "border-destructive"}`}
      >
        {result.status === "VALID" && (
          <>
            <h1 className="text-2xl font-bold">
              This {result.kind === "CERTIFICATE" ? "certificate" : "report"} is
              genuine.
            </h1>
            <p className="text-lg font-semibold">{result.name}</p>
            <p className="text-sm text-muted-foreground">{result.summary}</p>
            <p className="text-sm text-muted-foreground">
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
            <h1 className="text-2xl font-bold">
              We have no record of this document.
            </h1>
            <p className="text-sm text-muted-foreground">
              Check the number {result.serial} against the printed document. It
              may have been copied wrongly or forged.
            </p>
          </>
        )}
        {result.status === "INVALID" && (
          <>
            <h1 className="text-2xl font-bold">
              This document does not match our records.
            </h1>
            <p className="text-sm text-muted-foreground">
              The number exists, but the code or the details do not match. Treat
              the document as altered.
            </p>
          </>
        )}
        {result.status === "REVOKED" && (
          <>
            <h1 className="text-2xl font-bold">
              This certificate was withdrawn.
            </h1>
            <p className="text-sm text-muted-foreground">
              FoodLink has cancelled certificate {result.serial}.
            </p>
          </>
        )}
      </div>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Back to home
      </Link>
    </main>
  );
}
