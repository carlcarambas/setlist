import { cn } from "@/lib/utils";

const LABEL = { draft: "Draft", published: "Published", archived: "Archived" } as const;

export function PlanStatusBadge({ status }: { status: keyof typeof LABEL }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs",
        status === "draft" && "border-attention bg-attention-soft text-foreground",
      )}
    >
      {LABEL[status]}
    </span>
  );
}

export function relativeTime(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return "just now";
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), "hour");
  if (seconds < 86400 * 30) return rtf.format(-Math.round(seconds / 86400), "day");
  return new Date(iso).toLocaleDateString("en", { dateStyle: "medium" });
}
