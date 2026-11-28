import Link from "next/link";
import { ListMusic } from "lucide-react";

export function Brand() {
  return (
    <Link href="/dashboard" className="flex min-h-11 items-center gap-2 font-rounded text-xl font-semibold">
      <span className="flex size-9 items-center justify-center rounded-full bg-highlight text-black">
        <ListMusic className="size-4" aria-hidden />
      </span>
      Setlist
    </Link>
  );
}
