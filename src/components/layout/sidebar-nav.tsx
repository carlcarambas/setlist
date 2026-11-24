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
        "flex min-h-11 items-center gap-3 rounded-md border-l-4 border-transparent px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        active && "border-primary bg-accent font-semibold text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}

/** Sidebar with the current page highlighted. Render inside <Suspense> with `SidebarNavLinks` as fallback. */
export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  return <SidebarNavLinks isAdmin={isAdmin} pathname={usePathname()} />;
}

/** The same links without reading the URL, so it can be part of the static page shell. */
export function SidebarNavLinks({ isAdmin, pathname = null }: { isAdmin: boolean; pathname?: string | null }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3">
      {primaryNav.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
      {isAdmin ? (
        <>
          <p className="mt-4 px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Administration
          </p>
          {adminNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </>
      ) : null}
      <div className="mt-4">
        <NavLink item={settingsNav} pathname={pathname} />
      </div>
    </nav>
  );
}
