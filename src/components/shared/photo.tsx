import Image from "next/image";
import { cn } from "@/lib/utils";

export const unsplash = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const PHOTOS = {
  bowl: "photo-1546069901-ba9599a7e63c",
  pancakes: "photo-1567620905732-2d1ec7ab7445",
  plate: "photo-1504674900247-0877df9cc836",
  spread: "photo-1540189549336-e6e99c3679fe",
  veg: "photo-1512621776951-a57141f2eefd",
  market: "photo-1488459716781-31db52582fe9",
  pizza: "photo-1565299624946-b28f40a0ae38",
  produce: "photo-1498837167922-ddd27525d352",
};

/** Zoom-on-hover photo. Parent must be `relative` with a height, or pass className for the wrapper. */
export function Photo({
  id,
  alt,
  className,
  sizes = "(min-width: 768px) 33vw, 100vw",
  priority,
}: {
  id: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={unsplash(id, 1000)}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
      />
    </div>
  );
}
