import { DonationForm } from "./donation-form";

export default function NewDonationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">List surplus food</h1>
      <p className="mb-8 mt-1 text-sm text-muted-foreground">
        Tell us what you have, when it was made and where to collect it.
        Volunteers nearby are matched by urgency.
      </p>
      <DonationForm />
    </div>
  );
}
