"use client";

import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Archive, ArchiveRestore, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deletePlan, duplicatePlan, setPlanStatus } from "@/features/plans/actions";
import { requestSync } from "@/features/sync/engine";

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
    <form
      action={async (formData) => {
        await setPlanStatus(formData);
        await requestSync();
      }}
    >
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="status" value={archived ? "draft" : "archived"} />
      <Submit label={archived ? "Restore" : "Archive"}>
        {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
      </Submit>
    </form>
  );
}

/** Administrators only. Asks first: the plan, its songs and its event links are removed for good. */
export function DeletePlanButton({ planId, title }: { planId: string; title: string }) {
  const router = useRouter();
  return (
    <form
      action={async (formData) => {
        if (await deletePlan(formData)) {
          await requestSync();
          router.push("/plans");
        }
      }}
      onSubmit={(e) => {
        if (!window.confirm(`Permanently delete "${title}"? This can't be undone. Archive it instead to keep it.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="planId" value={planId} />
      <Submit label="Delete">
        <Trash2 className="size-4" aria-hidden />
      </Submit>
    </form>
  );
}
