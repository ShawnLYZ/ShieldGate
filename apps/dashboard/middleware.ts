import { NextResponse, type NextRequest } from "next/server";

// Design §9 role gating: middleware reads the session + role and redirects
// off-role routes to the role's home; RLS enforces data scope regardless of UI.
// The session itself lives in localStorage (see lib/session.ts), so presence and
// role are mirrored into plain cookies for this server-side check. Neither
// cookie carries a token or grants data access — a forged role cookie can move
// someone past a redirect but every read stays RLS-scoped (auth.uid() via
// current_role()/current_department()) and every mutation require_role-gated.
const COOKIE_NAME = "sg-auth-present";
const ROLE_COOKIE = "sg-role";
// /lookup (+ /lookup/appeal/[ref]) are public: unauthenticated data subjects
// look up whether AI was involved in a decision about them and file an
// appeal, per Task 11's public-page requirement. They call the backend
// directly with NEXT_PUBLIC_BACKEND_URL, no Supabase session.
const PUBLIC_PATHS = ["/login", "/lookup"];

const ROLE_HOMES: Record<string, string> = {
  admin: "/overview", manager: "/overview", employee: "/my-requests",
};
// admin: every route. Manager/employee: the §9 subsets (prefix-matched).
const ALLOWED: Record<string, string[]> = {
  manager: ["/overview", "/incidents", "/approvals"],
  employee: ["/my-requests"],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!request.cookies.get(COOKIE_NAME)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  const role = request.cookies.get(ROLE_COOKIE)?.value ?? "";
  const allowed = ALLOWED[role];
  // Unknown/absent role (cookie not yet mirrored): fall through — the page's
  // own reads are RLS-scoped, so nothing leaks while the cookie catches up.
  if (allowed) {
    const ok = allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!ok || pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = ROLE_HOMES[role];
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
