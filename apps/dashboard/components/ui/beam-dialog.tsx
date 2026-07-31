"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { BorderBeamPanel } from "./border-beam-panel";
import { GradientButton } from "./gradient-button";
import { AlertTriangleIcon, BanIcon, InfoIcon, XIcon } from "./icons";

export type DialogTone = "info" | "warn" | "block";

/* The dashboard half of the same object the extension paints into ChatGPT: a
   beam-ringed decision panel. Tone drives the second comet, the header glyph
   and the accent — an admin about to suspend a tool sees the identical coral
   ring the employee saw when they were blocked.

   Behaviour that has to be here rather than in each call site:
   - focus is moved into the dialog on open and restored to the trigger on close
   - Tab is trapped inside the panel while it is open
   - Escape and scrim-click both dismiss (unless `dismissible={false}`)
   - the scrim is 72% so the console behind it stops competing for attention */

const TONE: Record<
  DialogTone,
  { beams: 1 | 2; colors: [string, string?]; Icon: typeof InfoIcon; ring: string; chip: string }
> = {
  info: {
    beams: 2,
    colors: ["var(--sg-accent)", "var(--sg-cyan)"],
    Icon: InfoIcon,
    ring: "var(--sg-accent)",
    chip: "bg-[var(--sg-accent-soft)] text-[var(--sg-accent-text)]",
  },
  warn: {
    beams: 2,
    colors: ["var(--sg-warn)", "var(--sg-accent)"],
    Icon: AlertTriangleIcon,
    ring: "var(--sg-warn)",
    chip: "bg-[var(--sg-warn-soft)] text-[var(--sg-warn-text)]",
  },
  block: {
    beams: 2,
    colors: ["var(--sg-block)", "var(--sg-warn)"],
    Icon: BanIcon,
    ring: "var(--sg-block)",
    chip: "bg-[var(--sg-block-soft)] text-[var(--sg-block-text)]",
  },
};

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface BeamDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  tone?: DialogTone;
  /** One line under the title. Say what will happen, not that something happened. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;
  className?: string;
}

export function BeamDialog({
  open,
  onClose,
  title,
  tone = "info",
  description,
  children,
  footer,
  dismissible = true,
  className,
}: BeamDialogProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the panel itself rather than the first control: a destructive
    // confirm dialog should not open with "Suspend" already under the Enter key.
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!open || !mounted) return null;
  const meta = TONE[tone];
  const titleId = `sg-dlg-${title.replace(/\W+/g, "-").toLowerCase()}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
      style={{ background: "var(--sg-scrim)", backdropFilter: "blur(3px)" }}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <BorderBeamPanel
        beams={meta.beams}
        colors={meta.colors}
        radius={18}
        thickness={2}
        idleSpeed={34}
        hoverSpeed={150}
        className={cn(
          "sg-rise max-h-[88vh] w-full max-w-lg overflow-y-auto p-0",
          "bg-[var(--sg-surface)] shadow-[var(--sg-shadow-lg)]",
          className,
        )}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="outline-none"
        >
          <div className="flex items-start gap-3 px-5 pt-5">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-9 shrink-0 place-items-center rounded-[10px]",
                meta.chip,
              )}
            >
              <meta.Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold tracking-tight text-[var(--sg-fg)]">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm text-[var(--sg-fg-secondary)]">{description}</p>
              ) : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 -mt-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--sg-muted)] transition-colors hover:bg-[var(--sg-surface-2)] hover:text-[var(--sg-fg)]"
              >
                <XIcon size={16} title="Close" />
              </button>
            ) : null}
          </div>

          {children ? <div className="px-5 py-4 text-sm">{children}</div> : <div className="h-2" />}

          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--sg-border)] bg-[var(--sg-surface-2)]/60 px-5 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      </BorderBeamPanel>
    </div>,
    document.body,
  );
}

/** The common case: "are you sure", one destructive verb, one way out. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "warn",
  pending,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  pending?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <BeamDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone={tone}
      footer={
        <>
          <GradientButton variant="neutral" size="sm" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </GradientButton>
          <GradientButton
            variant={tone === "block" ? "variant" : "default"}
            size="sm"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </GradientButton>
        </>
      }
    >
      {children}
    </BeamDialog>
  );
}
