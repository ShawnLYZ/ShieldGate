"use client";
import { useSessionCookieSync } from "@/lib/session";

// Mounted once in the root layout so the auth-presence cookie middleware.ts
// checks stays current on every page, not just /login. Renders nothing.
export function SessionSync() {
  useSessionCookieSync();
  return null;
}
