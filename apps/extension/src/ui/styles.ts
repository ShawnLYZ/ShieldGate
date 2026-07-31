/**
 * The entire visual system for the injected chrome, as one stylesheet.
 *
 * Constraints that shape everything below:
 *
 * 1. This is injected into ChatGPT / Claude / Gemini / the mock app. The shadow
 *    root starts with `all: initial` so not one host-page rule leaks in, which
 *    also means nothing is inherited — every property this UI depends on is
 *    stated here.
 * 2. The tokens are the same names and the same values as the dashboard's
 *    `app/globals.css`. An employee who is blocked in ChatGPT and the admin
 *    reading that incident on the console are looking at the same red on
 *    purpose; the two halves are one product.
 * 3. Both colour schemes are supported. This chrome sits on top of a page the
 *    user chose the theme of, so a permanently-dark overlay on a light ChatGPT
 *    reads as a foreign object rather than as system chrome.
 */

const TOKENS = `
:host {
  --sg-surface: #111827;
  --sg-surface-2: #172033;
  --sg-surface-3: #1f2a41;
  --sg-fg: #f8fafc;
  --sg-fg-secondary: #cbd5e1;
  --sg-muted: #93a3b8;
  --sg-faint: #6b7c94;
  --sg-border: #24324a;
  --sg-border-strong: #33455f;
  --sg-accent: #4f7cff;
  --sg-accent-text: #93b0ff;
  --sg-accent-soft: #16213c;
  --sg-cyan: #22c7d9;
  --sg-block: #ff6b5e;
  --sg-block-text: #ff9d94;
  --sg-block-soft: #2a1613;
  --sg-warn: #f5a524;
  --sg-warn-text: #fbc253;
  --sg-warn-soft: #2a2011;
  --sg-allow: #2fd48f;
  --sg-allow-text: #6ee7b7;
  --sg-allow-soft: #10241c;
  --sg-scrim: rgba(3, 6, 12, .66);
  --sg-shadow: 0 32px 64px -16px rgba(0, 0, 0, .75);
  --sg-ease: cubic-bezier(.16, 1, .3, 1);
  --sg-font: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
  --sg-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: light) {
  :host {
    --sg-surface: #ffffff;
    --sg-surface-2: #f7f9fc;
    --sg-surface-3: #eef2f8;
    --sg-fg: #0d1526;
    --sg-fg-secondary: #33415a;
    --sg-muted: #5a6b85;
    --sg-faint: #7c8ba3;
    --sg-border: #dbe3ee;
    --sg-border-strong: #bcc9db;
    --sg-accent: #315fea;
    --sg-accent-text: #1e46c4;
    --sg-accent-soft: #e8effe;
    --sg-cyan: #0a8fa3;
    /* Darkened against a white surface so every verdict colour still clears
       4.5:1 as body text — the dark-mode values are far too bright here. */
    --sg-block: #c8372a;
    --sg-block-text: #a52c20;
    --sg-block-soft: #fdeceb;
    --sg-warn: #a86107;
    --sg-warn-text: #8a5006;
    --sg-warn-soft: #fdf3e2;
    --sg-allow: #0a7a53;
    --sg-allow-text: #076343;
    --sg-allow-soft: #e6f7f0;
    --sg-scrim: rgba(16, 24, 40, .45);
    --sg-shadow: 0 32px 64px -20px rgba(16, 24, 40, .32);
  }
}`;

/* The rotating conic gradient. Two comets 180° apart: a ~45° tail easing into a
   4° bright head. The toe is a 4% mix of the comet colour rather than
   `transparent`, because `transparent` is rgba(0,0,0,0) and a conic ramp
   through it dips visibly grey. The second comet's head is the one place a
   surface is allowed to go coral. */
