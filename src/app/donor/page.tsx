import Link from "next/link";

export default function DonorHomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Donor dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your listings and handoff history will appear here in a later stage.
      </p>
      <Link
        href="/donor/donations/new"
        className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        List surplus food
      </Link>
    </div>
  );
}
