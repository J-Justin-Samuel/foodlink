import "server-only";
import webpush from "web-push";

/*
 * Outbound alerts. Two channels, both optional (unconfigured = skipped):
 *  - Web Push (VAPID keys) to browsers that opted in,
 *  - SMS through Twilio's REST API, used when a volunteer has no working push.
 */

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}
export interface AlertMessage {
  title: string;
  body: string;
  /** Where tapping the notification goes. */
  url: string;
  /** Same tag replaces the earlier notification instead of stacking. */
  tag: string;
}
export type PushResult = "sent" | "gone" | "failed" | "disabled";

export function isPushConfigured(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}
export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  );
}

let vapidReady = false;
export async function sendWebPush(
  target: PushTarget,
  message: AlertMessage,
): Promise<PushResult> {
  if (!isPushConfigured()) return "disabled";
  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    vapidReady = true;
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(message),
      { TTL: 60 * 30, urgency: "high" },
    );
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410: the browser unsubscribed. The caller deletes the dead row.
    if (status === 404 || status === 410) return "gone";
    console.error("Web Push failed:", status ?? err);
    return "failed";
  }
}

/**
 * Turns what a person typed into an SMS number, or null. Indian mobile numbers
 * (10 digits starting 6-9) get +91, since FoodLink's default country is India;
 * anything else must already start with "+".
 */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw.replace(/[\s\-().]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  if (/^0[6-9]\d{9}$/.test(compact)) return `+91${compact.slice(1)}`;
  return null;
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!isSmsConfigured()) return false;
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: process.env.TWILIO_FROM!,
          Body: body,
        }),
      },
    );
    if (!res.ok) console.error("Twilio SMS failed:", res.status);
    return res.ok;
  } catch (err) {
    console.error("Twilio SMS error:", err);
    return false;
  }
}
