"use client";
import { useEffect, useState } from "react";

/* Recharts wants literal colour strings, not `var(--…)` — it reads fills back
   out for legends and tooltips, and a var() round-trips as the literal text.
   So the chart tokens get resolved from CSS once on mount and again whenever
   the theme attribute flips, which is the only thing that can change them.

   Keeping this in one hook is what stops the four chart components from
   drifting into four slightly different blues. */

export interface ChartTheme {
  /** Sequential ramp, index 0 → 2 = low → high severity in the active theme. */
  ramp: [string, string, string];
  /** Single-series charts: one hue, no legend. */
  solo: string;
  grid: string;
  axis: string;
  surface: string;
}

const FALLBACK: ChartTheme = {
  ramp: ["#2f5fa8", "#5b9bf0", "#a8ccfb"],
  solo: "#5b9bf0",
  grid: "#24324a",
  axis: "#8497ae",
  surface: "#111827",
};

function read(): ChartTheme {
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    ramp: [
      v("--sg-chart-1", FALLBACK.ramp[0]),
      v("--sg-chart-2", FALLBACK.ramp[1]),
      v("--sg-chart-3", FALLBACK.ramp[2]),
    ],
    solo: v("--sg-chart-solo", FALLBACK.solo),
    grid: v("--sg-chart-grid", FALLBACK.grid),
    axis: v("--sg-chart-axis", FALLBACK.axis),
    surface: v("--sg-chart-surface", FALLBACK.surface),
  };
}

export function useChartTheme(): ChartTheme {
  // Starts on the fallback so SSR and the first client render agree; the effect
  // below replaces it with the real values before anything is painted twice.
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK);

  useEffect(() => {
    setTheme(read());
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
