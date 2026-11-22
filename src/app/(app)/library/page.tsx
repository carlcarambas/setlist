import type { Metadata } from "next";
import { Library } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Music Library" };

export default function Page() {
  return (
    <>
      <PageHeader title="Music Library" description="Search, preview and download the ministry's sheet music." />
      <EmptyState icon={Library} title="No music yet">
        Coming in Milestone 2.
      </EmptyState>
    </>
  );
}
