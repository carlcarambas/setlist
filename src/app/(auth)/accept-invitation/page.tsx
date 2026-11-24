import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard, FormSkeleton } from "@/components/auth/auth-card";
import { AcceptInvitationForm } from "@/components/auth/auth-forms";
import { getCurrentMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Join the ministry" };

async function Invitation() {
  // Reached from an invitation email via /auth/confirm, which signs the user in.
  const member = await getCurrentMember();
  if (!member) redirect("/sign-in?error=link");
  if (member.status === "active") redirect("/dashboard");
  if (member.status === "inactive") redirect("/auth/sign-out?reason=inactive");
  return <AcceptInvitationForm email={member.email ?? ""} defaultName={member.display_name ?? ""} />;
}

export default function AcceptInvitationPage() {
  return (
    <AuthCard title="Become an administrator" description="Set your name and a password to finish joining.">
      <Suspense fallback={<FormSkeleton />}>
        <Invitation />
      </Suspense>
    </AuthCard>
  );
}
