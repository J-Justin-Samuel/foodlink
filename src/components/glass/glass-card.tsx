import { cn } from "@/lib/utils";

/** A frosted panel. Use `lift` for cards that are links, `strong` for forms and text-heavy panels. */
export function GlassCard({
  className,
  strong = false,
  lift = false,
  as: Tag = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  strong?: boolean;
  lift?: boolean;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(
        "rounded-3xl",
        strong ? "glass-strong" : "glass",
        lift && "lift group",
        className,
      )}
      {...props}
    />
  );
}
