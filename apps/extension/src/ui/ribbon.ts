export function showRibbon(node: HTMLElement, label: string) {
  if (node.previousElementSibling?.getAttribute("data-testid") === "sg-response-ribbon") return;
  const r = document.createElement("div");
  r.setAttribute("data-testid", "sg-response-ribbon");
  r.textContent = `⚠ ShieldGate: this response contains ${label}. Review before copying.`;
  Object.assign(r.style, { background: "#fef3f2", color: "#b42318", border: "1px solid #fecdca",
    borderRadius: "6px", padding: "6px 10px", font: "12px system-ui", margin: "4px 0" });
  node.parentElement?.insertBefore(r, node);
}
