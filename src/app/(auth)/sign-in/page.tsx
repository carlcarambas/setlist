import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, FormSkeleton } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/auth-forms";
import { ClearOfflineData } from "@/components/offline/sign-out-button";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard title="Sign in" description="Members of the music ministry only.">
      <Suspense fallback={<FormSkeleton />}>
        <SignInForm />
      </Suspense>
      <ClearOfflineData />
    </AuthCard>
  );
}
