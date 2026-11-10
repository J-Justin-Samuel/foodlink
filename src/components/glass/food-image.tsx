"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { IMG, type ImageKey } from "@/lib/images";

/**
 * A photo that never leaves a hole: if the image fails to load, a soft
 * orange-to-green tile with a food emoji takes its place.
 */
export function FoodImage({
  name,
  className,
  priority = false,
  rounded = "rounded-3xl",
}: {
  name: ImageKey;
  className?: string;
  priority?: boolean;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const img = IMG[name];
  const ref = useRef<HTMLImageElement>(null);
  // The image may already have failed before React attached onError.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  return (
    <div
      className={cn("relative overflow-hidden bg-peach", rounded, className)}
    >
      {failed ? (
        <div
          role="img"
          aria-label={img.alt}
          className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-200 via-peach to-fresh/40 text-6xl"
        >
          <span aria-hidden>{img.emoji}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={img.src}
          alt={img.alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      )}
    </div>
  );
}
