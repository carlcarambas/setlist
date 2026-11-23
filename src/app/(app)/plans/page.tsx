import type { Metadata } from "next";
import { ListMusic } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "My Plans" };

export default function Page() {
  return (
    <>
      <PageHeader title="My Plans" description="Setlists you own." />
      <EmptyState icon={ListMusic} title="No plans yet">
        Coming in Milestone 3.
      </EmptyState>
    </>
  );
}
