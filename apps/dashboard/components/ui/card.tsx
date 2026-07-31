import * as React from "react";
import { cn } from "@/lib/utils";

/* The everyday surface. BorderBeamPanel is deliberately NOT the default card:
   a page with fourteen orbiting rings is noise, and the beam stops meaning
   "look here". Card is what almost everything uses; the beam is reserved for
   the one panel on a screen that is genuinely a decision point. */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-[var(--sg-radius)] border border-[var(--sg-border)]",
        "bg-[var(--sg-surface)] shadow-[var(--sg-shadow-sm)]",
        // A one-pixel top highlight; reads as a lit edge under the ambient
        // blobs without costing an extra element.
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-[color-mix(in_srgb,var(--sg-fg)_14%,transparent)] before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sg-border)] px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-sm font-semibold tracking-tight text-[var(--sg-fg)]", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-[var(--sg-muted)]", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t border-[var(--sg-border)] px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}
