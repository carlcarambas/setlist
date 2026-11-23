import {
  CalendarDays,
  LayoutDashboard,
  ListMusic,
  Settings,
  Users,
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

// Primary navigation (spec §6).
export const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Music Library", icon: Library },
  { href: "/plans", label: "My Plans", icon: ListMusic },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/shared", label: "Shared with Me", icon: Users },
];

// Administrator-only navigation (spec §6).
export const adminNav: NavItem[] = [
  { href: "/admin/members", label: "Members", icon: UserCog },
  { href: "/admin/settings", label: "App Settings", icon: SlidersHorizontal },
];

export const settingsNav: NavItem = { href: "/settings", label: "Settings", icon: Settings };

// Short labels for the mobile tab bar, where width is tight.
export const mobileLabels: Record<string, string> = {
  "/dashboard": "Home",
  "/library": "Library",
  "/plans": "Plans",
  "/events": "Events",
  "/shared": "Shared",
};

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
