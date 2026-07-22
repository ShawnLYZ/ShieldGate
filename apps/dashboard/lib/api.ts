import { createClient } from "./supabase";

export async function getAccessToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authedPost(path: string, body: unknown) {
  const token = await getAccessToken();
  const base = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return await r.json();
}

export async function authedPatch(path: string, body: unknown) {
  const token = await getAccessToken();
  const base = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const r = await fetch(`${base}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return await r.json();
}

export class ApiError extends Error {
  status: number;
  constructor(path: string, status: number) {
    super(`${path} ${status}`);
    this.status = status;
  }
}

export async function authedGet(path: string) {
  const token = await getAccessToken();
  const base = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new ApiError(path, r.status);
  return await r.json();
}
