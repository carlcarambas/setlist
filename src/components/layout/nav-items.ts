import {
  CalendarDays,
  LayoutDashboard,
  ListMusic,
  Settings,
  Library,
  SlidersHorizontal,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Primary navigation (spec v2 §6).
export const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/library", label: "Library", icon: Library },
  { href: "/plans", label: "Plans", icon: ListMusic },
  { href: "/events", label: "Events", icon: CalendarDays },
];

// Administrator-only navigation (spec v2 §6).
export const adminNav: NavItem[] = [
  { href: "/admin/administrators", label: "Administrators", icon: UserCog },
  { href: "/admin/settings", label: "App Settings", icon: SlidersHorizontal },
];

export const settingsNav: NavItem = { href: "/settings", label: "Settings", icon: Settings };

// Short labels for the mobile tab bar, where width is tight.
export const mobileLabels: Record<string, string> = {
  "/dashboard": "Home",
  "/library": "Library",
  "/plans": "Plans",
  "/events": "Events",
  "/settings": "Settings",
};

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
