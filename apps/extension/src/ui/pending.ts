export function showPendingIndicator(root: ShadowRoot): () => void {
  const el = document.createElement("div");
  el.setAttribute("data-testid", "sg-pending");
  el.textContent = "Checking this prompt…";
  Object.assign(el.style, {
    position: "fixed", bottom: "16px", right: "16px", zIndex: "2147483647",
    background: "#101828", color: "#fff", padding: "10px 14px", borderRadius: "8px",
    font: "13px system-ui",
  });
  root.appendChild(el);
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
