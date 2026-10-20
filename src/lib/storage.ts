import "server-only";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_PHOTO_BYTES } from "@/lib/validations/stage3";

/**
 * Object storage for proof-of-delivery photos. Works with AWS S3 and
 * Cloudflare R2 (set S3_ENDPOINT for R2). Photos are private: the browser
 * only ever receives short-lived signed URLs, never a public link.
 */

const UPLOAD_URL_TTL_S = 300;
const VIEW_URL_TTL_S = 300;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface StorageConfig {
  bucket: string;
  client: S3Client;
}

let cached: StorageConfig | null | undefined;

function getConfig(): StorageConfig | null {
  if (cached !== undefined) return cached;

  const {
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_REGION,
    S3_ENDPOINT,
    S3_FORCE_PATH_STYLE,
  } = process.env;

  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    cached = null;
    return cached;
  }

  cached = {
    bucket: S3_BUCKET,
    client: new S3Client({
      region: S3_REGION || "auto", // R2 uses "auto"
      endpoint: S3_ENDPOINT || undefined,
      forcePathStyle: S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
      // Newer AWS SDKs add CRC32 checksum headers to presigned PUTs, which
      // Cloudflare R2 (and browsers sending a plain PUT) reject. Only
      // compute checksums when an operation strictly requires them.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
  return cached;
}

export const isStorageConfigured = () => getConfig() !== null;

/**
 * Local-development escape hatch so the delivery flow can be tried without a
 * bucket. Hard-disabled outside `next dev`, whatever the env var says.
 */
export const isStorageDevBypass = () =>
  process.env.NODE_ENV === "development" &&
  process.env.STORAGE_DEV_BYPASS === "true";

export const handoffKeyPrefix = (deliveryId: string) =>
  `handoff/${deliveryId}/`;
export const devBypassKey = (deliveryId: string) => `dev-bypass/${deliveryId}`;

export function buildHandoffKey(
  deliveryId: string,
  contentType: string,
): string {
  return `${handoffKeyPrefix(deliveryId)}${randomUUID()}.${EXT[contentType] ?? "jpg"}`;
}

function need(): StorageConfig {
  const c = getConfig();
  if (!c)
    throw new Error(
      "Object storage is not configured (S3_* environment variables)",
    );
  return c;
}

/**
 * Presigned PUT. Content-Type and Content-Length are part of the signature, so
 * the browser must upload exactly the type and size that was approved.
 */
export async function presignUpload(args: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const { bucket, client } = need();
  if (args.contentLength > MAX_PHOTO_BYTES) throw new Error("File too large");
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: args.key,
      ContentType: args.contentType,
      ContentLength: args.contentLength,
    }),
    // `signableHeaders` makes the signature cover Content-Type as well.
    { expiresIn: UPLOAD_URL_TTL_S, signableHeaders: new Set(["content-type"]) },
  );
}

/** Presigned GET for displaying a stored photo, or null when there is none. */
export async function presignView(key: string | null): Promise<string | null> {
  if (!key || key.startsWith("dev-bypass/")) return null;
  const c = getConfig();
  if (!c) return null;
  return getSignedUrl(
    c.client,
    new GetObjectCommand({ Bucket: c.bucket, Key: key }),
    {
      expiresIn: VIEW_URL_TTL_S,
    },
  );
}

export async function headObject(
  key: string,
): Promise<{ contentLength: number; contentType: string } | null> {
  const { bucket, client } = need();
  try {
    const res = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      contentLength: res.ContentLength ?? 0,
      contentType: res.ContentType ?? "",
    };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404)
      return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { bucket, client } = need();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
