import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "./fixtures";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(here, "../../scripts/register-demo-decision.sh");
const EXPLANATION =
  "Ticket ranked lower urgency because its description matched known self-serve resolutions.";

test("a registered decision is publicly explainable by reference and can be appealed", async ({ context }) => {
  // scripts/register-demo-decision.sh curls POST /decisions (X-Internal-Key auth) with the
  // "AI Ticket Triage" demo decision and prints {"public_ref": "DR-..."} — the same
  // registration path the case study's redress requirement exercises end to end.
  const stdout = execFileSync("bash", [SCRIPT], { encoding: "utf-8" });
  const { public_ref: ref } = JSON.parse(stdout) as { public_ref: string };
  expect(ref).toMatch(/^DR-\d{4}-\d{6}$/);

  const dash = await context.newPage();
  // /lookup is a public page (no Supabase session) served by FastAPI's exact-ref-match
  // endpoints, so no login step is needed.
  await dash.goto("http://localhost:3000/lookup");

  await dash.getByTestId("lookup-ref-input").fill(ref);
  await dash.getByRole("button", { name: "Look up" }).click();

  const explanation = dash.getByTestId("lookup-explanation");
  await expect(explanation).toBeVisible({ timeout: 10_000 });
  await expect(explanation).toContainText(EXPLANATION);

  await dash
    .getByPlaceholder("Explain why you think this decision should be reviewed…")
    .fill("I believe this ticket was mis-ranked and needs a human review.");
  await dash.getByTestId("appeal-submit").click();

  const appealRef = dash.getByTestId("appeal-ref");
  await expect(appealRef).toBeVisible({ timeout: 10_000 });
  await expect(appealRef).toContainText(/^AP-\d{4}-\d{6}$/);
});
