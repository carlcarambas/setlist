import Link from "next/link";
import { LogIn } from "lucide-react";
import { SignOutButton } from "@/components/offline/sign-out-button";
import { isAdmin, type Member } from "@/lib/auth/member";

export function MemberMenu({ member }: { member: Member }) {
  if (!isAdmin(member)) {
    return (
      <div className="border-t px-3 py-3">
        <p className="truncate px-3 text-sm font-medium">{member.display_name ?? "This device"}</p>
        <p className="px-3 text-xs text-muted-foreground">Member · no sign-in needed</p>
        <Link
          href="/sign-in"
          className="mt-2 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogIn className="size-4" aria-hidden />
          Administrator sign in
        </Link>
      </div>
    );
  }
  return (
    <div className="border-t px-3 py-3">
      <p className="truncate px-3 text-sm font-medium">{member.display_name}</p>
      <p className="truncate px-3 text-xs text-muted-foreground">{member.email}</p>
      <SignOutButton className="mt-2 w-full justify-start px-3" />
    </div>
  );
}
