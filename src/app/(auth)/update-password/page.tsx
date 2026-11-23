import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard, FormSkeleton } from "@/components/auth/auth-card";
import { UpdatePasswordForm } from "@/components/auth/auth-forms";
import { getCurrentMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Choose a new password" };

async function RequireSession() {
  // Reached from a password-reset email via /auth/confirm, which signs the user in.
  if (!(await getCurrentMember())) redirect("/sign-in?error=link");
  return <UpdatePasswordForm />;
}

export default function UpdatePasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <Suspense fallback={<FormSkeleton />}>
        <RequireSession />
      </Suspense>
    </AuthCard>
  );
}
