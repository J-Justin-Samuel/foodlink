import { z } from "zod";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
export const PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_MINUTES = 15;

export const scanInputSchema = z.object({
  donationId: z.string().uuid(),
  // MQ-135 reads roughly 0-10000 ppm after calibration.
  tvocPpm: z.number().finite().min(0).max(10_000),
  // Food-surface temperatures; MLX90614 itself reaches far beyond this.
  surfaceTempC: z.number().finite().min(-40).max(150),
  humidityPct: z.number().finite().min(0).max(100),
  source: z.enum(["BLUETOOTH", "SIMULATOR"]),
  deviceName: z.string().max(60).optional(),
});
export type ScanInput = z.infer<typeof scanInputSchema>;

export const otpEntrySchema = z.object({
  deliveryId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type OtpEntryInput = z.infer<typeof otpEntrySchema>;

export const presignSchema = z.object({
  deliveryId: z.string().uuid(),
  contentType: z.enum(PHOTO_CONTENT_TYPES),
  contentLength: z.number().int().min(1).max(MAX_PHOTO_BYTES),
});

export const photoRecordSchema = z.object({
  deliveryId: z.string().uuid(),
  key: z.string().min(1).max(300),
});

export const ngoPickSchema = z.object({
  deliveryId: z.string().uuid(),
  ngoId: z.string().uuid(),
});

export const deliveryIdSchema = z.object({ deliveryId: z.string().uuid() });
