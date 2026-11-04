import "server-only";
import { sql } from "drizzle-orm";

/*
 * Which onboarding statuses may receive food (NGOs). By default an NGO that finished onboarding
 * (SUBMITTED) can already receive deliveries, so the app works before an admin has looked at it.
 * Set REQUIRE_VERIFIED_NGOS=true to allow only admin-approved NGOs.
 */
export const ngoStatuses = (): string[] =>
  process.env.REQUIRE_VERIFIED_NGOS === "true"
    ? ["VERIFIED"]
    : ["SUBMITTED", "VERIFIED"];
export const ngoStatusSql = () =>
  sql.join(
    ngoStatuses().map((s) => sql`${s}`),
    sql`, `,
  );
