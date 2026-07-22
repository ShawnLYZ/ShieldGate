import { expect, test } from "./fixtures";

const CARD = "4532-0151-1283-0366";
const MASKED = "4532-****-****-0366";

test("card paste is redacted, the masked residual is sent, and the raw card never appears in the transcript", async ({ context }) => {
  const page = await context.newPage();
  await page.goto("http://localhost:5175");
  await expect(page.getByTestId("sg-banner")).toBeVisible();

  await page.getByTestId("composer").fill(`please charge ${CARD} today`);
  await page.getByTestId("send").click();

  const panel = page.getByTestId("sg-block-panel");
  await expect(panel).toBeVisible();
  // Even while the panel is open, the diff view only ever shows the masked form.
  await expect(page.getByTestId("sg-diff")).toContainText(MASKED);

  await page.getByTestId("sg-send-redacted").click();
  await expect(panel).toHaveCount(0);

  // Round trip completed: the (masked) prompt lands in the transcript and gets a reply.
  await expect(page.getByTestId("message-user")).toContainText(MASKED, { timeout: 10_000 });
  await expect(page.getByTestId("message-assistant")).toBeVisible({ timeout: 10_000 });

  // The raw card must never appear anywhere on the page — not in the transcript,
  // not in any residual extension UI. Only the masked residual is present.
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain(CARD);
  expect(bodyText).toContain(MASKED);
});
