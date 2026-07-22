import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { expect, test } from "./fixtures";

// apps/mock-ai/src/main.ts's default reply is a fixed canned string, so registering its
// provenance hashes the exact same content on every run of this spec — verify_by_text's
// `select ... where content_hash=$1` (apps/backend/src/shieldgate/routes/provenance.py) has
// no ordering guarantee, so a stale row from an earlier run could resolve instead of the one
// this test just registered. Clear it first, same reset pattern as coaching.spec.ts.
const REPLY_TEXT =
  "Here's a drafted paragraph you can adapt: Our team continues to make steady progress this quarter.";
const DB_CONTAINER = "supabase_db_phase-1-foundation";

test.beforeAll(() => {
  const hash = createHash("sha256").update(REPLY_TEXT).digest("hex");
  execFileSync("docker", [
    "exec", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
    "-c", `delete from public.provenance_records where content_hash='${hash}';`,
  ]);
});

test("copying an assistant reply adds a provenance footer + toast, and the dashboard verifies the same PV- reference", async ({ context }) => {
  // MV3 content scripts run in an isolated JS world with their own `navigator` realm, so
  // a page.addInitScript() override of navigator.clipboard.writeText (main world) is never
  // seen by content.ts's onCopy handler (isolated world) — only a real permission grant lets
  // both worlds read/write the same underlying browser clipboard.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:5175" });

  const page = await context.newPage();
  await page.goto("http://localhost:5175");
  await expect(page.getByTestId("sg-banner")).toBeVisible();

  await page.getByTestId("composer").fill("summarise the quarterly all-hands agenda");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("message-assistant")).toBeVisible({ timeout: 10_000 });

  await page.getByTestId("copy-btn").click();

  // onCopy calls POST /provenance, writes the footered text to the clipboard, then always
  // shows a toast — a hard invariant per content.ts, even on failure.
  const toast = page.getByTestId("sg-toast");
  await expect(toast).toBeVisible({ timeout: 10_000 });
  const toastText = await toast.textContent();
  const pvRef = toastText?.match(/PV-\d{4}-\d{6}/)?.[0];
  expect(pvRef).toBeTruthy();

  const footeredText = await page.evaluate(() => navigator.clipboard.readText());
  expect(footeredText).toContain(pvRef);

  const dash = await context.newPage();
  await dash.goto("http://localhost:3000/login");
  await dash.getByTestId("login-admin").click();
  // Wait for the post-login navigation before hitting an authed-fetch page, same reason
  // money-path.spec.ts waits before touching the realtime-backed /incidents page.
  await dash.waitForURL("**/overview");
  await dash.goto("http://localhost:3000/provenance");

  await dash.getByTestId("provenance-text-input").fill(footeredText);
  await dash.getByTestId("provenance-verify-text").click();

  const result = dash.getByTestId("provenance-result");
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toContainText("AI-assisted");
  await expect(result).toContainText(pvRef!);
});
