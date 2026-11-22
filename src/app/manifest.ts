import type { MetadataRoute } from "next";

// Manifest only, no service worker (constitution Principle II, spec §19 P8).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Setlist",
    short_name: "Setlist",
    description: "Plan the music. Share the setlist. Serve together.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
