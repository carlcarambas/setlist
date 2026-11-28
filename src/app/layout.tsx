import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/offline/service-worker";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Setlist",
    template: "%s · Setlist",
  },
  description: "Plan the music. Share the setlist. Serve together.",
  applicationName: "Setlist",
  // Reachable by anyone with the address, but not meant to be found (spec v2 §10).
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "Setlist",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
