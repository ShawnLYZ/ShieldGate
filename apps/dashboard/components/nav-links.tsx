"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Role = "admin" | "manager" | "employee";

// Design §9: admin sees every panel; manager sees the department-scoped trio;
// employee sees their own requests. The nav mirrors that so nobody navigates
// into a page RLS renders empty — the *enforcement* stays RLS + require_role.
const LINKS: Array<{ href: string; label: string; roles: Role[] }> = [
  { href: "/overview", label: "Overview", roles: ["admin", "manager"] },
  { href: "/incidents", label: "Incidents", roles: ["admin", "manager"] },
  { href: "/approvals", label: "Approvals", roles: ["admin", "manager"] },
  { href: "/my-requests", label: "My requests", roles: ["employee"] },
  { href: "/output-risk", label: "Output risk", roles: ["admin"] },
  { href: "/decisions", label: "Decisions", roles: ["admin"] },
  { href: "/shadow", label: "Shadow AI", roles: ["admin"] },
  { href: "/audit", label: "Audit", roles: ["admin"] },
  { href: "/provenance", label: "Provenance", roles: ["admin"] },
  { href: "/horizon", label: "Horizon", roles: ["admin"] },
  { href: "/tools", label: "Tools", roles: ["admin"] },
  { href: "/policy-matrix", label: "Policy matrix", roles: ["admin"] },
  { href: "/settings", label: "Settings", roles: ["admin"] },
  { href: "/reports/executive", label: "Executive report", roles: ["admin"] },
];

export function NavLinks() {
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("profiles").select("role")
        .eq("id", session.user.id).single();
      if (active && data) setRole(data.role as Role);
    })();
    return () => { active = false; };
  }, []);
  return (
    <nav data-testid="nav" className="flex flex-wrap gap-4 border-b bg-white px-8 py-3 text-sm print:hidden">
      {LINKS.filter((l) => role != null && l.roles.includes(role)).map((l) => (
        <Link key={l.href} href={l.href} className="font-medium hover:underline">{l.label}</Link>
      ))}
      {/* public page — visible pre-login and to every role */}
      <Link href="/lookup" className="font-medium hover:underline">Public lookup</Link>
    </nav>
  );
}
