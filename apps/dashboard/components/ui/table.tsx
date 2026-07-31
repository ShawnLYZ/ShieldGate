import * as React from "react";
import { cn } from "@/lib/utils";

/* Dense-table conventions, in one place so eleven panels can't drift apart:

   - The scroll container is mandatory. A governance table has 7-9 columns and
     will overflow a 375px viewport; the page body must never scroll sideways,
     so the table does it instead.
   - The header is sticky. Scrolling 50 audit rows and losing the column names
     is the single most common complaint about tables like these.
   - Numeric cells opt into `tabular-nums` via <Td numeric>; large standalone
     figures (stat tiles) deliberately do not. */

export function TableScroll({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative w-full overflow-x-auto overscroll-x-contain",
        "[scrollbar-gutter:stable]",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-left text-[13px]", className)}
      {...props}
    />
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-[var(--sg-surface-2)]/95 backdrop-blur-sm",
        "[&_th]:border-b [&_th]:border-[var(--sg-border)]",
        "[&_th]:px-3 [&_th]:py-2 [&_th]:text-[11px] [&_th]:font-semibold",
        "[&_th]:uppercase [&_th]:tracking-wider [&_th]:text-[var(--sg-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn(
        "[&_tr]:border-b [&_tr]:border-[var(--sg-border)] [&_tr:last-child]:border-0",
        "[&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        className,
      )}
      {...props}
    />
  );
}

export interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Adds hover affordance + pointer. Use only when the row really is clickable. */
  interactive?: boolean;
}

export function Tr({ className, interactive, ...props }: TrProps) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150",
        interactive &&
          "cursor-pointer hover:bg-[var(--sg-surface-2)] focus-within:bg-[var(--sg-surface-2)]",
        className,
      )}
      {...props}
    />
  );
}

export interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  muted?: boolean;
}

export function Td({ className, numeric, muted, ...props }: TdProps) {
  return (
    <td
      className={cn(
        numeric && "tabular-nums",
        muted && "text-[var(--sg-muted)]",
        className,
      )}
      {...props}
    />
  );
}

/** Full-width "nothing here yet" row that keeps the table's column structure. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-[var(--sg-muted)]">
        {children}
      </td>
    </tr>
  );
}
