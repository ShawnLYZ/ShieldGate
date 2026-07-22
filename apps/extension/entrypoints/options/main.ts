export {};

const backend = document.getElementById("backendUrl") as HTMLInputElement;
const token = document.getElementById("employeeToken") as HTMLInputElement;
const status = document.getElementById("status")!;
chrome.storage.local.get<{ backendUrl?: string; employeeToken?: string }>(["backendUrl", "employeeToken"]).then((v) => {
  backend.value = v.backendUrl ?? "http://127.0.0.1:8000";
  token.value = v.employeeToken ?? "sg-emp-demo-001";
});
document.getElementById("save")!.addEventListener("click", async () => {
  await chrome.storage.local.set({ backendUrl: backend.value, employeeToken: token.value });
  status.textContent = "Saved.";
});
