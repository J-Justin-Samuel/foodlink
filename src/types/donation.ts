export const FOOD_CLASSIFICATIONS = ["COOKED", "PACKAGED", "RAW"] as const;
export type FoodClassification = (typeof FOOD_CLASSIFICATIONS)[number];

export const CLASSIFICATION_LABELS: Record<FoodClassification, string> = {
  COOKED: "Cooked meals",
  PACKAGED: "Packaged food",
  RAW: "Raw ingredients",
};

export interface DonationItem {
  name: string;
  quantity: string;
  notes?: string;
}

/** One row returned by the geospatial matching query. */
export interface NearbyDonation {
  id: string;
  title: string;
  donorName: string | null;
  classification: FoodClassification;
  estimatedServings: number;
  quantityKg: number;
  items: DonationItem[];
  pickupAddress: string | null;
  pickupInstructions: string | null;
  lat: number;
  lng: number;
  /** Straight-line (geodesic) distance from the search point, in km. */
  distanceKm: number;
  hoursUntilExpiry: number;
  expiresAt: string; // ISO timestamp
  urgencyScore: number;
}
