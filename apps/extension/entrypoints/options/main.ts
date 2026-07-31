export {};

const backend = document.getElementById("backendUrl") as HTMLInputElement;
const token = document.getElementById("employeeToken") as HTMLInputElement;
const status = document.getElementById("status")!;
const savedIcon = document.getElementById("savedIcon")!;

chrome.storage.local.get<{ backendUrl?: string; employeeToken?: string }>(["backendUrl", "employeeToken"]).then((v) => {
  backend.value = v.backendUrl ?? "http://127.0.0.1:8000";
  token.value = v.employeeToken ?? "sg-emp-demo-001";
});

/** Editing after a save clears the confirmation — a stale "Saved." next to a
 *  changed field claims something that is no longer true. */
function clearSaved() {
  status.textContent = "";
  savedIcon.classList.remove("is-visible");
}
backend.addEventListener("input", clearSaved);
token.addEventListener("input", clearSaved);

document.getElementById("save")!.addEventListener("click", async () => {
  await chrome.storage.local.set({ backendUrl: backend.value, employeeToken: token.value });
  status.textContent = "Saved.";
  savedIcon.classList.add("is-visible");
});
