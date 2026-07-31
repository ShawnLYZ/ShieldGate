import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { SessionSync } from "@/components/session-sync";
import { THEME_BOOTSTRAP } from "@/components/ui/theme-toggle";

export const metadata = {
  title: "ShieldGate — AI governance console",
  description:
    "Classify, enforce and evidence every AI prompt and response across the organisation.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070b12" },
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
  ],
  width: "device-width",
  initialScale: 1,
  // Deliberately not `maximumScale: 1` — pinch-zoom stays available.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Resolves the theme before first paint so the console never flashes
            the wrong one. Has to be inline and blocking — a deferred script
            runs after the first frame, which is exactly the flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Inter is the intended face; the stack in globals.css falls back to
            the platform UI font cleanly when this is unreachable (offline demo,
            locked-down network), so nothing blocks on it. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <SessionSync />
        {/* AppShell owns the role-filtered nav (design §9) and is print:hidden
            throughout — the executive report (app/reports/executive) is meant
            to be printed/saved as a PDF via window.print(), and nobody wants
            the app chrome on the printed page. */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
