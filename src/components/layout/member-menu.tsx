import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import type { Member } from "@/lib/auth/member";

export function MemberMenu({ member }: { member: Member }) {
  return (
    <div className="border-t px-3 py-3">
      <p className="truncate px-3 text-sm font-medium">{member.display_name}</p>
      <p className="truncate px-3 text-xs text-muted-foreground">{member.email}</p>
      <form action={signOut} className="mt-2">
        <Button type="submit" variant="ghost" className="h-11 w-full justify-start gap-3 px-3">
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </form>
    </div>
  );
}
