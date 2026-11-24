import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, FormSkeleton } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/auth-forms";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard title="Administrator sign in" description="Members don't need to sign in.">
      <Suspense fallback={<FormSkeleton />}>
        <SignInForm />
      </Suspense>
      <p className="mt-4 text-center text-sm">
        <Link href="/dashboard" className="underline underline-offset-4">
          Back to Setlist
        </Link>
      </p>
    </AuthCard>
  );
}
