/**
 * SVG icon strings for the shadow-DOM UI.
 *
 * Strings rather than elements because every surface here is built with
 * innerHTML from a template literal, and vector rather than emoji because this
 * chrome is injected into somebody else's page: an emoji renders as a colour
 * bitmap from the *host page's* font stack, which is uncontrollable, unthemeable
 * and looks different on every OS. These inherit `currentColor` and the
 * surrounding font size, so one glyph works on the banner, in the panel header
 * and inside a button.
 *
 * All are 24-grid, 1.75 stroke — the same family and weight as the dashboard's
 * icon set, so the two halves of the product look like one product.
 */

function icon(body: string, size = 16): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true" focusable="false" class="sg-icon">${body}</svg>`
  );
}

export const ICON_SHIELD = icon(
  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
);

export const ICON_BAN = icon('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>');

export const ICON_ALERT = icon(
  '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>' +
    '<path d="M12 9v4"/><path d="M12 17h.01"/>',
);

export const ICON_INFO = icon(
  '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
);

export const ICON_ERASER = icon(
  '<path d="m7 21-4-4a2 2 0 0 1 0-2.8l9.2-9.2a2 2 0 0 1 2.8 0l4.9 4.9a2 2 0 0 1 0 2.8L12.6 21"/>' +
    '<path d="M7 21h13"/><path d="m9.5 8.5 6 6"/>',
);

export const ICON_PENCIL = icon(
  '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
);

export const ICON_KEY = icon(
  '<circle cx="7.5" cy="15.5" r="3.5"/><path d="m10 13 8.5-8.5"/><path d="m17 6 2 2"/><path d="m14.5 8.5 2 2"/>',
);

export const ICON_SEND = icon('<path d="M4 12h14"/><path d="m12 5 7 7-7 7"/>');

export const ICON_CHECK = icon('<path d="M20 6 9 17l-5-5"/>');

export const ICON_CLIPBOARD = icon(
  '<rect x="8" y="2" width="8" height="4" rx="1"/>' +
    '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' +
    '<path d="m9 14 2 2 4-4"/>',
);

export const ICON_PLUG_OFF = icon(
  '<path d="M9 3v5"/><path d="M15 3v5"/>' +
    '<path d="M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8Z"/><path d="M12 17v4"/>' +
    '<path d="m3 3 18 18"/>',
);

export const ICON_X = icon('<path d="M18 6 6 18M6 6l12 12"/>');

/** Indeterminate spinner. The rotation lives in CSS (`.sg-spin`). */
export const ICON_SPINNER =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.25" stroke-linecap="round" aria-hidden="true" focusable="false" ' +
  'class="sg-icon sg-spin"><circle cx="12" cy="12" r="9" opacity=".25"/>' +
  '<path d="M21 12a9 9 0 0 0-9-9"/></svg>';
