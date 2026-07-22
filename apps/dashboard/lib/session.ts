"use client";
import { useEffect } from "react";
import { createClient } from "./supabase";

// `middleware.ts` runs on the server (edge runtime) and needs "is anyone logged
// in" plus "as which role" to gate routes (design §9), but createClient()'s
// session lives in the browser's localStorage, which the server can't read.
// This hook mirrors presence + role into plain, non-sensitive cookies so the
// middleware has something to check. Neither cookie carries a token nor grants
// data access by itself — actual reads are RLS-scoped (Postgres policies keyed
// off auth.uid() via current_role()/current_department()) and backend mutations
// are require_role-gated, so a forged/stale cookie can get someone past a
// redirect but not past RLS or the API. This is why session.ts exists
// separately from api.ts: api.ts fetches the real JWT for authed requests,
// this just tracks presence/role for the middleware's redirect logic.
const COOKIE_NAME = "sg-auth-present";
const ROLE_COOKIE = "sg-role";

/** Where each role's session begins (design §9 route map). */
export const ROLE_HOMES: Record<string, string> = {
  admin: "/overview", manager: "/overview", employee: "/my-requests",
};

function setCookie(name: string, value: string | null) {
  if (typeof document === "undefined") return;
  if (value) {
    document.cookie = `${name}=${value}; path=/; samesite=lax`;
  } else {
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
  }
}

/** Write both middleware cookies synchronously. The login flow calls this before
 * navigating so the very first protected route sees the role — the hook below
 * only reacts *after* an auth-state change, which is a navigation too late. */
export function writeSessionCookies(present: boolean, role: string | null) {
  setCookie(COOKIE_NAME, present ? "1" : null);
  setCookie(ROLE_COOKIE, present ? role : null);
}

type SupabaseClient = ReturnType<typeof createClient>;
type Session = { user: { id: string } } | null;

async function syncCookies(supabase: SupabaseClient, session: Session) {
  if (!session) { writeSessionCookies(false, null); return; }
  const { data } = await supabase.from("profiles").select("role")
    .eq("id", session.user.id).single();
  writeSessionCookies(true, (data?.role as string | undefined) ?? null);
}

export function useSessionCookieSync(): void {
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setCookie(COOKIE_NAME, data.session ? "1" : null);
      void syncCookies(supabase, data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setCookie(COOKIE_NAME, session ? "1" : null);
      void syncCookies(supabase, session);
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
}
