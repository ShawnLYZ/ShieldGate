import { execFileSync } from "node:child_process";
import type { BrowserContext } from "@playwright/test";
import { expect, test } from "./fixtures";

const CARD = "4532-0151-1283-0366";
// sg-emp-demo-002 / EMP-7C42 is a token the money-path suite never touches, so it starts
// uncoached — but reset it explicitly so re-running this spec without a full db reset
// still exercises a genuine "first block ever for this pseudonym" case.
const TOKEN = "sg-emp-demo-002";
const PSEUDONYM = "EMP-7C42";
const DB_CONTAINER = "supabase_db_phase-1-foundation";

test.beforeAll(() => {
  execFileSync("docker", [
    "exec", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
    "-c", `delete from public.coaching_state where pseudonym='${PSEUDONYM}';`,
  ]);
});

async function getExtensionId(context: BrowserContext): Promise<string> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  return new URL(worker.url()).hostname;
}

test("first block for a fresh pseudonym shows coaching; a second block for the same pseudonym does not", async ({ context }) => {
  const extensionId = await getExtensionId(context);

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  // Wait for main.ts's async chrome.storage.local.get(...).then(...) prefill to land
  // before we overwrite the token field, or that prefill can race our fill and win.
  await expect(options.locator("#backendUrl")).toHaveValue("http://127.0.0.1:8000");
  await options.locator("#employeeToken").fill(TOKEN);
  await options.locator("#save").click();
  await expect(options.locator("#status")).toHaveText("Saved.");

  const page = await context.newPage();
  await page.goto("http://localhost:5175");
  await expect(page.getByTestId("sg-banner")).toBeVisible();

  // First block ever for EMP-7C42: coaching_state insert succeeds -> coaching shown.
  await page.getByTestId("composer").fill(`charge ${CARD}`);
  await page.getByTestId("send").click();
  await expect(page.getByTestId("sg-block-panel")).toBeVisible();
  await expect(page.getByTestId("sg-coaching")).toBeVisible();

  // Close the panel without releasing the composer (Edit is a no-op besides closing),
  // so the same prompt is still sitting in the composer for a second, independent block.
  await page.getByTestId("sg-edit").click();
  await expect(page.getByTestId("sg-block-panel")).toHaveCount(0);

  // Second block, same pseudonym: coaching_state insert hits "on conflict do nothing" -> no coaching.
  await page.getByTestId("send").click();
  await expect(page.getByTestId("sg-block-panel")).toBeVisible();
  await expect(page.getByTestId("sg-coaching")).toHaveCount(0);
});
