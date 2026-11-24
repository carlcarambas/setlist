"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, mobileLabels, primaryNav } from "./nav-items";

/** Tab bar with the current page highlighted. Render inside <Suspense> with `MobileTabBarLinks` as fallback. */
export function MobileTabBar() {
  return <MobileTabBarLinks pathname={usePathname()} />;
}

/** The same tabs without reading the URL, so it can be part of the static page shell. */
export function MobileTabBarLinks({ pathname = null }: { pathname?: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-xs text-muted-foreground",
                  active && "border-primary font-semibold text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {mobileLabels[href]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
