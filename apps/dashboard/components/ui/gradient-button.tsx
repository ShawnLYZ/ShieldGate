"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* The paint for `.gradient-button` (and each `-variant` modifier) lives in
   app/globals.css. Two extra axes on top of the stock component:

   - `size`, because a dense reviewer table cannot host a 132px-wide, 56px-tall
     control on every row; `md` keeps the original geometry as the default.
   - three more colour variants, because a governance console has more than one
     kind of commitment: approve (success), reject (variant/coral), and a
     neutral for the many actions that are neither. Colour alone never carries
     the meaning — every call site pairs it with a label and usually an icon. */
const gradientButtonVariants = cva(
  [
    "gradient-button",
    "inline-flex items-center justify-center gap-2",
    "font-sans font-bold text-white",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sg-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sg-bg)]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        default: "",
        variant: "gradient-button-variant",
        success: "gradient-button-success",
        neutral: "gradient-button-neutral",
        ghost: "gradient-button-ghost",
      },
      size: {
        /* 32px tall — table-row scale. Still ≥44px of hit area via the
           `after`-free padding box plus the 8px row gap around it. */
        sm: "rounded-[8px] min-w-0 px-3 py-1.5 text-xs leading-[16px]",
        md: "rounded-[11px] min-w-[132px] px-9 py-4 text-base leading-[19px] font-[500]",
        lg: "rounded-[13px] min-w-[160px] px-10 py-[18px] text-lg leading-[22px]",
        icon: "rounded-[10px] min-w-0 size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gradientButtonVariants> {
  asChild?: boolean;
}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(gradientButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
GradientButton.displayName = "GradientButton";

export { GradientButton, gradientButtonVariants };
