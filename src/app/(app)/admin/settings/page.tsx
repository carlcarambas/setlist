import type { Metadata } from "next";
import { Suspense } from "react";
import { AppSettingsForm } from "@/components/admin/forms";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanupStaleUploads } from "@/features/library/actions";
import { countStaleUploads } from "@/features/library/queries";
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

  const staleUploads = await countStaleUploads();

  return (
    <div className="grid gap-6">
      <AppSettingsForm
        churchName={settings.church_name}
        timezone={settings.timezone}
        timezones={timezones}
      />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Unfinished uploads</h2>
          </CardTitle>
          <CardDescription>
            Uploads that were started more than a day ago but never completed (for example, the
            browser was closed mid-upload). Removing them frees storage space.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <p className="text-sm">
            {staleUploads === 0 ? "Nothing to clean up." : `${staleUploads} unfinished ${staleUploads === 1 ? "upload" : "uploads"}.`}
          </p>
          {staleUploads > 0 ? (
            <form action={cleanupStaleUploads}>
              <Button type="submit" variant="outline" className="h-11">
                Remove unfinished uploads
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
