/**
 * The orbiting border beam, ported to the content script.
 *
 * The dashboard's BorderBeamPanel animates a conic gradient by driving a
 * registered `@property <angle>` custom property. That is not reachable here:
 * `@property` registers per-document, and this stylesheet lives inside a shadow
 * root injected into somebody else's page, where a registration collision (or a
 * host page that has already registered the same name) is a real possibility.
 *
 * So the same visual is built the other way round — a conic gradient painted on
 * an oversized square child that is *rotated*. A plain `rotate` needs no
 * property registration and cannot collide with anything on the host page. The
 * ring shape still comes from the two-layer alpha mask with
 * `mask-composite: exclude` (see styles.ts); SVG luminance masks are avoided
 * because they silently no-op in Chromium.
 *
 * The physics are the ones that make the original read as a comet rather than a
 * spinning gradient: the angular VELOCITY is sprung (k=30, d=11) toward 240°/s
 * on hover and back to 42°/s on leave, so the beams wind up and coast instead
 * of snapping between two speeds.
 */

const IDLE_SPEED = 42; // deg/s — ~8.5s per lap
const HOVER_SPEED = 240;
const STIFFNESS = 30;
const DAMPING = 11;
/** Static angle under reduced motion — both comets sit on visible edges. */
const PARKED_ANGLE = 40;

class Spring {
  x: number;
  v = 0;
  target: number;
  constructor(value: number, private k: number, private d: number) {
    this.x = value;
    this.target = value;
  }
  step(dt: number): number {
    const a = this.k * (this.target - this.x) - this.d * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Starts the beam on a panel built by `beamMarkup()`. Returns a teardown that
 * must be called when the panel is removed — otherwise the rAF loop outlives
 * the element and keeps the tab awake.
 *
 * @param seed deterministic starting phase, so two panels opened together are
 *   not in lockstep. Never Math.random: a content script that renders
 *   differently on each injection is impossible to screenshot-test.
 */
export function attachBeam(panel: HTMLElement, seed = 1): () => void {
  const spinners = panel.querySelectorAll<HTMLElement>(".sg-beam-spin");
  if (!spinners.length) return () => {};

  const startAngle = (((seed * 137.508) % 360) + 360) % 360;
  let angle = startAngle;

  const paint = (deg: number) => {
    const v = `${(((deg % 360) + 360) % 360).toFixed(2)}deg`;
    for (const s of spinners) s.style.rotate = v;
  };

  if (prefersReducedMotion()) {
    paint(PARKED_ANGLE);
    return () => {};
  }

  const speed = new Spring(IDLE_SPEED, STIFFNESS, DAMPING);
  const surge = () => { speed.target = HOVER_SPEED; };
  const settle = () => { speed.target = IDLE_SPEED; };

  panel.addEventListener("pointerenter", surge);
  panel.addEventListener("pointerleave", settle);
  // Keyboard users get the same wind-up: focus anywhere inside the panel counts.
  panel.addEventListener("focusin", surge);
  panel.addEventListener("focusout", settle);

  let raf = 0;
  let last = 0;
  const frame = (now: number) => {
    if (!last) last = now;
    // Clamped so a backgrounded tab returning after 10s does not teleport the
    // comets a hundred laps forward in one frame.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    angle += speed.step(dt) * dt;
    paint(angle);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // The panel is modal, so it is always on screen while it exists; the only
  // "not worth animating" case left is a backgrounded tab.
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  paint(angle);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibility);
    panel.removeEventListener("pointerenter", surge);
    panel.removeEventListener("pointerleave", settle);
    panel.removeEventListener("focusin", surge);
    panel.removeEventListener("focusout", settle);
  };
}

/**
 * The two layers the beam needs: a blurred copy behind the panel that reads as
 * cast light, and the masked ring itself. Both are `aria-hidden` decoration.
 *
 * `tone` picks the second comet's colour — azure/coral for a block, azure/amber
 * for a warning — so the ring says which verdict this is before any text is read.
 */
export function beamMarkup(tone: "block" | "warn" | "info"): string {
  return (
    `<div class="sg-beam-glow sg-tone-${tone}" aria-hidden="true"><i class="sg-beam-spin"></i></div>` +
    `<div class="sg-beam-ring sg-tone-${tone}" aria-hidden="true"><i class="sg-beam-spin"></i></div>`
  );
}
