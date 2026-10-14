/**
 * Stage 2 test data: ~8 LISTED donations scattered around Bengaluru with
 * different distances and expiry times, so the urgency colours and ranking
 * are easy to see on the volunteer map.
 *
 * Prerequisite: `npm run db:seed` (creates the seed donor).
 * Run with:     `npm run db:seed:donations`   (safe to re-run)
 */
import { sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "./index";

const DONOR_EMAIL = "chef.rina@tasteofblr.example";
const otp = () => randomInt(100_000, 1_000_000).toString();

const SPOTS = [
  {
    title: "Biryani trays",
    cls: "COOKED",
    hours: 1.0,
    servings: 40,
    kg: 18,
    lat: 12.9784,
    lng: 77.6408,
    addr: "Indiranagar, Bengaluru",
  },
  {
    title: "Bakery bread & buns",
    cls: "PACKAGED",
    hours: 2.5,
    servings: 60,
    kg: 9,
    lat: 12.9352,
    lng: 77.6245,
    addr: "Koramangala, Bengaluru",
  },
  {
    title: "Wedding buffet",
    cls: "COOKED",
    hours: 3.0,
    servings: 120,
    kg: 45,
    lat: 12.9308,
    lng: 77.5838,
    addr: "Jayanagar, Bengaluru",
  },
  {
    title: "Fresh vegetables",
    cls: "RAW",
    hours: 8.0,
    servings: 80,
    kg: 30,
    lat: 13.0035,
    lng: 77.571,
    addr: "Malleshwaram, Bengaluru",
  },
  {
    title: "Dosa batter & chutney",
    cls: "COOKED",
    hours: 4.0,
    servings: 50,
    kg: 14,
    lat: 12.9116,
    lng: 77.6474,
    addr: "HSR Layout, Bengaluru",
  },
  {
    title: "Packaged snacks",
    cls: "PACKAGED",
    hours: 20,
    servings: 200,
    kg: 25,
    lat: 12.9698,
    lng: 77.75,
    addr: "Whitefield, Bengaluru",
  },
  {
    title: "Canteen lunch surplus",
    cls: "COOKED",
    hours: 1.5,
    servings: 35,
    kg: 12,
    lat: 12.9719,
    lng: 77.5946,
    addr: "MG Road, Bengaluru",
  },
  {
    title: "Fruit crates",
    cls: "RAW",
    hours: 12,
    servings: 90,
    kg: 40,
    lat: 12.8452,
    lng: 77.6602,
    addr: "Electronic City, Bengaluru",
  },
] as const;

async function main() {
  const donors = (await db.execute(
    sql`SELECT id FROM users WHERE email = ${DONOR_EMAIL}`,
  )) as unknown as { id: string }[];
  const donorId = donors[0]?.id;
  if (!donorId) {
    throw new Error(
      `Seed donor ${DONOR_EMAIL} not found — run \`npm run db:seed\` first.`,
    );
  }

  await db.execute(
    sql`DELETE FROM donations WHERE donor_id = ${donorId} AND description LIKE '[seed]%'`,
  );

  for (const s of SPOTS) {
    const items = JSON.stringify([
      { name: s.title, quantity: `${s.servings} servings` },
    ]);
    await db.execute(sql`
      INSERT INTO donations (
        donor_id, title, description, food_classification, estimated_servings,
        quantity_kg, items, prepared_at, shelf_life_expires_at,
        pickup_location, pickup_address, pickup_instructions,
        pickup_otp, dropoff_otp, status
      ) VALUES (
        ${donorId}, ${s.title}, '[seed] test batch', ${s.cls}, ${s.servings},
        ${s.kg}, ${items}::jsonb, now() - interval '30 minutes',
        now() + (${s.hours}::float8 * interval '1 hour'),
        ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography,
        ${s.addr}, 'Ask at the front desk', ${otp()}, ${otp()}, 'LISTED'
      )
    `);
  }
  console.log(`Inserted ${SPOTS.length} test donations.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
