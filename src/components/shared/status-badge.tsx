import { STATUS_META, type FreshnessStatus } from "@/lib/freshness";

type Tone = "green" | "amber" | "red" | "blue" | "gray";

const TONE: Record<Tone, string> = {
  green: "bg-fresh/15 text-forest ring-1 ring-fresh/40",
  amber: "bg-peach text-[#9a3412] ring-1 ring-flame/30",
  red: "bg-red-100 text-red-900 ring-1 ring-red-300",
  blue: "bg-sky-100 text-sky-900 ring-1 ring-sky-300",
  gray: "bg-mist text-ink/70 ring-1 ring-black/5",
};

export function Pill({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const DONATION: Record<string, [string, Tone]> = {
  LISTED: ["Waiting for a volunteer", "blue"],
  CLAIMED: ["Volunteer on the way", "amber"],
  IN_TRANSIT: ["Heading to the NGO", "blue"],
  DELIVERED: ["Delivered", "green"],
  DIVERTED: ["Reclassified", "red"],
  EXPIRED: ["Expired", "gray"],
  CANCELLED: ["Cancelled", "gray"],
};

const DELIVERY: Record<string, [string, Tone]> = {
  ASSIGNED: ["Waiting for pickup", "amber"],
  PICKED_UP: ["Heading to the NGO", "blue"],
  EN_ROUTE: ["Heading to the NGO", "blue"],
  DELIVERED: ["Delivered", "green"],
  FAILED: ["Cancelled", "gray"],
};

export function DonationStatus({ status }: { status: string }) {
  const [label, tone] = DONATION[status] ?? [status, "gray" as Tone];
  return <Pill tone={tone}>{label}</Pill>;
}

export function DeliveryStatus({ status }: { status: string }) {
  const [label, tone] = DELIVERY[status] ?? [status, "gray" as Tone];
  return <Pill tone={tone}>{label}</Pill>;
}

export function FreshnessBadge({
  status,
  score,
}: {
  status: string | null | undefined;
  score?: number | null;
}) {
  if (!status || !(status in STATUS_META)) return null;
  const meta = STATUS_META[status as FreshnessStatus];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
    >
      {meta.label}
      {typeof score === "number" ? ` · ${score}/100` : ""}
    </span>
  );
}
