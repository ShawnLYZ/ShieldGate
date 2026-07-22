import { execFileSync } from "node:child_process";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const CARD = "4532-0151-1283-0366";
// The Mock AI Chat tool never appears in supabase/seed.sql's sample approval_requests
// rows, so filtering the approval queue by this text uniquely identifies the row this
// spec creates, without needing to thread the request's UUID through three separate
// browser contexts (each dashboard login gets its own fresh persistent-context profile).
const TOOL_NAME = "Mock AI Chat";
// Category-only (no regex match) content: the `fake` classifier resolves the
// marker to `internal`, which the seeded matrix blocks on Tier 0 and allows on
// Tier 1 — the one prompt whose verdict actually flips when this tool is
// approved, which is what makes the policy-sync tail observable.
const INTERNAL_PROMPT = "[[INTERNAL]] roadmap planning notes for next quarter";
const DB_CONTAINER = "supabase_db_phase-1-foundation";

function psql(sql: string) {
  execFileSync("docker", [
    "exec", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-c", sql,
  ]);
}

// This journey mutates the Tool Registry (approval writes Mock AI Chat's tier),
// so it must start from the seeded Tier 0 state or a re-run without a full
// `supabase db reset` would begin already-approved and prove nothing.
function resetMockToolToSeedState() {
  psql(`delete from public.approval_requests where tool_name = '${TOOL_NAME}';`);
  psql(`update public.tools set tier = 0 where name = '${TOOL_NAME}';`);
  psql("insert into public.policy_versions (reason) values ('test reset: mock tool back to tier 0');");
}

test.beforeAll(resetMockToolToSeedState);
// ...and again afterwards, so this journey leaves the Tool Registry as it found
// it. `tools` is a seed table the seam-2 fixtures deliberately never truncate,
// so a tier left at 1 silently breaks those tests on the same database.
test.afterAll(resetMockToolToSeedState);

// Local Supabase's realtime tenant shuts down after ~10s with no connected clients and
// takes a couple seconds to reinitialize replication on the next subscriber (confirmed via
// `docker logs supabase_realtime_...`: "Stop tenant ... because of no connected users" then
// a fresh "Starting stream replication" ~2s after the next channel joins). A mutation that
// commits while that reconnect is in flight can be missed by the channel entirely, not just
// delayed — so a bare toContainText timeout can time out for real even though the backend
// mutation already succeeded (confirmed independently via psql). A reload re-fetches the
// row through ApprovalQueue's plain REST select on mount, which doesn't depend on the
// realtime channel at all, so it sidesteps that cold-start race instead of racing it again.
async function waitForRowStatus(dash: Page, row: Locator, status: string) {
  try {
    await expect(row).toContainText(status, { timeout: 8_000 });
  } catch {
    await dash.reload();
    await expect(row).toContainText(status, { timeout: 15_000 });
  }
}

async function approveAsTier1(dash: Page, loginTestId: string, expectedStatusBefore: string, expectedAfter: string) {
  await dash.goto("http://localhost:3000/login");
  await dash.getByTestId(loginTestId).click();
  // Wait for the post-login navigation before touching realtime-backed pages —
  // otherwise the approval-queue channel can join anon and never see rows.
  await dash.waitForURL("**/overview");
  await dash.goto("http://localhost:3000/approvals");

  const row = dash.getByTestId("approval-row").filter({ hasText: TOOL_NAME }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText(expectedStatusBefore);

  // Assign Tier 1 explicitly: the unknown-vendor risk score recommends Tier 0,
  // and the reviewer's assignment is what lands in the Tool Registry (§7).
  await row.locator("select").selectOption("1");
  await row.getByRole("button", { name: "Approve" }).click();
  await waitForRowStatus(dash, row, expectedAfter);
  return row;
}

test.describe.serial("approval round-trip journey", () => {
  test("employee triggers a block, requests access, and sees the SLA confirmation", async ({ context }) => {
    const page = await context.newPage();
    await page.goto("http://localhost:5175");
    await expect(page.getByTestId("sg-banner")).toBeVisible();

    await page.getByTestId("composer").fill(`charge ${CARD}`);
    await page.getByTestId("send").click();
    await expect(page.getByTestId("sg-block-panel")).toBeVisible();

    await page.getByTestId("sg-request-access").click();
    const confirm = page.getByTestId("sg-request-confirm");
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await expect(confirm).toContainText("SLA");
  });

  test("before approval, internal-category content is blocked on the Tier 0 tool", async ({ context }) => {
    const page = await context.newPage();
    await page.goto("http://localhost:5175");
    await expect(page.getByTestId("sg-banner")).toContainText("Tier 0");

    await page.getByTestId("composer").fill(INTERNAL_PROMPT);
    await page.getByTestId("send").click();

    await expect(page.getByTestId("sg-block-panel")).toBeVisible();
    await expect(page.getByTestId("sg-reason")).toContainText("Tier 0");
    // Nothing was sent.
    await expect(page.getByTestId("message-user")).toHaveCount(0);
  });

  test("manager approves the pending request at Tier 1", async ({ context }) => {
    const dash = await context.newPage();
    await approveAsTier1(dash, "login-manager", "triaged", "under_review");
  });

  test("admin approves the request and its status becomes approved", async ({ context }) => {
    const dash = await context.newPage();
    // Both reviewer decisions are now in -> engine.py's _maybe_finalize flips
    // status to "approved", upserts the Tool Registry, and bumps the policy version.
    const row = await approveAsTier1(dash, "login-admin", "under_review", "approved");
    await expect(row).toContainText("assigned Tier 1");
  });

  test("after policy sync the tool is usable: the same prompt now passes", async ({ context }) => {
    const page = await context.newPage();
    await page.goto("http://localhost:5175");
    await expect(page.getByTestId("sg-banner")).toBeVisible();

    // Same content that was blocked two tests ago. The backend is the policy
    // brain: it resolves Mock AI Chat at its new Tier 1, where internal is
    // allowed, so the send is released instead of panelled.
    await page.getByTestId("composer").fill(INTERNAL_PROMPT);
    await page.getByTestId("send").click();

    await expect(page.getByTestId("sg-block-panel")).toHaveCount(0);
    await expect(page.getByTestId("message-user")).toContainText(
      "roadmap planning notes", { timeout: 10_000 });

    // That classify response also carried the bumped policy version, which makes
    // the background worker refresh its cached snapshot (snapshot-cache.ts's
    // noteObservedVersion) — so the next page load reflects the new tier in the
    // always-visible badge without waiting out the 5-minute TTL.
    await expect(async () => {
      await page.reload();
      await expect(page.getByTestId("sg-tier-badge")).toContainText("Tier 1", { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
  });
});
