import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon } from "./icons";

/* Forms rule being enforced here: labels are visible elements, never
   placeholders, and errors render next to the field that caused them rather
   than in a summary at the top of the page. */

const control = [
  "w-full rounded-[var(--sg-radius-sm)] border border-[var(--sg-border-strong)]",
  "bg-[var(--sg-surface-2)] px-3 py-2 text-sm text-[var(--sg-fg)]",
  "transition-[border-color,box-shadow] duration-150",
  "hover:border-[var(--sg-muted)]",
  "focus:border-[var(--sg-accent)] focus:outline-none",
  "focus:ring-2 focus:ring-[color-mix(in_srgb,var(--sg-accent)_35%,transparent)]",
  "disabled:cursor-not-allowed disabled:opacity-55",
].join(" ");

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-xs font-medium text-[var(--sg-fg-secondary)]", className)}
      {...props}
    />
  );
}

export function Hint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-xs text-[var(--sg-muted)]", className)} {...props} />;
}

export function FieldError({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn(
        "mt-1 flex items-start gap-1.5 text-xs text-[var(--sg-block-text)]",
        className,
      )}
    >
      <AlertTriangleIcon size={13} className="mt-px" />
      <span>{children}</span>
    </p>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(control, className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(control, "resize-y leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      control,
      // Native arrow removed and redrawn so the control matches in both themes;
      // the SVG is a data URI to stay inside the CSP the app ships with.
      "cursor-pointer appearance-none bg-no-repeat pr-8",
      "bg-[url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"%2393a3b8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m4 6 4 4 4-4\"/></svg>')]",
      "bg-[position:right_0.6rem_center]",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

/** Label + control + hint/error, wired together with matching ids. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}
