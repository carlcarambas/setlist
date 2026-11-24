import type { Metadata } from "next";
import { SheetView } from "@/components/pages/sheet-view";

export const metadata: Metadata = { title: "Sheet" };

export default function SheetPage() {
  return <SheetView />;
}
