import { ICON_SPINNER } from "./icons";
import { noticeStack } from "./notice-stack";

/**
 * Shown only when a classify call is likely to escalate to the local inference
 * layer (content.ts predicts the backend's own gate), which is the one path
 * slow enough that silence would read as the site being broken. The copy names
 * *why* it is slow rather than just spinning.
 */
export function showPendingIndicator(root: ShadowRoot): () => void {
  const el = document.createElement("div");
  el.className = "sg-pending";
  el.setAttribute("data-testid", "sg-pending");
  el.setAttribute("role", "status");
  const text = document.createElement("span");
  text.textContent = "Checking this prompt…";
  el.innerHTML = ICON_SPINNER;
  el.appendChild(text);
  noticeStack(root).appendChild(el);
  return () => el.remove();
}

export async function withPendingIndicator<T>(
  show: () => () => void,
  shouldShow: boolean,
  work: () => Promise<T>,
): Promise<T> {
  const dismiss = shouldShow ? show() : null;
  try {
    return await work();
  } finally {
    dismiss?.();
  }
}
