"use client";

import { useFormStatus } from "react-dom";
import { Archive, ArchiveRestore, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { duplicatePlan, setPlanStatus } from "@/features/plans/actions";

function Submit({ children, label }: { children: React.ReactNode; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="h-11 gap-2" disabled={pending}>
      {children}
      {pending ? "Working…" : label}
    </Button>
  );
}

export function DuplicatePlanButton({ planId }: { planId: string }) {
  return (
    <form action={duplicatePlan}>
      <input type="hidden" name="planId" value={planId} />
      <Submit label="Duplicate">
        <Copy className="size-4" aria-hidden />
      </Submit>
    </form>
  );
}

export function ArchivePlanButton({ planId, archived }: { planId: string; archived: boolean }) {
  return (
    <form action={setPlanStatus}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="status" value={archived ? "draft" : "archived"} />
      <Submit label={archived ? "Restore" : "Archive"}>
        {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
      </Submit>
    </form>
  );
}
