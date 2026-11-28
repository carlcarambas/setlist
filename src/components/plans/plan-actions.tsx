"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Ellipsis, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { unkeepPlan } from "@/features/offline/downloads";
import { useKeptPlans } from "@/features/offline/hooks";
import { useOnline } from "@/features/offline/use-online";
import { deletePlan, duplicatePlan, setPlanStatus } from "@/features/plans/actions";
import { requestSync } from "@/features/sync/engine";

/**
 * Occasional plan actions, kept out of the way of the setlist. Removing downloads works offline;
 * the rest change the plan, so they need a connection. Delete is for administrators.
 */
export function PlanMenu({
  planId,
  title,
  archived,
  isAdmin,
}: {
  planId: string;
  title: string;
  archived: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const online = useOnline();
  const kept = useKeptPlans()?.has(planId) ?? false;
  const [pending, startTransition] = useTransition();

  // Offline there may be nothing to offer.
  if (!online && !kept) return null;

  const form = (extra: Record<string, string> = {}) => {
    const data = new FormData();
    data.set("planId", planId);
    for (const [key, value] of Object.entries(extra)) data.set(key, value);
    return data;
  };

  const duplicate = () => startTransition(() => duplicatePlan(form()));

  const toggleArchive = () =>
    startTransition(async () => {
      await setPlanStatus(form({ status: archived ? "draft" : "archived" }));
      await requestSync();
    });

  const remove = () => {
    if (!window.confirm(`Permanently delete "${title}"? This can't be undone. Archive it instead to keep it.`)) return;
    startTransition(async () => {
      if (!(await deletePlan(form()))) {
        toast.error("The plan couldn't be deleted. Please try again.");
        return;
      }
      await requestSync();
      router.push("/plans");
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 gap-2" disabled={pending}>
          <Ellipsis className="size-4" aria-hidden />
          {pending ? "Working…" : "More"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {online ? (
          <>
            <DropdownMenuItem className="min-h-11" onSelect={duplicate}>
              <Copy aria-hidden />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={toggleArchive}>
              {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {archived ? "Restore" : "Archive"}
            </DropdownMenuItem>
          </>
        ) : null}
        {kept ? (
          <DropdownMenuItem className="min-h-11" onSelect={() => void unkeepPlan(planId)}>
            <X aria-hidden />
            Remove from device
          </DropdownMenuItem>
        ) : null}
        {online && isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={remove}>
              <Trash2 aria-hidden />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
