import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // On Netlify, fall back to the project's main address (the built-in `URL` build variable)
    // so NEXT_PUBLIC_SITE_URL doesn't have to be set by hand. A value set explicitly wins.
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || process.env.URL,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
