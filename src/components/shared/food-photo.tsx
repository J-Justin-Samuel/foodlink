import { Camera } from "lucide-react";
import { isFoodPhotoUrl } from "@/lib/food-photo-rules";

/** The donor's photo of the food, or a soft "no photo" tile for batches listed before photos existed. */
export function FoodPhoto({
  src,
  alt,
  className = "",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!isFoodPhotoUrl(src)) {
    return (
      <div
        role="img"
        aria-label="No photo of this food"
        className={`flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-orange-100 via-peach to-fresh/20 text-xs font-medium text-[#9a3412] ${className}`}
      >
        <Camera className="h-5 w-5" aria-hidden />
        No photo
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`rounded-2xl bg-peach object-cover shadow-sm ${className}`}
    />
  );
}

/** Big photo with small ones underneath. Tapping a photo opens it full size in a new tab. */
export function FoodPhotoGallery({
  photos,
  title,
}: {
  photos: string[];
  title: string;
}) {
  const list = photos.filter(isFoodPhotoUrl);
  if (list.length === 0) return <FoodPhoto alt="" className="h-48 w-full" />;
  return (
    <div className="space-y-2">
      <a
        href={list[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-3xl"
        aria-label={`Open the photo of ${title} full size`}
      >
        <FoodPhoto
          src={list[0]}
          alt={`Photo of ${title} taken by the donor`}
          className="h-64 w-full rounded-3xl transition-transform duration-500 group-hover:scale-[1.03] sm:h-72"
        />
      </a>
      {list.length > 1 && (
        <ul className="flex gap-2">
          {list.slice(1).map((p, i) => (
            <li key={p}>
              <a
                href={p}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open photo ${i + 2} of ${title} full size`}
              >
                <FoodPhoto
                  src={p}
                  alt={`Another photo of ${title}`}
                  className="h-20 w-24 transition-transform hover:-translate-y-0.5"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink/60">
        Photo taken by the donor when the food was listed.
      </p>
    </div>
  );
}
