import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The per-community OG image route (`app/communities/[slug]/opengraph-image.tsx`)
  // reads the Cinzel woff out of `node_modules/@fontsource/...` and the
  // bundled `silver-creek.png` fallback at request time. Next's build
  // tracer can only statically detect string-literal `require`/`readFile`
  // arguments; ours are composed via `path.join(process.cwd(), ...)`, so
  // we have to opt those paths into the serverless function bundle by
  // hand. Without this, the deployed Lambda 500s on first request with
  // ENOENT for the woff file. The root-level `app/opengraph-image.tsx`
  // works without this because it's statically generated at build time.
  outputFileTracingIncludes: {
    "/communities/[slug]/opengraph-image": [
      "./node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff",
      "./public/silver-creek.png",
    ],
  },
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
