export function showToast(root: ShadowRoot, message: string) {
  const t = document.createElement("div");
  t.setAttribute("data-testid", "sg-toast");
  t.textContent = message;
  Object.assign(t.style, {
    position: "fixed", bottom: "16px", right: "16px", zIndex: "2147483647",
    background: "#101828", color: "#fff", padding: "10px 14px", borderRadius: "8px",
    font: "13px system-ui",
  });
  root.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
