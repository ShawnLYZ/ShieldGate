/**
 * The bottom-right column that every transient notice goes into.
 *
 * Three of them can legitimately coexist — the provenance disclosure after a
 * copy, the request-access confirmation, and the "checking this prompt"
 * indicator — and all three used to be pinned to the same fixed corner, so
 * whichever arrived last covered the others. A copy disclosure that is hidden
 * behind another toast is a disclosure that did not happen.
 *
 * `column-reverse` means the newest notice sits closest to the corner and older
 * ones ride upward, which is the direction users expect from OS notifications.
 */
export function noticeStack(root: ShadowRoot): HTMLElement {
  let stack = root.querySelector<HTMLElement>(".sg-notices");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "sg-notices";
    root.appendChild(stack);
  }
  return stack;
}
