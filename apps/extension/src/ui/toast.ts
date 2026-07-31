import { ICON_CHECK } from "./icons";
import { noticeStack } from "./notice-stack";

/**
 * Bottom-right disclosure pill. This is a hard invariant of the copy flow —
 * nothing reaches the clipboard without one — so it is announced to assistive
 * tech (`role="status"`) rather than being a purely visual courtesy.
 *
 * `sg-toast-notice` distinguishes it from the request-access confirmation,
 * which shares the `.sg-toast` look but must not be able to replace this one.
 */
export function showToast(root: ShadowRoot, message: string) {
  root.querySelector(".sg-toast-notice")?.remove();
  const t = document.createElement("div");
  t.className = "sg-toast sg-toast-notice";
  t.setAttribute("data-testid", "sg-toast");
  t.setAttribute("role", "status");
  const text = document.createElement("span");
  // textContent, never innerHTML: the message embeds a backend-supplied
  // provenance reference.
  text.textContent = message;
  t.innerHTML = ICON_CHECK;
  t.appendChild(text);
  noticeStack(root).appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
