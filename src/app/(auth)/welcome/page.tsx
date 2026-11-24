import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { DeviceGate } from "@/components/auth/device-gate";

export const metadata: Metadata = { title: "Welcome" };

/** First visit on a device: becomes an anonymous member after a bot check. No sign-in. */
export default function WelcomePage() {
  return (
    <AuthCard title="Welcome to Setlist" description="Music plans for the ministry. No account needed.">
      <Suspense>
        <DeviceGate />
      </Suspense>
    </AuthCard>
  );
}
