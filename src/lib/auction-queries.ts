import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { toMinor } from "@/lib/auction-price";
import { cleanPhotoList } from "@/lib/food-photo-rules";
import type { DonationItem, FoodClassification } from "@/types/donation";

const iso = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString() : null;
const rows = async <T>(q: ReturnType<typeof sql>) =>
  (await db.execute(q)) as unknown as T[];

export interface AuctionCard {
  id: string;
  donationId: string;
  title: string;
  donorName: string | null;
  address: string | null;
  classification: FoodClassification;
  servings: number;
  quantityKg: number;
  items: DonationItem[];
  expiresAt: string;
  startMinor: number;
  floorMinor: number;
  stepMinor: number;
  intervalMinutes: number;
  startsAtMs: number;
  status: string;
  distanceKm: number | null;
  photos: string[];
}

const toCard = (x: Record<string, any>): AuctionCard => ({
  id: x.id,
  donationId: x.donation_id,
  title: x.title,
  donorName: x.donor_name,
  address: x.pickup_address,
  classification: x.food_classification,
  servings: x.estimated_servings,
  quantityKg: x.quantity_kg,
  items: x.items ?? [],
  expiresAt: iso(x.ends_at)!,
  startMinor: toMinor(x.start_price),
  floorMinor: toMinor(x.reserve_price),
  stepMinor: toMinor(x.decrement_step ?? 0),
  intervalMinutes: x.interval_minutes,
  startsAtMs: new Date(x.starts_at).getTime(),
  status: x.status,
  distanceKm: x.distance_km,
  photos: cleanPhotoList(x.image_urls),
});

const SELECT = (buyerId: string) => sql`
  SELECT fa.id, fa.donation_id, fa.status, fa.start_price::float8 AS start_price, fa.reserve_price::float8 AS reserve_price,
         fa.decrement_step::float8 AS decrement_step, fa.interval_minutes, fa.starts_at, fa.ends_at,
         d.title, d.food_classification, d.estimated_servings, d.quantity_kg::float8 AS quantity_kg, d.items, d.pickup_address, d.image_urls,
         COALESCE(dp.organization_name, dp.display_name) AS donor_name,
         (ST_Distance(d.pickup_location, bp.location) / 1000.0)::float8 AS distance_km
  FROM food_auctions fa
  JOIN donations d ON d.id = fa.donation_id
  LEFT JOIN profiles dp ON dp.user_id = d.donor_id
  LEFT JOIN profiles bp ON bp.user_id = ${buyerId}
`;

/** Auctions a buyer can bid on right now (running, food still listed and unexpired). */
export async function listLiveAuctions(
  viewerId: string,
): Promise<{ serverNowMs: number; auctions: AuctionCard[] }> {
  const r = await rows<Record<string, any>>(sql`
    ${SELECT(viewerId)}
    WHERE fa.status = 'ACTIVE' AND fa.ends_at > now() AND d.status = 'LISTED'
    ORDER BY fa.ends_at
    LIMIT 100
  `);
  return { serverNowMs: Date.now(), auctions: r.map(toCard) };
}

export interface AuctionDetail {
  serverNowMs: number;
  card: AuctionCard;
  /** The viewer's own order on this auction, if any. */
  myOrder: null | { id: string; status: string; amountMinor: number };
  soldToSomeoneElse: boolean;
}

export async function getAuctionDetail(
  auctionId: string,
  viewerId: string,
): Promise<AuctionDetail | null> {
  const [x] = await rows<Record<string, any>>(
    sql`${SELECT(viewerId)} WHERE fa.id = ${auctionId}`,
  );
  if (!x) return null;
  const [mine] = await rows<Record<string, any>>(sql`
    SELECT id, status, amount_minor FROM auction_orders
    WHERE auction_id = ${auctionId} AND buyer_id = ${viewerId}
    ORDER BY created_at DESC LIMIT 1
  `);
  const [other] = await rows<Record<string, any>>(sql`
    SELECT 1 AS n FROM auction_orders
    WHERE auction_id = ${auctionId} AND buyer_id <> ${viewerId} AND status IN ('AUTHORIZED','CAPTURE_REQUESTED','CAPTURED')
  `);
  return {
    serverNowMs: Date.now(),
    card: toCard(x),
    myOrder: mine
      ? { id: mine.id, status: mine.status, amountMinor: mine.amount_minor }
      : null,
    soldToSomeoneElse: !!other,
  };
}

export interface BuyerOrder {
  orderId: string;
  auctionId: string;
  title: string;
  status: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
  deliveryId: string | null;
  deliveryStatus: string | null;
  photos: string[];
}

/** The buyer's purchases (not abandoned checkouts), newest first. */
export async function getBuyerOrders(buyerId: string): Promise<BuyerOrder[]> {
  const r = await rows<Record<string, any>>(sql`
    SELECT o.id, o.auction_id, o.status, o.amount_minor, o.currency, o.created_at, d.title,
           dl.id AS delivery_id, dl.status AS delivery_status, d.image_urls
    FROM auction_orders o
    JOIN food_auctions fa ON fa.id = o.auction_id
    JOIN donations d ON d.id = fa.donation_id
    LEFT JOIN LATERAL (
      SELECT x.id, x.status FROM deliveries x WHERE x.donation_id = d.id
      ORDER BY (x.status <> 'FAILED') DESC, x.created_at DESC LIMIT 1
    ) dl ON true
    WHERE o.buyer_id = ${buyerId} AND o.status IN ('AUTHORIZED','CAPTURE_REQUESTED','CAPTURED','VOID_REQUESTED','CANCELLED')
    ORDER BY o.created_at DESC
    LIMIT 50
  `);
  return r.map((x) => ({
    orderId: x.id,
    auctionId: x.auction_id,
    title: x.title,
    status: x.status,
    amountMinor: x.amount_minor,
    currency: x.currency,
    createdAt: iso(x.created_at)!,
    deliveryId: x.delivery_id,
    deliveryStatus: x.delivery_status,
    photos: cleanPhotoList(x.image_urls),
  }));
}
