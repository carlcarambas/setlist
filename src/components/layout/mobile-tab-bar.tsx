"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, mobileLabels, primaryNav, settingsNav } from "./nav-items";

/** Tab bar with the current page highlighted. Render inside <Suspense> with `MobileTabBarLinks` as fallback. */
export function MobileTabBar() {
  return <MobileTabBarLinks pathname={usePathname()} />;
}

/** The same tabs without reading the URL, so it can be part of the static page shell. */
export function MobileTabBarLinks({ pathname = null }: { pathname?: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-surface-dark pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {[...primaryNav, settingsNav].map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-16 flex-col items-center justify-center gap-1 text-xs text-white/70 outline-none",
                  active && "font-semibold text-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-150 group-active:bg-white/10 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-highlight motion-reduce:transition-none",
                    active && "bg-highlight text-black group-active:bg-highlight",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {mobileLabels[href]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
