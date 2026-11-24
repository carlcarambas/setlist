import { SignOutButton } from "@/components/offline/sign-out-button";
import type { Member } from "@/lib/auth/member";

export function MemberMenu({ member }: { member: Member }) {
  return (
    <div className="border-t px-3 py-3">
      <p className="truncate px-3 text-sm font-medium">{member.display_name}</p>
      <p className="truncate px-3 text-xs text-muted-foreground">{member.email}</p>
      <SignOutButton className="mt-2 w-full justify-start px-3" />
    </div>
  );
}
