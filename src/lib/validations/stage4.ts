import { z } from "zod";

/** The browser reports a position about every 10 s; the server accepts at most one per this many seconds. */
export const MIN_REPORT_INTERVAL_SECONDS = 4;
/** A shared position older than this is shown as "signal lost". */
export const STALE_AFTER_SECONDS = 45;
export const REPORT_EVERY_MS = 10_000;

export const locationReportSchema = z.object({
  deliveryId: z.string().uuid(),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  /** Degrees clockwise from north, when the device knows it. */
  heading: z.number().finite().min(0).max(360).nullish(),
  speedMps: z.number().finite().min(0).max(120).nullish(),
});
export type LocationReport = z.infer<typeof locationReportSchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(10).max(255),
    auth: z.string().min(10).max(255),
  }),
});

export const endpointSchema = z.object({
  endpoint: z.string().url().max(2048),
});

/** What travels over the realtime channel. */
export interface LivePosition {
  lat: number;
  lng: number;
  heading: number | null;
  speedMps: number | null;
  /** ISO time the server accepted the fix. */
  at: string;
}
