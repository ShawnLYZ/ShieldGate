import { createClient as createSb, type SupabaseClient } from "@supabase/supabase-js";

// Singleton: every page/component in this app calls createClient(). A fresh
// client per call means a fresh GoTrueClient per call, all sharing the same
// localStorage session key ("sb-127-auth-token") — Supabase warns this causes
// undefined behavior, and in practice it does: independent background token
// refreshes race and rotate the (single-use) refresh token under each other,
// so a stale client's access_token goes invalid and its Realtime channel
// starts getting "Error 401: Unauthorized" on postgres_changes payloads (rows
// arrive as empty {}). One client per browser tab avoids the race.
let client: SupabaseClient | undefined;

export function createClient() {
  if (!client) {
    client = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true } });
  }
  return client;
}
