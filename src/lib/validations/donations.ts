import { z } from "zod";
import { FOOD_CLASSIFICATIONS } from "@/types/donation";

export const donationItemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(120),
  quantity: z
    .string()
    .trim()
    .min(1, "Add a quantity, e.g. “10 plates”")
    .max(60),
  notes: z.string().trim().max(200).optional(),
});

/**
 * Shared by the donor form (client) and `createDonation` (server).
 * `preparedAt` is any string `Date.parse` understands; the form sends ISO.
 * Avoid transforms/defaults here so form input and output types stay equal.
 */
export const donationFormSchema = z
  .object({
    title: z.string().trim().min(3, "Give the batch a short title").max(255),
    items: z
      .array(donationItemSchema)
      .min(1, "Add at least one item")
      .max(30, "Maximum 30 items per batch"),
    estimatedServings: z.number().int().min(1).max(10000),
    quantityKg: z.number().min(0.1, "Minimum 0.1 kg").max(5000),
    classification: z.enum(FOOD_CLASSIFICATIONS),
    preparedAt: z
      .string()
      .refine(
        (v) => !Number.isNaN(Date.parse(v)),
        "Enter a valid date and time",
      ),
    expiryHours: z
      .number()
      .min(0.5, "Minimum 30 minutes")
      .max(72, "Maximum 72 hours"),
    pickupAddress: z
      .string()
      .trim()
      .min(5, "Search for the address and pick a suggestion")
      .max(500),
    pickupLat: z.number().min(-90).max(90),
    pickupLng: z.number().min(-180).max(180),
    pickupInstructions: z.string().trim().max(500).optional(),
  })
  .refine((v) => !(v.pickupLat === 0 && v.pickupLng === 0), {
    path: ["pickupAddress"],
    message: "Search for the address and pick a suggestion",
  });

export type DonationFormValues = z.infer<typeof donationFormSchema>;

export const nearbySearchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(50),
  classification: z.enum(FOOD_CLASSIFICATIONS).optional(),
  /** Only show food expiring within this many hours. */
  maxHoursUntilExpiry: z.number().min(1).max(72).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type NearbySearchInput = z.infer<typeof nearbySearchSchema>;

export const claimSchema = z.object({ donationId: z.string().uuid() });
