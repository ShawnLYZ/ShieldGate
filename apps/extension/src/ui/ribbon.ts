/**
 * The response ribbon is the one piece of chrome that does NOT live in the
 * shadow root: it is inserted directly above the assistant's message in the
 * host page's own DOM, because it has to sit in the conversation flow and move
 * with it as the page scrolls. That means no shared stylesheet — every property
 * has to be inline, and every property that could be inherited from an unknown
 * host page has to be stated.
 *
 * Colours are the same verdict tokens the rest of the product uses, restated as
 * literals for the same reason. Both schemes are covered: `color-mix` against
 * `Canvas`/`CanvasText` is avoided in favour of a media-query-free palette that
 * is legible on a white or a dark message bubble, since a content script cannot
 * attach a media query to an inline style.
 */
export function showRibbon(node: HTMLElement, label: string) {
  if (node.previousElementSibling?.getAttribute("data-testid") === "sg-response-ribbon") return;
  const r = document.createElement("div");
  r.setAttribute("data-testid", "sg-response-ribbon");
  r.setAttribute("role", "status");

  // Amber-on-translucent-amber reads correctly over both a light and a dark
  // message bubble, which a solid pale fill (the old #fef3f2) does not.
  Object.assign(r.style, {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    boxSizing: "border-box",
    margin: "6px 0",
    padding: "7px 11px",
    border: "1px solid rgba(245, 165, 36, .45)",
    borderLeft: "3px solid #f5a524",
    borderRadius: "9px",
    background: "rgba(245, 165, 36, .12)",
    color: "#b26a05",
    font: "500 12px/1.5 Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
    textAlign: "left",
    letterSpacing: "normal",
    textTransform: "none",
  });

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("width", "14");
  icon.setAttribute("height", "14");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "#f5a524");
  icon.setAttribute("stroke-width", "1.75");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  icon.style.flex = "none";
  icon.innerHTML =
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>' +
    '<path d="M12 9v4"/><path d="M12 17h.01"/>';

  const text = document.createElement("span");
  // textContent: `label` comes from the classifier's match type.
  text.textContent = `ShieldGate: this response contains ${label}. Review before copying.`;

  r.append(icon, text);
  node.parentElement?.insertBefore(r, node);
}
