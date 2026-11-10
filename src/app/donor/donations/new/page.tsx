import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DonationForm } from "./donation-form";

export default function NewDonationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-4">
      <Link
        href="/donor"
        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-forest transition-colors hover:bg-peach"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Donor home
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold">List surplus food</h1>
      <p className="mb-6 mt-1 text-sm text-ink/75">
        Take a photo, then tell us what you have, when it was made and where to
        collect it. Volunteers nearby are matched by urgency.
      </p>
      <DonationForm />
    </div>
  );
}
