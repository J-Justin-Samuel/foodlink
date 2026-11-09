import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DonationForm } from "./donation-form";

export default function NewDonationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/donor"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        ← Donor home
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">List surplus food</h1>
      <p className="mb-8 mt-1 text-sm text-muted-foreground">
        Take a photo, then tell us what you have, when it was made and where to
        collect it. Volunteers nearby are matched by urgency.
      </p>
      <DonationForm />
    </div>
  );
}
