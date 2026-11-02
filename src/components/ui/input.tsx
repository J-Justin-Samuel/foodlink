import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-2xl border border-white/70 bg-white/60 px-4 py-1 text-base shadow-xs backdrop-blur-xl transition-all duration-200 outline-none placeholder:text-muted-foreground/70 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-orange-vibrant focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-orange-vibrant/20",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
