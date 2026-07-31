"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "./icons";

export const THEME_STORAGE_KEY = "sg-theme";

/* Runs before first paint (see app/layout.tsx) so the console never flashes the
   wrong theme. Kept as a string constant next to the toggle that has to agree
   with it — the storage key and the attribute name are the whole contract. */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

type Theme = "dark" | "light";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<Theme>("dark");

  // Read from the DOM, not from storage: the bootstrap script above has already
  // resolved system-preference vs. stored choice, so the attribute is the truth.
  React.useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode — the toggle still works for this session */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "light"}
      className={cn(
        "grid size-9 cursor-pointer place-items-center rounded-[10px] border border-[var(--sg-border)]",
        "bg-[var(--sg-surface-2)] text-[var(--sg-fg-secondary)] transition-colors duration-150",
        "hover:border-[var(--sg-border-strong)] hover:text-[var(--sg-fg)]",
        className,
      )}
    >
      {theme === "dark" ? (
        <SunIcon size={16} title="Switch to light theme" />
      ) : (
        <MoonIcon size={16} title="Switch to dark theme" />
      )}
    </button>
  );
}
