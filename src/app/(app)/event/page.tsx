import type { Metadata } from "next";
import { EventView } from "@/components/pages/event-view";

export const metadata: Metadata = { title: "Event" };

export default function EventPage() {
  return <EventView />;
}
