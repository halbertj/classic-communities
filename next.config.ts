import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    // Allow next/image to optimize photos served from Supabase Storage's
    // public `render/image/public/...` endpoint. Scoped to `*.supabase.co`
    // so project migrations keep working without further config.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
