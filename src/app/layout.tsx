import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// metadataBase lets Next resolve relative OG/Twitter image URLs to an
// absolute origin for social-share unfurls. Must never throw: `new URL()`
// rejects empty strings, host-only values without a scheme, etc., and
// that would 500 every route during metadata evaluation.
function metadataBaseUrl(): URL {
  const trimHost = (v: string) => v.trim().replace(/^https?:\/\//i, "");

  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    const withScheme = /^https?:\/\//i.test(explicit)
      ? explicit
      : /^(localhost|127\.)/i.test(explicit)
        ? `http://${explicit}`
        : `https://${explicit}`;
    try {
      return new URL(withScheme);
    } catch {
      /* fall through */
    }
  }

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) {
    try {
      return new URL(`https://${trimHost(prod)}`);
    } catch {
      /* fall through */
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    try {
      return new URL(`https://${trimHost(vercel)}`);
    } catch {
      /* fall through */
    }
  }

  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: "Classic Communities",
  description: "The legacy of Classic Communities.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
