"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOMES, writeSessionCookies } from "@/lib/session";
import { createClient } from "@/lib/supabase";
import { BorderBeamPanel } from "@/components/ui/border-beam-panel";
import { ErrorNote } from "@/components/ui/page";
import {
  ChevronRightIcon,
  ClipboardCheckIcon,
  InboxIcon,
  ShieldCheckIcon,
  SpinnerIcon,
} from "@/components/ui/icons";

const ACCOUNTS = [
  {
    role: "Admin",
    email: "admin@shieldgate.demo",
    blurb: "Every panel — policy, audit chain, provenance, horizon.",
    Icon: ShieldCheckIcon,
  },
  {
    role: "Manager",
    email: "manager@shieldgate.demo",
    blurb: "Department-scoped incidents and the approval queue.",
    Icon: ClipboardCheckIcon,
  },
  {
    role: "Employee",
    email: "employee@shieldgate.demo",
    blurb: "Their own tool access requests and nothing else.",
    Icon: InboxIcon,
  },
];

export default function Login() {
  const router = useRouter();
  const supabase = createClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(email: string) {
    setPending(email);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: "shieldgate-demo",
      });
      if (signInError) throw signInError;
      // Land on the role's own home rather than pushing everyone at /overview and
      // relying on the middleware to bounce them: the middleware only runs on a
      // navigation, so a wrong landing page would sit there until the user moved.
      let role: string | null = null;
      if (data.session) {
        const { data: profile } = await supabase.from("profiles").select("role")
          .eq("id", data.session.user.id).single();
        role = (profile?.role as string | undefined) ?? null;
      }
      writeSessionCookies(!!data.session, role);
      router.push(ROLE_HOMES[role ?? ""] ?? "/overview");
    } catch (err) {
      setPending(null);
      setError(err instanceof Error ? err.message : "Sign-in failed. Is Supabase running?");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
      {/* The beam is spent here on purpose: this is the only decision on the
          page, and the panel is the only thing in the viewport. */}
      <BorderBeamPanel radius={18} idleSpeed={38} className="sg-rise bg-[var(--sg-surface)] p-0">
        <div className="border-b border-[var(--sg-border)] px-5 py-5">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--sg-fg)]">
            Sign in to the console
          </h1>
          <p className="mt-1 text-sm text-[var(--sg-muted)]">
            Pick a demo identity. What each one can see is enforced by row-level security in
            Postgres, not by this picker.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4">
          {ACCOUNTS.map((a) => {
            const busy = pending === a.email;
            return (
              <button
                key={a.email}
                data-testid={`login-${a.role.toLowerCase()}`}
                onClick={() => signIn(a.email)}
                disabled={pending !== null}
                className="group flex cursor-pointer items-center gap-3 rounded-[var(--sg-radius)] border border-[var(--sg-border)] bg-[var(--sg-surface-2)] p-3 text-left transition-all duration-200 hover:border-[color-mix(in_srgb,var(--sg-accent)_55%,transparent)] hover:bg-[var(--sg-surface-3)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--sg-accent-soft)] text-[var(--sg-accent-text)]"
                >
                  <a.Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--sg-fg)]">{a.role}</span>
                  <span className="block truncate text-xs text-[var(--sg-muted)]">{a.email}</span>
                  <span className="mt-0.5 block text-xs text-[var(--sg-faint)]">{a.blurb}</span>
                </span>
                <span className="shrink-0 text-[var(--sg-muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--sg-accent)]">
                  {busy ? <SpinnerIcon size={16} /> : <ChevronRightIcon size={16} />}
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="px-4 pb-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}
      </BorderBeamPanel>

      <p className="mt-4 text-center text-xs text-[var(--sg-faint)]">
        Looking up a decision made about you?{" "}
        <a href="/lookup" className="text-[var(--sg-accent-text)] underline underline-offset-2">
          No sign-in needed
        </a>
        .
      </p>
    </main>
  );
}
