import "./globals.css";
import { NavLinks } from "@/components/nav-links";
import { SessionSync } from "@/components/session-sync";
export const metadata = { title: "ShieldGate" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <SessionSync />
        {/* NavLinks is role-filtered (design §9) and print:hidden — the
            executive report (app/reports/executive) is meant to be
            printed/saved as a PDF via window.print(), and nobody wants the
            app chrome on the printed page. */}
        <NavLinks />
        {children}
      </body>
    </html>
  );
}
