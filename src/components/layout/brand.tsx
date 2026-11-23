import Link from "next/link";
import { ListMusic } from "lucide-react";

export function Brand() {
  return (
    <Link href="/dashboard" className="flex min-h-11 items-center gap-2 font-semibold">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ListMusic className="size-4" aria-hidden />
      </span>
      Setlist
    </Link>
  );
}
