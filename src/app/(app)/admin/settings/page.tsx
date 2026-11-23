import type { Metadata } from "next";
import { Suspense } from "react";
import { AppSettingsForm } from "@/components/admin/forms";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { getAppSettings } from "@/features/settings/queries";
import { requireAdmin } from "@/lib/auth/member";

export const metadata: Metadata = { title: "App Settings" };

export default function AppSettingsPage() {
  return (
    <>
      <PageHeader title="App Settings" description="Settings that apply to the whole ministry." />
      <Suspense fallback={<SectionSkeleton />}>
        <AppSettingsContent />
      </Suspense>
    </>
  );
}

async function AppSettingsContent() {
  await requireAdmin();
  const settings = await getAppSettings();
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(settings.timezone)) timezones.unshift(settings.timezone);

  return (
    <AppSettingsForm
      churchName={settings.church_name}
      timezone={settings.timezone}
      timezones={timezones}
    />
  );
}
