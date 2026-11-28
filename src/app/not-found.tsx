import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Brand } from "@/components/layout/brand";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-8 px-4 py-10">
      <Brand />
      <main className="flex w-full max-w-md flex-col items-center gap-3 text-center">
        <SearchX className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-[1.75rem] leading-tight font-medium md:text-3xl">Page not found</h1>
        <p className="text-sm text-muted-foreground">The link may be old, or the page was removed.</p>
        <Link href="/dashboard" className="flex min-h-11 items-center underline underline-offset-4">
          Go to Home
        </Link>
      </main>
    </div>
  );
}
