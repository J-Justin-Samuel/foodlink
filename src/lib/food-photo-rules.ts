/** Pure rules for donation photos (shared by the browser uploader, the API and the tests). */
export const MAX_FOOD_PHOTOS = 3;
export const MAX_FOOD_PHOTO_BYTES = 1_000_000; // the browser shrinks photos to about 150-400 KB first
export const MAX_UNATTACHED_PHOTOS = 12; // uploaded but not yet used in a donation
export const ORPHAN_MAX_AGE_HOURS = 24;

export type FoodPhotoType = "image/jpeg" | "image/png" | "image/webp";

/** Reads the real type from the file's first bytes, never from what the client claims. */
export function sniffImage(b: Uint8Array): FoodPhotoType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID.test(v);

export const photoUrl = (id: string) => `/api/food-photos/${id}`;
/** Only our own photo paths are ever rendered in an <img>. */
export const isFoodPhotoUrl = (v: unknown): v is string =>
  typeof v === "string" && /^\/api\/food-photos\/[0-9a-f-]{36}$/i.test(v);
export const cleanPhotoList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(isFoodPhotoUrl).slice(0, MAX_FOOD_PHOTOS) : [];
