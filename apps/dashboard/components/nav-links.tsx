"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  AlertTriangleIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FingerprintIcon,
  GridIcon,
  InboxIcon,
  LinkChainIcon,
  MatrixIcon,
  PackageIcon,
  RadarIcon,
  ScaleIcon,
  ScanTextIcon,
  SearchIcon,
  SettingsIcon,
  TelescopeIcon,
} from "@/components/ui/icons";

export type Role = "admin" | "manager" | "employee";

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
  Icon: typeof GridIcon;
}

// Design §9: admin sees every panel; manager sees the department-scoped trio;
// employee sees their own requests. The nav mirrors that so nobody navigates
// into a page RLS renders empty — the *enforcement* stays RLS + require_role.
//
// Grouping is presentational only and changes nothing about who sees what: it
// exists because fourteen flat links is a wall, and these four headings are the
// order an auditor actually walks the product in (what happened → what we
// decided → how it is configured → prove it).
const GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Monitor",
    items: [
      { href: "/overview", label: "Overview", roles: ["admin", "manager"], Icon: GridIcon },
      { href: "/incidents", label: "Incidents", roles: ["admin", "manager"], Icon: AlertTriangleIcon },
      { href: "/output-risk", label: "Output risk", roles: ["admin"], Icon: ScanTextIcon },
      { href: "/shadow", label: "Shadow AI", roles: ["admin"], Icon: RadarIcon },
    ],
  },
  {
    title: "Govern",
    items: [
      { href: "/approvals", label: "Approvals", roles: ["admin", "manager"], Icon: ClipboardCheckIcon },
      { href: "/my-requests", label: "My requests", roles: ["employee"], Icon: InboxIcon },
      { href: "/decisions", label: "Decisions", roles: ["admin"], Icon: ScaleIcon },
      { href: "/horizon", label: "Horizon", roles: ["admin"], Icon: TelescopeIcon },
    ],
  },
  {
    title: "Configure",
    items: [
      { href: "/tools", label: "Tools", roles: ["admin"], Icon: PackageIcon },
      { href: "/policy-matrix", label: "Policy matrix", roles: ["admin"], Icon: MatrixIcon },
      { href: "/settings", label: "Settings", roles: ["admin"], Icon: SettingsIcon },
    ],
  },
  {
    title: "Evidence",
    items: [
      { href: "/audit", label: "Audit", roles: ["admin"], Icon: LinkChainIcon },
      { href: "/provenance", label: "Provenance", roles: ["admin"], Icon: FingerprintIcon },
      { href: "/reports/executive", label: "Executive report", roles: ["admin"], Icon: FileTextIcon },
    ],
  },
];

/** Reads the caller's role once. Exposed separately from the nav so the shell
 *  can label its session chip without a second round trip. */
export function useRole(): Role | null {
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
  return role;
}

function NavItemLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const { Icon } = item;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium",
        "transition-colors duration-150",
        active
          ? "bg-[var(--sg-accent-soft)] text-[var(--sg-accent-text)]"
          : "text-[var(--sg-fg-secondary)] hover:bg-[var(--sg-surface-2)] hover:text-[var(--sg-fg)]",
      )}
    >
      {/* Active is marked twice — a rail AND a fill — because a background tint
          on its own is a colour-only indicator. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full transition-opacity",
          active ? "bg-[var(--sg-accent)] opacity-100" : "opacity-0",
        )}
      />
      <Icon
        size={16}
        className={
          active
            ? "text-[var(--sg-accent)]"
            : "text-[var(--sg-muted)] group-hover:text-[var(--sg-fg-secondary)]"
        }
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function NavLinks({
  role,
  onNavigate,
  // The mobile drawer renders a second copy of this nav. Only the always-mounted
  // desktop rail carries the testid, so a locator can never match two elements.
  testId,
}: {
  role: Role | null;
  onNavigate?: () => void;
  testId?: string;
}) {
  const pathname = usePathname() ?? "";
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => role != null && i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  return (
    <nav data-testid={testId} className="flex flex-col gap-5 print:hidden">
      {groups.map((group) => (
        <div key={group.title}>
          <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sg-faint)]">
            {group.title}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <NavItemLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}

      {/* public page — visible pre-login and to every role */}
      <div>
        <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sg-faint)]">
          Public
        </div>
        <NavItemLink
          item={{ href: "/lookup", label: "Public lookup", roles: [], Icon: SearchIcon }}
          active={isActive("/lookup")}
          onNavigate={onNavigate}
        />
      </div>
    </nav>
  );
}
