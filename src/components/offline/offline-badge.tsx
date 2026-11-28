import { CloudCheck, CloudOff } from "lucide-react";
import type { OfflineStatus } from "@/features/offline/status";
import { cn } from "@/lib/utils";

/** Shows whether a plan or sheet opens offline (spec v2 OFF-05). Text and icon, never color alone. */
export function OfflineBadge({ status }: { status: OfflineStatus }) {
  if (status === "none") return null;
  const partial = status === "partial";
  const Icon = partial ? CloudOff : CloudCheck;
  return (
    <span
      className={cn(
        "relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap",
        partial && "border-attention bg-attention-soft text-foreground",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {partial ? "Partly offline" : "Offline"}
    </span>
  );
}
