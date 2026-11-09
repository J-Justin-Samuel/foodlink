import { isFoodPhotoUrl } from "@/lib/food-photo-rules";

/** The donor's photo of the food, or a plain "no photo" tile for batches listed before photos existed. */
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
        className={`flex items-center justify-center rounded-md border-2 border-dashed bg-muted text-xs text-muted-foreground ${className}`}
      >
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
      className={`rounded-md border-2 border-foreground bg-muted object-cover ${className}`}
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
        className="block"
        aria-label={`Open the photo of ${title} full size`}
      >
        <FoodPhoto
          src={list[0]}
          alt={`Photo of ${title} taken by the donor`}
          className="h-64 w-full sm:h-72"
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
                  className="h-20 w-24"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Photo taken by the donor when the food was listed.
      </p>
    </div>
  );
}
