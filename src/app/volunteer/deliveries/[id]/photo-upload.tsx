"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { recordHandoffPhoto } from "@/lib/actions/deliveries";

/** Phone photos are 3-8 MB; shrink to ~1600px JPEG so uploads are fast and under the limit. */
async function shrink(
  file: File,
  maxDim = 1600,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", quality),
  );
  if (!blob) throw new Error("no blob");
  return blob;
}

interface Props {
  deliveryId: string;
  /** Short-lived signed link to the photo already saved, if any. */
  existingPhotoUrl: string | null;
  hasPhoto: boolean;
}

type PresignResponse =
  | { mode: "bypass"; key: string }
  | { mode: "s3"; url: string; key: string; headers: Record<string, string> }
  | { error: string };

export function PhotoUpload({ deliveryId, existingPhotoUrl, hasPhoto }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      let blob: Blob;
      try {
        blob = await shrink(file);
      } catch {
        throw new Error("That image couldn't be read. Take the photo again.");
      }

      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryId,
          contentType: blob.type,
          contentLength: blob.size,
        }),
      });
      const presign = (await presignRes
        .json()
        .catch(() => ({
          error: "Unexpected server response.",
        }))) as PresignResponse;
      if (!presignRes.ok || "error" in presign) {
        throw new Error(
          "error" in presign ? presign.error : "Could not prepare the upload.",
        );
      }

      if (presign.mode === "s3") {
        let put: Response;
        try {
          put = await fetch(presign.url, {
            method: "PUT",
            headers: presign.headers,
            body: blob,
          });
        } catch {
          throw new Error(
            "The upload was blocked. If you run this app yourself, add this site's address to the bucket's CORS rules (see the README).",
          );
        }
        if (!put.ok)
          throw new Error(`Upload failed (${put.status}). Please try again.`);
      }

      const saved = await recordHandoffPhoto({ deliveryId, key: presign.key });
      if (!saved.ok) throw new Error(saved.error);

      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {hasPhoto && !file && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Photo saved. The NGO can see it.
          </p>
          {existingPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={existingPhotoUrl}
              alt="Handoff photo you uploaded"
              className="max-h-48 rounded-md border"
            />
          )}
        </div>
      )}

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Photo about to be uploaded"
          className="max-h-64 rounded-md border"
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Take a handoff photo"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setError(null);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        {file ? (
          <>
            <Button type="button" onClick={upload} disabled={busy}>
              {busy ? "Uploading…" : "Upload this photo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              Retake
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant={hasPhoto ? "outline" : "default"}
            onClick={() => inputRef.current?.click()}
          >
            {hasPhoto ? "Replace photo" : "Take handoff photo"}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