function comet(tail: string, head: string, tip: string, mid: number, start: number): string {
  return [
    `color-mix(in srgb, ${tail} 4%, transparent) ${start + 18}deg`,
    `color-mix(in srgb, ${tail} ${mid}%, transparent) ${start + 46}deg`,
    `${head} ${start + 56}deg`,
    `${tip} ${start + 60}deg`,
    `transparent ${start + 63}deg`,
  ].join(",");
}

function ring(second: string): string {
  return (
    "conic-gradient(from 0deg,transparent 0deg," +
    comet("var(--sg-accent)", "var(--sg-cyan)", "color-mix(in srgb, var(--sg-cyan) 22%, #fff)", 55, 0) +
    ",transparent 198deg," +
    comet(second, second, `color-mix(in srgb, ${second} 26%, #fff)`, 50, 198) +
    ",transparent 360deg)"
  );
}

export const PANEL_CSS = `
${TOKENS}

:host { all: initial; }

.sg-icon { display: block; flex: none; }
.sg-spin { animation: sg-rotate .9s linear infinite; }

@keyframes sg-rotate { to { rotate: 360deg; } }
@keyframes sg-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes sg-pop-in {
  from { opacity: 0; transform: translateY(10px) scale(.97); }
  to { opacity: 1; transform: none; }
}
@keyframes sg-slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

/* ------------------------------------------------------------------ banner */
/* Slim, glassy, and pinned to the top of the host page. It is the only piece
   of this UI that is always on screen, so it stays under 28px tall and never
   covers a site's own header controls for longer than it has to. */
.sg-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 2147483646;
  display: flex; align-items: center; gap: 8px;
  box-sizing: border-box; padding: 5px 12px;
  font-family: var(--sg-font); font-size: 11.5px; font-weight: 500; line-height: 16px;
  color: var(--sg-fg);
  background: color-mix(in srgb, var(--sg-surface) 88%, transparent);
  -webkit-backdrop-filter: saturate(1.6) blur(12px);
  backdrop-filter: saturate(1.6) blur(12px);
  border-bottom: 1px solid var(--sg-border);
  animation: sg-fade-in .3s var(--sg-ease) both;
}
/* Tier is stated as a word in the badge; this rail is reinforcement, never the
   only signal. */
.sg-banner::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
}
.sg-banner.t0::before { background: var(--sg-block); }
.sg-banner.t1::before { background: var(--sg-warn); }
.sg-banner.t2::before { background: var(--sg-allow); }

.sg-banner-brand { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.sg-banner.t0 .sg-banner-brand > .sg-icon { color: var(--sg-block); }
.sg-banner.t1 .sg-banner-brand > .sg-icon { color: var(--sg-warn); }
.sg-banner.t2 .sg-banner-brand > .sg-icon { color: var(--sg-allow); }

.sg-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 7px; border-radius: 999px;
  border: 1px solid var(--sg-border-strong);
  background: var(--sg-surface-2); color: var(--sg-fg-secondary);
  font-size: 11px; font-weight: 500; white-space: nowrap;
}
.sg-chip-block {
  border-color: color-mix(in srgb, var(--sg-block) 45%, transparent);
  background: var(--sg-block-soft); color: var(--sg-block-text);
}
.sg-chip-warn {
  border-color: color-mix(in srgb, var(--sg-warn) 45%, transparent);
  background: var(--sg-warn-soft); color: var(--sg-warn-text);
}
.sg-chip-allow {
  border-color: color-mix(in srgb, var(--sg-allow) 45%, transparent);
  background: var(--sg-allow-soft); color: var(--sg-allow-text);
}
.sg-banner-spacer { margin-left: auto; }

/* ----------------------------------------------------------------- overlay */
.sg-overlay {
  position: fixed; inset: 0; z-index: 2147483647;
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; padding: 24px 16px;
  font-family: var(--sg-font); font-size: 14px; line-height: 1.55;
  color: var(--sg-fg);
  /* 66% scrim: strong enough that the conversation behind stops competing for
     attention, which is the entire point of a blocking panel. */
  background: var(--sg-scrim);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  animation: sg-fade-in .22s var(--sg-ease) both;
}

/* -------------------------------------------------------------- beam panel */
/* Deliberately NOT isolation:isolate, which the upstream Motiq component sets.
   Isolating makes .sg-panel a stacking context, and a z-index:-1 child
   inside a stacking context paints *above* that element's own background — so
   the blurred glow ring lands on top of the panel fill. On the dark surface
   that reads as cast light and looks intentional; on the light surface it is
   a visible coloured smudge across the card. Without isolation the glow paints
   where it belongs: over the scrim, behind the panel. */
.sg-panel {
  position: relative;
  box-sizing: border-box;
  width: min(560px, 100%);
  border-radius: 18px;
  border: 1px solid var(--sg-border);
  background: var(--sg-surface);
  box-shadow: var(--sg-shadow);
  animation: sg-pop-in .34s var(--sg-ease) both;
}
/* Scrolling lives on an inner element, not on .sg-panel: the beam ring is
   absolutely positioned at inset:-1px, and an overflowing ancestor would clip
   it and scroll it away with the content. */
.sg-panel-scroll {
  position: relative; z-index: 1;
  max-height: min(86vh, 720px); overflow-y: auto; overflow-x: hidden;
  border-radius: 18px;
  /* Opaque, and painted after the glow: this is what stops the blurred ring
     from hazing across the card interior. Only the part of the glow that
     spills OUTSIDE the panel survives, which is the part that reads as cast
     light rather than as a smudge. */
  background: var(--sg-surface);
}

.sg-beam-ring, .sg-beam-glow {
  position: absolute; inset: -1px; border-radius: 18px;
  pointer-events: none; overflow: hidden;
}
/* The ring shape: a two-layer CSS ALPHA mask that keeps the padding band and
   punches out the middle. SVG luminance masks are avoided deliberately —
   they silently no-op in Chromium. */
.sg-beam-ring {
  z-index: 2; /* above the opaque scroll surface — it IS the border */
  padding: 2px;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}
.sg-beam-glow { filter: blur(14px); opacity: .35; }
/* The oversized square that actually spins; beam.ts writes the rotate property
   on it and nothing else, so the panel's content never repaints. */
.sg-beam-spin {
  position: absolute; left: 50%; top: 50%;
  width: 200%; aspect-ratio: 1; translate: -50% -50%;
  display: block;
}
.sg-tone-block .sg-beam-spin { background: ${ring("var(--sg-block)")}; }
.sg-tone-warn .sg-beam-spin { background: ${ring("var(--sg-warn)")}; }
.sg-tone-info .sg-beam-spin { background: ${ring("var(--sg-cyan)")}; }

/* --------------------------------------------------------- panel internals */
.sg-panel-head {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 20px 20px 0;
}
.sg-panel-mark {
  display: grid; place-items: center; flex: none;
  width: 38px; height: 38px; border-radius: 11px;
}
.sg-panel.sg-verdict-block .sg-panel-mark {
  background: var(--sg-block-soft); color: var(--sg-block-text);
}
.sg-panel.sg-verdict-warn .sg-panel-mark {
  background: var(--sg-warn-soft); color: var(--sg-warn-text);
}
.sg-panel h2 {
  margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.01em;
  color: var(--sg-fg);
}
.sg-panel-sub {
  margin: 3px 0 0; font-size: 13px; color: var(--sg-muted);
}
.sg-panel-body { padding: 14px 20px 0; }
.sg-panel p { margin: 0; }

.sg-reason {
  font-size: 14px; color: var(--sg-fg-secondary);
}

.sg-label {
  margin: 0 0 5px; font-size: 10px; font-weight: 600;
  letter-spacing: .14em; text-transform: uppercase; color: var(--sg-muted);
}

/* The diff is the evidence: the employee's own text with the detected spans
   masked in place, so they can see exactly what tripped the rule without the
   panel ever echoing the raw secret back at full fidelity. */
.sg-diff {
  margin: 0; padding: 11px 12px;
  border: 1px solid var(--sg-border); border-radius: 10px;
  background: var(--sg-surface-2);
  font-family: var(--sg-mono); font-size: 12.5px; line-height: 1.6;
  color: var(--sg-fg-secondary);
  white-space: pre-wrap; word-break: break-word;
  max-height: 190px; overflow: auto;
}
.sg-diff mark {
  padding: 1px 4px; border-radius: 4px;
  background: var(--sg-block-soft); color: var(--sg-block-text);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sg-block) 45%, transparent);
  font-weight: 600;
}

.sg-note {
  display: flex; gap: 9px; align-items: flex-start;
  padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--sg-border);
  background: var(--sg-surface-2);
  font-size: 13px; line-height: 1.5; color: var(--sg-fg-secondary);
}
.sg-note > .sg-icon { margin-top: 2px; flex: none; }
.sg-coaching {
  border-color: color-mix(in srgb, var(--sg-accent) 38%, transparent);
  background: var(--sg-accent-soft);
}
.sg-coaching > .sg-icon { color: var(--sg-accent-text); }
.sg-suggestion {
  border-color: color-mix(in srgb, var(--sg-allow) 38%, transparent);
  background: var(--sg-allow-soft); color: var(--sg-allow-text);
}
.sg-suggestion > .sg-icon { color: var(--sg-allow); }
.sg-suggestion b { font-weight: 600; }

.sg-stack { display: flex; flex-direction: column; gap: 12px; }

/* ----------------------------------------------------------------- actions */
.sg-actions {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: 16px; padding: 14px 20px 18px;
  border-top: 1px solid var(--sg-border);
  background: color-mix(in srgb, var(--sg-surface-2) 55%, transparent);
}
.sg-actions-spacer { margin-left: auto; }

/* Same three layers as the dashboard's GradientButton: a token-derived gradient
   fill, a 1px inset top highlight that reads as a lit bevel, and a sheen that
   sweeps once on hover. Press changes only translate/filter — never box
   dimensions — so clicking can never reflow the panel. */
.sg-btn {
  --gb-from: var(--sg-accent);
  --gb-to: color-mix(in srgb, var(--sg-cyan) 78%, var(--sg-accent));
  --gb-glow: color-mix(in srgb, var(--sg-accent) 45%, transparent);
  position: relative; isolation: isolate; overflow: hidden;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-sizing: border-box;
  /* 36px tall + the 8px gap keeps every control comfortably clickable and
     nowhere near the 44px-target failure mode. */
  min-height: 36px; padding: 8px 14px;
  border-radius: 10px; border: 1px solid color-mix(in srgb, var(--gb-from) 55%, transparent);
  background-image: linear-gradient(135deg, var(--gb-from) 0%, var(--gb-to) 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 1px 2px rgba(0,0,0,.28);
  font-family: var(--sg-font); font-size: 13px; font-weight: 600; line-height: 18px;
  color: #fff; cursor: pointer;
  transition: transform .16s var(--sg-ease), box-shadow .2s var(--sg-ease), filter .2s var(--sg-ease);
}
.sg-btn::after {
  content: ""; position: absolute; inset: 0; z-index: -1;
  background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,.28) 45%, transparent 70%);
  transform: translateX(-120%);
  transition: transform .62s var(--sg-ease);
}
.sg-btn:hover {
  transform: translateY(-1px); filter: saturate(1.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 6px 20px -6px var(--gb-glow), 0 2px 6px rgba(0,0,0,.3);
}
.sg-btn:hover::after { transform: translateX(120%); }
.sg-btn:active { transform: translateY(0); filter: saturate(.95) brightness(.96); }
.sg-btn:focus-visible { outline: 2px solid var(--sg-accent); outline-offset: 2px; }

/* Coral is reserved for the irreversible thing on the surface — here, sending
   anyway with the send recorded against you. */
.sg-btn-danger {
  --gb-from: var(--sg-block);
  --gb-to: color-mix(in srgb, var(--sg-warn) 55%, var(--sg-block));
  --gb-glow: color-mix(in srgb, var(--sg-block) 50%, transparent);
}
.sg-btn-success {
  --gb-from: var(--sg-allow);
  --gb-to: color-mix(in srgb, var(--sg-cyan) 60%, var(--sg-allow));
  --gb-glow: color-mix(in srgb, var(--sg-allow) 45%, transparent);
}
/* A real surface, not a faded primary — "edit" must not read as disabled. */
.sg-btn-neutral {
  --gb-glow: transparent;
  background-image: linear-gradient(180deg, var(--sg-surface-3) 0%, var(--sg-surface-2) 100%);
  border-color: var(--sg-border-strong);
  color: var(--sg-fg);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--sg-fg) 8%, transparent), 0 1px 2px rgba(0,0,0,.2);
}
.sg-btn-neutral::after {
  background: linear-gradient(100deg, transparent 20%, color-mix(in srgb, var(--sg-fg) 10%, transparent) 45%, transparent 70%);
}

/* ------------------------------------------------------- toast / pending */
/* One bottom-right column rather than three things all pinned to the same
   corner: a provenance disclosure, a request-access confirmation and the
   pending indicator can all be on screen at once, and stacking them is the
   only way none of them covers another. */
.sg-notices {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483647;
  display: flex; flex-direction: column-reverse; align-items: flex-end; gap: 8px;
  pointer-events: none;
}
.sg-toast, .sg-pending {
  position: relative; pointer-events: auto;
  display: flex; align-items: center; gap: 9px;
  box-sizing: border-box; max-width: min(380px, calc(100vw - 36px));
  padding: 10px 14px; border-radius: 12px;
  border: 1px solid var(--sg-border-strong);
  background: color-mix(in srgb, var(--sg-surface) 94%, transparent);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 36px -14px rgba(0,0,0,.55);
  font-family: var(--sg-font); font-size: 13px; line-height: 18px; font-weight: 500;
  color: var(--sg-fg);
  animation: sg-slide-up .28s var(--sg-ease) both;
}
.sg-toast > .sg-icon { color: var(--sg-allow); }
.sg-pending > .sg-icon { color: var(--sg-accent-text); }
.sg-toast-ref {
  font-family: var(--sg-mono); font-size: 12px; color: var(--sg-muted);
}

/* ------------------------------------------------------------ preferences */
@media (prefers-reduced-motion: reduce) {
  .sg-banner, .sg-overlay, .sg-panel, .sg-toast, .sg-pending { animation: none; }
  .sg-spin { animation: none; }
  .sg-btn, .sg-btn::after { transition: none; }
  .sg-btn:hover { transform: none; }
  .sg-btn:hover::after { transform: translateX(-120%); }
}

@media (forced-colors: active) {
  .sg-beam-ring, .sg-beam-glow { display: none; }
  .sg-panel { border-color: CanvasText; }
  .sg-btn { background-image: none; border: 1px solid ButtonText; }
  .sg-btn::after { display: none; }
}

/* Narrow viewports: the action row becomes a stack so no button is ever
   clipped off the right edge of a phone-width window, and the banner drops its
   wordmark rather than wrapping onto a second line and doubling its height
   over the host page's own header. */
@media (max-width: 520px) {
  .sg-actions { flex-direction: column; align-items: stretch; }
  .sg-actions-spacer { margin-left: 0; }
  .sg-btn { width: 100%; }
  .sg-banner { gap: 6px; padding: 5px 10px; }
  .sg-banner-brand { font-size: 0; gap: 0; }
  .sg-chip { font-size: 10.5px; }
}
`;
