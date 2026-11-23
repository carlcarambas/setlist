"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, primaryNav, settingsNav } from "./nav-items";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
      {[...primaryNav, settingsNav].map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md border-l-4 border-transparent px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "border-primary bg-accent font-semibold text-foreground",
              href === settingsNav.href && "mt-auto mb-4",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
