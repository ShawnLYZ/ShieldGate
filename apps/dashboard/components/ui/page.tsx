import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon, InfoIcon, SpinnerIcon } from "./icons";

/* Page furniture. Every panel route renders <PageShell><PageHeader/>…, which is
   what keeps fourteen independently-written pages reading as one product:
   identical gutters, identical heading scale, identical vertical rhythm. */

export function PageShell({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn(
        // Gutters widen with the viewport rather than staying at one narrow
        // value; the tables inside need every pixel on a laptop.
        "relative z-10 mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sg-accent-text)]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--sg-fg)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-[var(--sg-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sg-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-12 text-center", className)}>
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-[var(--sg-surface-2)] text-[var(--sg-muted)]">
        {icon ?? <InfoIcon size={18} />}
      </span>
      <p className="text-sm font-medium text-[var(--sg-fg)]">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-[var(--sg-muted)]">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

/** Inline, non-blocking failure note. Errors sit with what failed. */
export function ErrorNote({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-[var(--sg-radius-sm)] border px-3 py-2 text-xs",
        "border-[color-mix(in_srgb,var(--sg-block)_38%,transparent)] bg-[var(--sg-block-soft)] text-[var(--sg-block-text)]",
        className,
      )}
    >
      <AlertTriangleIcon size={14} className="mt-px" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function Loading({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-2 px-4 py-8 text-sm text-[var(--sg-muted)]", className)}
    >
      <SpinnerIcon size={15} />
      <span>{label}</span>
    </div>
  );
}

/** Reserves the space the real content will take, so nothing shifts on arrival. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("sg-skeleton rounded-[var(--sg-radius-sm)]", className)}
      {...props}
    />
  );
}
