"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { adminNav, isActive, primaryNav, settingsNav, type NavItem } from "./nav-items";

function NavLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const { href, label, icon: Icon } = item;
  const active = pathname !== null && isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-full px-4 text-base text-white/70 transition-colors duration-150 outline-none hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight motion-reduce:transition-none",
        // Current page: a solid fill, weight and aria-current, so it doesn't rely on hue.
        active && "bg-highlight font-semibold text-black hover:bg-highlight hover:text-black",
      )}
    >
      <Icon className="size-[1.125rem] shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

function NavGroup({ items, pathname, labelledBy }: { items: NavItem[]; pathname: string | null; labelledBy?: string }) {
  return (
    <ul aria-labelledby={labelledBy} className="grid gap-1">
      {items.map((item) => (
        <li key={item.href}>
          <NavLink item={item} pathname={pathname} />
        </li>
      ))}
    </ul>
  );
}

/** Sidebar with the current page highlighted. Render inside <Suspense> with `SidebarNavLinks` as fallback. */
export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  return <SidebarNavLinks isAdmin={isAdmin} pathname={usePathname()} />;
}

/** The same links without reading the URL, so it can be part of the static page shell. */
export function SidebarNavLinks({ isAdmin, pathname = null }: { isAdmin: boolean; pathname?: string | null }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-6 px-3">
      <NavGroup items={primaryNav} pathname={pathname} />
      {isAdmin ? (
        <div className="grid gap-1">
          <p id="nav-admin" className="px-4 pb-1 text-sm text-white/55">
            Administration
          </p>
          <NavGroup items={adminNav} pathname={pathname} labelledBy="nav-admin" />
        </div>
      ) : null}
      <div className="border-t border-white/10 pt-4">
        <NavGroup items={[settingsNav]} pathname={pathname} />
      </div>
    </nav>
  );
}
