"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_FOOD_PHOTOS } from "@/lib/food-photo-rules";

export interface PickedPhoto {
  id: string;
  url: string;
}

/** Phone photos are 3-8 MB. Shrink to at most 1280px JPEG so the upload is quick and well under the limit. */
async function shrink(
  file: File,
  maxDim = 1280,
  quality = 0.82,
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

/**
 * Takes (or chooses) up to three photos of the food and uploads each one straight away.
 * The parent only stores the returned ids. On a phone the button opens the camera.
 */
export function FoodPhotoPicker({
  value,
  onChange,
  error,
}: {
  value: PickedPhoto[];
  onChange: (next: PickedPhoto[]) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const full = value.length >= MAX_FOOD_PHOTOS;

  async function add(file: File) {
    setBusy(true);
    setProblem(null);
    try {
      let blob: Blob;
      try {
        blob = await shrink(file);
      } catch {
        throw new Error("That image couldn't be read. Take the photo again.");
      }
      const res = await fetch("/api/food-photos", {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.id || !body.url)
        throw new Error(
          body.error ?? "Could not upload the photo. Please try again.",
        );
      onChange([...value, { id: body.id, url: body.url }]);
    } catch (err) {
      setProblem(
        err instanceof Error ? err.message : "Could not upload the photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: PickedPhoto) {
    onChange(value.filter((x) => x.id !== p.id));
    await fetch(`/api/food-photos/${p.id}`, { method: "DELETE" }).catch(
      () => {},
    );
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {value.map((p, i) => (
            <li key={p.id} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`Food photo ${i + 1}`}
                className="h-28 w-36 rounded-md border-2 border-foreground object-cover"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => remove(p)}
                aria-label={`Remove food photo ${i + 1}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void add(f);
        }}
      />
      <Button
        type="button"
        variant={value.length === 0 ? "default" : "outline"}
        disabled={busy || full}
        onClick={() => input.current?.click()}
      >
        {busy
          ? "Uploading…"
          : value.length === 0
            ? "Take a photo of the food"
            : full
              ? "Photo limit reached"
              : "Add another photo"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Required. Volunteers, NGOs and buyers see this photo before they decide.
        Show the food clearly, up to {MAX_FOOD_PHOTOS} photos.
      </p>
      {(problem || error) && (
        <p role="alert" className="text-sm text-destructive">
          {problem ?? error}
        </p>
      )}
    </div>
  );
}
