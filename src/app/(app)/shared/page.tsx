import type { Metadata } from "next";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Shared with Me" };

export default function Page() {
  return (
    <>
      <PageHeader title="Shared with Me" description="Plans other members have shared with you." />
      <EmptyState icon={Users} title="Nothing shared with you yet">
        Coming in Milestone 4.
      </EmptyState>
    </>
  );
}
