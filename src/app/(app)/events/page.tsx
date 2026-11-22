import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Events" };

export default function Page() {
  return (
    <>
      <PageHeader title="Events" description="Services and gatherings, with the plans for each." />
      <EmptyState icon={CalendarDays} title="No events yet">
        Coming in Milestone 5.
      </EmptyState>
    </>
  );
}
