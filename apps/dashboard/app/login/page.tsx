"use client";
import { useRouter } from "next/navigation";
import { ROLE_HOMES, writeSessionCookies } from "@/lib/session";
import { createClient } from "@/lib/supabase";

const ACCOUNTS = [
  { role: "Admin", email: "admin@shieldgate.demo" },
  { role: "Manager", email: "manager@shieldgate.demo" },
  { role: "Employee", email: "employee@shieldgate.demo" },
];

export default function Login() {
  const router = useRouter();
  const supabase = createClient();
  async function signIn(email: string) {
    const { data } = await supabase.auth.signInWithPassword({ email, password: "shieldgate-demo" });
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
  }
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">ShieldGate</h1>
      <p className="mb-4 text-sm text-gray-600">Quick-switch demo accounts:</p>
      <div className="flex flex-col gap-3">
        {ACCOUNTS.map((a) => (
          <button key={a.email} data-testid={`login-${a.role.toLowerCase()}`}
            onClick={() => signIn(a.email)}
            className="rounded-lg border bg-white px-4 py-3 text-left hover:bg-gray-100">
            <span className="font-medium">{a.role}</span>
            <span className="block text-sm text-gray-500">{a.email}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
