import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-forest text-white hover:bg-forest/90 hover:-translate-y-0.5 shadow-sm hover:shadow-lg hover:shadow-forest/25",
        cta: "bg-gradient-to-br from-orange-500 to-orange-vibrant text-white shadow-lg shadow-orange-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/40 hover:from-orange-vibrant hover:to-[#EA580C]",
        outline:
          "border border-white/70 bg-white/60 text-charcoal backdrop-blur-xl hover:bg-white/90 hover:-translate-y-0.5 hover:border-orange-300",
        glass:
          "border border-white/60 bg-white/40 text-charcoal backdrop-blur-xl hover:bg-white/70 hover:-translate-y-0.5",
        secondary:
          "bg-orange-soft text-[#9A3412] hover:bg-[#FDBA74]/50 border border-orange-200",
        ghost: "text-charcoal hover:bg-white/60 hover:backdrop-blur-xl",
        link: "text-orange-vibrant underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-7 text-base font-bold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild: _asChild, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
