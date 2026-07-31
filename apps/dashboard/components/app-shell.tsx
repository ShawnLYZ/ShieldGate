"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLinks, useRole } from "@/components/nav-links";
import { Badge } from "@/components/ui/badge";
import { ShieldCheckIcon, UserIcon, XIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

/* Two chromes, one shell.

   `/login` and `/lookup` are reached by people who are not operating the
   console — a demo account picker and a member of the public holding a
   reference number off a letter. Giving them a 14-link governance sidebar is
   worse than giving them nothing, so those routes get a centred, single-column
   layout with just the mark. Everything else gets the operator rail.

   Route matching is a prefix list rather than a route group so /lookup/appeal/…
   inherits it too. */
const PUBLIC_ROUTES = ["/login", "/lookup"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-[10px] text-white shadow-[0_2px_10px_-2px_color-mix(in_srgb,var(--sg-accent)_70%,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--sg-accent) 0%, color-mix(in srgb, var(--sg-cyan) 75%, var(--sg-accent)) 100%)",
        }}
      >
        <ShieldCheckIcon size={17} />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight text-[var(--sg-fg)]">
            ShieldGate
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--sg-faint)]">
            AI governance
          </span>
        </span>
      )}
    </span>
  );
}

function HamburgerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      role="img"
      focusable="false"
    >
      <title>Open navigation</title>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function RoleChip({ role }: { role: string | null }) {
  if (!role) return null;
  return (
    <Badge tone="accent" className="gap-1.5 px-2.5 py-1">
      <UserIcon size={11} />
      <span className="capitalize">{role}</span>
    </Badge>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const role = useRole();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Any navigation closes the drawer — otherwise it stays over the page the
  // user just asked for, which reads as a broken back button.
  React.useEffect(() => setDrawerOpen(false), [pathname]);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (isPublicRoute(pathname)) {
    return (
      <div className="relative z-10 min-h-screen">
        <header className="border-b border-[var(--sg-border)] bg-[var(--sg-surface)]/70 backdrop-blur-md print:hidden">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/lookup" className="rounded-lg">
              <BrandMark />
            </Link>
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Desktop rail. Always in the DOM at lg+; its own scroll container so a
          long nav never scrolls the page content with it. */}
      <aside className="sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-[var(--sg-border)] bg-[var(--sg-surface)]/60 backdrop-blur-md lg:flex print:hidden">
        <div className="flex h-14 items-center px-4">
          <Link href="/overview" className="rounded-lg">
            <BrandMark />
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          <NavLinks role={role} testId="nav" />
        </div>
        <div className="border-t border-[var(--sg-border)] px-4 py-3">
          <Link
            href="/login"
            className="flex items-center gap-2 text-xs font-medium text-[var(--sg-muted)] transition-colors hover:text-[var(--sg-fg)]"
          >
            <UserIcon size={13} />
            Switch demo account
          </Link>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden print:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "var(--sg-scrim)" }}
            onClick={() => setDrawerOpen(false)}
          />
          <div className="sg-rise absolute inset-y-0 left-0 flex w-[264px] flex-col border-r border-[var(--sg-border)] bg-[var(--sg-surface)] shadow-[var(--sg-shadow-lg)]">
            <div className="flex h-14 items-center justify-between px-4">
              <BrandMark />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid size-9 cursor-pointer place-items-center rounded-lg text-[var(--sg-muted)] hover:bg-[var(--sg-surface-2)] hover:text-[var(--sg-fg)]"
              >
                <XIcon size={16} title="Close navigation" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
              <NavLinks role={role} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-40 flex h-14 items-center justify-between gap-3",
            "border-b border-[var(--sg-border)] bg-[var(--sg-bg)]/80 px-4 backdrop-blur-md sm:px-6",
            "print:hidden",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid size-9 cursor-pointer place-items-center rounded-[10px] border border-[var(--sg-border)] bg-[var(--sg-surface-2)] text-[var(--sg-fg-secondary)] hover:text-[var(--sg-fg)] lg:hidden"
            >
              <HamburgerIcon />
            </button>
            <span className="lg:hidden">
              <BrandMark compact />
            </span>
            {/* A live-ness cue, not decoration: the incident feed and approval
                queue are Realtime-backed, so "live" is a real property of this
                console and worth stating once. */}
            <span className="hidden items-center gap-1.5 text-xs text-[var(--sg-muted)] sm:flex">
              <span
                aria-hidden="true"
                className="sg-live-dot size-1.5 rounded-full bg-[var(--sg-allow)]"
              />
              Live · policy enforced by FastAPI
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RoleChip role={role} />
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
