import * as React from "react";
import { cn } from "@/lib/utils";

/* One icon family, one grid (24), one stroke width (1.75). Hand-inlined rather
   than pulled from a package so the bundle carries exactly the ~30 glyphs this
   console uses — and so nothing here is an emoji, which renders differently on
   every OS and cannot be themed. Geometry follows the Lucide/Feather
   conventions the rest of the industry reads fluently.

   Every icon is `aria-hidden` by default: an icon next to a label is
   decoration. The handful of icon-only controls pass an explicit `title`,
   which turns the glyph into an `img` with an accessible name. */

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  title?: string;
}

function makeIcon(displayName: string, path: React.ReactNode, filled = false) {
  const Comp = ({ size = 16, title, className, ...props }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  );
  Comp.displayName = displayName;
  return Comp;
}

export const ShieldIcon = makeIcon(
  "ShieldIcon",
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
);

export const ShieldCheckIcon = makeIcon(
  "ShieldCheckIcon",
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </>,
);

export const GridIcon = makeIcon(
  "GridIcon",
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
);

export const AlertTriangleIcon = makeIcon(
  "AlertTriangleIcon",
  <>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>,
);

export const BanIcon = makeIcon(
  "BanIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </>,
);

export const CheckIcon = makeIcon("CheckIcon", <path d="M20 6 9 17l-5-5" />);

export const CheckCircleIcon = makeIcon(
  "CheckCircleIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </>,
);

export const XIcon = makeIcon("XIcon", <path d="M18 6 6 18M6 6l12 12" />);

export const InfoIcon = makeIcon(
  "InfoIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </>,
);

export const ClipboardCheckIcon = makeIcon(
  "ClipboardCheckIcon",
  <>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </>,
);

export const InboxIcon = makeIcon(
  "InboxIcon",
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
  </>,
);

export const ScanTextIcon = makeIcon(
  "ScanTextIcon",
  <>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 9h10M7 13h6" />
  </>,
);

export const ScaleIcon = makeIcon(
  "ScaleIcon",
  <>
    <path d="M12 3v18M7 21h10" />
    <path d="M5 7h14" />
    <path d="M6.5 7 4 13h5l-2.5-6Z" />
    <path d="M17.5 7 15 13h5l-2.5-6Z" />
  </>,
);

export const RadarIcon = makeIcon(
  "RadarIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 12 18.4 5.6" />
  </>,
);

export const LinkChainIcon = makeIcon(
  "LinkChainIcon",
  <>
    <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.1" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.1" />
  </>,
);

export const FingerprintIcon = makeIcon(
  "FingerprintIcon",
  <>
    <path d="M4.5 10a7.5 7.5 0 0 1 15 0" />
    <path d="M7.5 11a4.5 4.5 0 0 1 9 0c0 3.5-.6 6.5-1.6 9" />
    <path d="M10.5 11a1.5 1.5 0 0 1 3 0c0 4-.8 7-2 10" />
    <path d="M4.8 14c-.2 1.6-.6 3.2-1.3 4.7" />
    <path d="M7.4 15.5c-.2 1.7-.6 3.3-1.2 4.8" />
  </>,
);

export const TelescopeIcon = makeIcon(
  "TelescopeIcon",
  <>
    <path d="m10.5 12.5-6.4-2.2a1 1 0 0 1-.6-1.3l.9-2.4a1 1 0 0 1 1.3-.6l15 5.4a1 1 0 0 1 .6 1.3l-.9 2.4a1 1 0 0 1-1.3.6l-4.7-1.7" />
    <path d="M11 14v3" />
    <path d="m8 22 3-5 3 5" />
    <circle cx="11" cy="18" r="1" />
  </>,
);

export const PackageIcon = makeIcon(
  "PackageIcon",
  <>
    <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </>,
);

export const MatrixIcon = makeIcon(
  "MatrixIcon",
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
  </>,
);

export const SettingsIcon = makeIcon(
  "SettingsIcon",
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.36.42.66.79.85.24.12.51.18.78.18H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </>,
);

export const FileTextIcon = makeIcon(
  "FileTextIcon",
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6M9 17h6" />
  </>,
);

export const SearchIcon = makeIcon(
  "SearchIcon",
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

export const SunIcon = makeIcon(
  "SunIcon",
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
);

export const MoonIcon = makeIcon(
  "MoonIcon",
  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
);

export const ChevronRightIcon = makeIcon("ChevronRightIcon", <path d="m9 18 6-6-6-6" />);
export const ChevronDownIcon = makeIcon("ChevronDownIcon", <path d="m6 9 6 6 6-6" />);

export const DownloadIcon = makeIcon(
  "DownloadIcon",
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10.5 12 15.5l5-5" />
    <path d="M12 15V3" />
  </>,
);

export const ExternalLinkIcon = makeIcon(
  "ExternalLinkIcon",
  <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
  </>,
);

export const LogOutIcon = makeIcon(
  "LogOutIcon",
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </>,
);

export const UserIcon = makeIcon(
  "UserIcon",
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </>,
);

export const ClockIcon = makeIcon(
  "ClockIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);

export const CoinsIcon = makeIcon(
  "CoinsIcon",
  <>
    <ellipse cx="9" cy="6" rx="6" ry="3" />
    <path d="M3 6v5c0 1.7 2.7 3 6 3s6-1.3 6-3" />
    <path d="M3 11v5c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.3" />
    <ellipse cx="17" cy="15" rx="4" ry="2" />
    <path d="M13 15v3c0 1.1 1.8 2 4 2s4-.9 4-2v-3" />
  </>,
);

export const SpinnerIcon = ({ size = 16, className, title, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    className={cn("shrink-0 motion-safe:animate-spin", className)}
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    focusable="false"
    {...props}
  >
    {title ? <title>{title}</title> : null}
    <circle cx="12" cy="12" r="9" opacity={0.25} />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </svg>
);
SpinnerIcon.displayName = "SpinnerIcon";
