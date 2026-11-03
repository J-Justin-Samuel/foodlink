import { z } from "zod";

const rupees = z.number().finite().positive().max(10_000_000);

export const createAuctionSchema = z.object({
  donationId: z.string().uuid(),
  /** Rupees, up to 2 decimals. */
  startPrice: rupees,
  reservePrice: z.number().finite().min(0).max(10_000_000),
  decrementStep: rupees,
});
export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;

export const auctionIdSchema = z.object({ auctionId: z.string().uuid() });

export const startPurchaseSchema = z.object({
  auctionId: z.string().uuid(),
  /** The price the buyer saw, in paise. The server charges the real current price and refuses if it is higher. */
  expectedPriceMinor: z.number().int().positive(),
});

export const orderIdSchema = z.object({ orderId: z.string().uuid() });
