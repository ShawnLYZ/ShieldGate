import type { ClassifyResponse, PolicySnapshot } from "@shieldgate/policy";

type StoredConfig = { backendUrl?: string; employeeToken?: string };

async function cfg() {
  const { backendUrl = "http://127.0.0.1:8000", employeeToken = "sg-emp-demo-001" } =
    await chrome.storage.local.get<StoredConfig>(["backendUrl", "employeeToken"]);
  return { backendUrl, employeeToken };
}

export async function classify(payload: unknown): Promise<ClassifyResponse> {
  const { backendUrl, employeeToken } = await cfg();
  const r = await fetch(`${backendUrl}/api/v1/classify`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-ShieldGate-Token": employeeToken },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`classify ${r.status}`);
  return (await r.json()) as ClassifyResponse;
}

export async function fetchSnapshot(): Promise<PolicySnapshot> {
  const { backendUrl, employeeToken } = await cfg();
  const r = await fetch(`${backendUrl}/api/v1/policy/snapshot`, {
    headers: { "X-ShieldGate-Token": employeeToken },
  });
  if (!r.ok) throw new Error(`snapshot ${r.status}`);
  return (await r.json()) as PolicySnapshot;
}

export async function sendEvents(events: unknown[]): Promise<void> {
  // Throws on failure so the background worker can queue the events for retry
  // (degraded-mode event queue — see src/event-queue.ts).
  const { backendUrl, employeeToken } = await cfg();
  const r = await fetch(`${backendUrl}/api/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-ShieldGate-Token": employeeToken },
    body: JSON.stringify({ events }),
  });
  if (!r.ok) throw new Error(`events ${r.status}`);
}

export async function redactConfirm(text: string, tool_domain: string): Promise<ClassifyResponse> {
  const { backendUrl, employeeToken } = await cfg();
  const r = await fetch(`${backendUrl}/api/v1/redact/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-ShieldGate-Token": employeeToken },
    body: JSON.stringify({ text, tool_domain }),
  });
  if (!r.ok) throw new Error(`redact ${r.status}`);
  return (await r.json()) as ClassifyResponse;
}

export async function registerProvenance(
  text: string, tool_domain: string,
): Promise<{ public_ref: string; footer: string }> {
  const { backendUrl, employeeToken } = await cfg();
  const r = await fetch(`${backendUrl}/api/v1/provenance`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-ShieldGate-Token": employeeToken },
    body: JSON.stringify({ text, tool_domain }),
  });
  if (!r.ok) throw new Error(`provenance ${r.status}`);
  return (await r.json()) as { public_ref: string; footer: string };
}

export async function classifyResponse(text: string, tool_domain: string): Promise<ClassifyResponse> {
  const { backendUrl, employeeToken } = await cfg();
  const r = await fetch(`${backendUrl}/api/v1/classify`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-ShieldGate-Token": employeeToken },
    body: JSON.stringify({
      direction: "response", text, tool_domain, client_matches: [], policy_version: null,
    }),
  });
  if (!r.ok) throw new Error(`classify ${r.status}`);
  return (await r.json()) as ClassifyResponse;
}

export async function requestAccess(tool_name: string, tool_url: string, purpose: string): Promise<unknown> {
  const { backendUrl, employeeToken } = await cfg();
  const r = await fetch(`${backendUrl}/api/v1/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-ShieldGate-Token": employeeToken },
    body: JSON.stringify({ tool_name, tool_url, purpose }),
  });
  if (!r.ok) throw new Error(`request ${r.status}`);
  return await r.json();
}
