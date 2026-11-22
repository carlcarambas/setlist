import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <>
      <PageHeader title="Settings" description="Your profile and preferences." />
      <EmptyState icon={Settings} title="Settings aren't available yet">
        Coming in Milestone 1.
      </EmptyState>
    </>
  );
}
