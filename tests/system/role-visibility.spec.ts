import { expect, test } from "./fixtures";

// PRD seam-1 journey: "role-scoped visibility via the three demo logins (RLS
// verified behaviorally here)". The RLS matrix is declared in SQL; this proves
// it at the seam — what each logged-in role can actually see on screen.
//
// Cross-department fixture data is seeded through the backend API (the only
// writer in the system, design §1) using two seeded employee tokens from
// different departments, then read back through the dashboard's RLS-scoped
// Supabase client.
const ENG_TOKEN = "sg-emp-demo-002"; // EMP-7C42, Engineering
const FIN_TOKEN = "sg-emp-demo-003"; // EMP-9B10, Finance
const BACKEND = "http://127.0.0.1:8000";
const ENG_PSEUDONYM = "EMP-7C42";
const FIN_PSEUDONYM = "EMP-9B10";
// Unique per run so a re-run without a db reset can still find its own rows.
const STAMP = Date.now().toString().slice(-6);
const ENG_TOOL = `EngScopeTool${STAMP}`;
const FIN_TOOL = `FinScopeTool${STAMP}`;

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: BACKEND });
  for (const [token, excerpt] of [[ENG_TOKEN, `eng-scope-${STAMP}`], [FIN_TOKEN, `fin-scope-${STAMP}`]] as const) {
    const r = await api.post("/api/v1/events", {
      headers: { "X-ShieldGate-Token": token },
      data: { events: [{ event_type: "block", direction: "prompt", tool_domain: "localhost:5175",
                         data_category: "restricted", matrix_action: "block",
                         pattern_types: ["card"], masked_excerpt: excerpt }] },
    });
    expect(r.ok()).toBeTruthy();
  }
  for (const [token, tool] of [[ENG_TOKEN, ENG_TOOL], [FIN_TOKEN, FIN_TOOL]] as const) {
    const r = await api.post("/api/v1/approvals", {
      headers: { "X-ShieldGate-Token": token },
      data: { tool_name: tool, tool_url: `https://${tool.toLowerCase()}.example`,
              purpose: "department scoping fixture" },
    });
    expect(r.ok()).toBeTruthy();
  }
  await api.dispose();
});

test("admin sees every department's incidents and requests", async ({ context }) => {
  const dash = await context.newPage();
  await dash.goto("http://localhost:3000/login");
  await dash.getByTestId("login-admin").click();
  await dash.waitForURL("**/overview");

  await dash.goto("http://localhost:3000/incidents");
  const feed = dash.getByTestId("incident-row");
  await expect(feed.filter({ hasText: ENG_PSEUDONYM }).first()).toBeVisible({ timeout: 15_000 });
  await expect(feed.filter({ hasText: FIN_PSEUDONYM }).first()).toBeVisible();

  await dash.goto("http://localhost:3000/approvals");
  const rows = dash.getByTestId("approval-row");
  await expect(rows.filter({ hasText: ENG_TOOL })).toHaveCount(1, { timeout: 15_000 });
  await expect(rows.filter({ hasText: FIN_TOOL })).toHaveCount(1);
});

test("manager sees only their own department, in both incidents and approvals", async ({ context }) => {
  const dash = await context.newPage();
  await dash.goto("http://localhost:3000/login");
  await dash.getByTestId("login-manager").click();
  await dash.waitForURL("**/overview");

  // Demo Manager is Engineering: audit_select scopes rows to their department,
  // and the backend's /approvals listing applies the same department filter.
  await dash.goto("http://localhost:3000/incidents");
  await expect(dash.getByTestId("incident-row").filter({ hasText: ENG_PSEUDONYM }).first())
    .toBeVisible({ timeout: 15_000 });
  await expect(dash.getByTestId("incident-row").filter({ hasText: FIN_PSEUDONYM })).toHaveCount(0);
  // Nothing Finance-shaped leaked anywhere else on the page either.
  await expect(dash.locator("body")).not.toContainText(FIN_PSEUDONYM);

  await dash.goto("http://localhost:3000/approvals");
  await expect(dash.getByTestId("approval-row").filter({ hasText: ENG_TOOL }))
    .toHaveCount(1, { timeout: 15_000 });
  await expect(dash.getByTestId("approval-row").filter({ hasText: FIN_TOOL })).toHaveCount(0);
});

test("employee is confined to their own requests", async ({ context }) => {
  const dash = await context.newPage();
  await dash.goto("http://localhost:3000/login");
  await dash.getByTestId("login-employee").click();

  // Role-aware middleware (design §9) sends an employee to their own home even
  // though the login button pushes /overview.
  await dash.waitForURL("**/my-requests", { timeout: 15_000 });

  // Governance routes are not theirs: redirected back, never rendered.
  await dash.goto("http://localhost:3000/audit");
  await expect(dash).toHaveURL(/\/my-requests/);
  await dash.goto("http://localhost:3000/incidents");
  await expect(dash).toHaveURL(/\/my-requests/);

  // Their own view carries neither department's fixture requests: both were
  // filed with employee *tokens*, and this page is JWT/profile-scoped by RLS.
  await expect(dash.getByTestId("request-tool-form")).toBeVisible();
  await expect(dash.locator("body")).not.toContainText(FIN_TOOL);
  await expect(dash.locator("body")).not.toContainText(ENG_TOOL);
  // And no incident data reaches an employee at all (no audit_events policy).
  await expect(dash.getByTestId("incident-row")).toHaveCount(0);
});
