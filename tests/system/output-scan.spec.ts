import { expect, test } from "./fixtures";

test("assistant reply with exploit-shaped code is flagged by a response ribbon", async ({ context }) => {
  const page = await context.newPage();
  await page.goto("http://localhost:5175");
  await expect(page.getByTestId("sg-banner")).toBeVisible();

  // "show me the exploit" is a planted trigger in apps/mock-ai/src/main.ts's reply() —
  // the prompt itself carries no sensitive pattern, so it's allowed through unmodified;
  // the canned assistant reply is what carries the exploit-shaped payload.
  await page.getByTestId("composer").fill("show me the exploit");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("message-assistant")).toContainText("CVE-2026-0001", { timeout: 10_000 });

  // content.ts's adapter.watchResponses MutationObserver fires POST /classify (direction
  // "response") against the completed message; scan_output's _EXPLOIT patterns (curl|sh,
  // base64.b64decode, CVE-tagged payload) match and the backend returns action "warn",
  // which renders a ribbon ahead of the assistant message naming the flagged content.
  const ribbon = page.getByTestId("sg-response-ribbon");
  await expect(ribbon).toBeVisible({ timeout: 10_000 });
  await expect(ribbon).toContainText("exploit_code");
});
