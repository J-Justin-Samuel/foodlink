import { STATUS_META, type FreshnessStatus } from "@/lib/freshness";

type Tone = "green" | "amber" | "red" | "blue" | "gray";

const TONE: Record<Tone, string> = {
  green: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  red: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  blue: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  gray: "bg-muted text-muted-foreground",
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
      className={`inline-flex shrink-0 items-center rounded-sm px-2 py-0.5 text-xs font-semibold ${TONE[tone]}`}
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
      className={`inline-flex shrink-0 items-center rounded-sm px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
    >
      {meta.label}
      {typeof score === "number" ? ` · ${score}/100` : ""}
    </span>
  );
}
