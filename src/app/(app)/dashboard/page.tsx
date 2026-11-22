import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <>
      <PageHeader title="Dashboard" description="Upcoming events, your recent plans and new music." />
      <EmptyState icon={LayoutDashboard} title="Nothing here yet">
        Coming in Milestone 5.
      </EmptyState>
    </>
  );
}
