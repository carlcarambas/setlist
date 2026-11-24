import type { Metadata } from "next";
import { SongView } from "@/components/pages/song-view";

export const metadata: Metadata = { title: "Music details" };

export default function SongPage() {
  return <SongView />;
}
