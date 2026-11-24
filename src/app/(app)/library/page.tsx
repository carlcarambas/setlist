import type { Metadata } from "next";
import { LibraryView } from "@/components/pages/library-view";

export const metadata: Metadata = { title: "Music Library" };

/** Static shell; the list comes from the device's database (works offline). */
export default function LibraryPage() {
  return <LibraryView />;
}
