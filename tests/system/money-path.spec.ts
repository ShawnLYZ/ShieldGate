import { expect, test } from "./fixtures";

const CARD = "4532-0151-1283-0366";

test("card paste on mock site is blocked with a plain-language reason", async ({ context }) => {
  const page = await context.newPage();
  await page.goto("http://localhost:5175");
  await expect(page.getByTestId("sg-banner")).toBeVisible();

  await page.getByTestId("composer").fill(`please charge ${CARD} today`);
  await page.getByTestId("send").click();

  const panel = page.getByTestId("sg-block-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("sg-reason")).toContainText("payment card number");
  await expect(page.getByTestId("sg-diff")).toContainText("4532-****-****-0366");
  // The raw card never reached the chat transcript.
  await expect(page.getByTestId("message-assistant")).toHaveCount(0);
});

test("blocked incident shows on the dashboard feed", async ({ context }) => {
  const dash = await context.newPage();
  await dash.goto("http://localhost:3000/login");
  await dash.getByTestId("login-admin").click();
  // Login's onClick awaits signInWithPassword (session persisted to storage)
  // before router.push("/overview") — wait for that navigation so the realtime
  // channel we open next joins already authenticated, not racing the login as anon.
  await dash.waitForURL("**/overview");
  await dash.goto("http://localhost:3000/incidents");

  const page = await context.newPage();
  await page.goto("http://localhost:5175");
  await page.getByTestId("composer").fill(`charge ${CARD}`);
  await page.getByTestId("send").click();
  await expect(page.getByTestId("sg-block-panel")).toBeVisible();

  await expect(dash.getByTestId("incident-row").first()).toContainText("block", { timeout: 15_000 });
});

test("clean prompt on mock site is allowed and reaches the transcript (no re-entrant submit loop)", async ({ context }) => {
  const page = await context.newPage();
  await page.goto("http://localhost:5175");
  await expect(page.getByTestId("sg-banner")).toBeVisible();

  await page.getByTestId("composer").fill("summarise the quarterly all-hands agenda");
  await page.getByTestId("send").click();

  // No block panel: the classify call returned "allow" and release() re-submitted once.
  await expect(page.getByTestId("sg-block-panel")).toHaveCount(0);
  await expect(page.getByTestId("message-user")).toContainText(
    "summarise the quarterly all-hands agenda", { timeout: 10_000 });
  // Composer clears only once main.ts's own submit handler actually runs.
  await expect(page.getByTestId("composer")).toHaveValue("");
  // Canned reply proves the round trip completed, not just that the DOM node was appended.
  await expect(page.getByTestId("message-assistant")).toContainText(
    "steady progress this quarter", { timeout: 5_000 });
});
