import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

// The OG image mirrors the home-page hero: the Silver Creek aerial photo
// under a radial vignette + flat black overlay, with "THE LEGACY OF" in
// Cinzel above the Classic Communities white wordmark. Anything shared
// on social (iMessage, Slack, Twitter, LinkedIn, etc.) links back to
// this composition instead of a generic Vercel preview.
//
// Implementation notes for @vercel/og (Satori):
//   - Every <div> that has children must declare `display: flex` — Satori
//     errors otherwise, and missing styles silently drop whole subtrees.
//   - `inset: 0` is not reliable across Satori versions; use explicit
//     top/left/right/bottom: 0.
//   - SVG <img> elements need explicit pixel width/height (both attribute
//     and style work, but style is what actually lays them out).
//   - `textShadow` is not supported; we fake legibility with the overlays.

export const runtime = "nodejs";

export const alt =
  "The Legacy of Classic Communities — a tribute to the family who built thousands of homes across Central Pennsylvania.";

// 1200x630 is the size every major platform (Facebook, Twitter, LinkedIn,
// iMessage link previews, Slack unfurls) resamples from, so we author
// at exactly that to avoid compression artifacts.
export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

// Cinzel 600 ships as a WOFF in @fontsource/cinzel. We read it straight
// from node_modules so the OG route is fully deterministic (no Google
// Fonts round-trip, no woff2 — Satori accepts TTF/OTF/WOFF but not WOFF2).
const CINZEL_WOFF_PATH = path.join(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "cinzel",
  "files",
  "cinzel-latin-600-normal.woff",
);

export default async function OpenGraphImage() {
  const [bgPng, logoSvg, cinzelFont] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "silver-creek.png")),
    readFile(path.join(process.cwd(), "public", "logowhite.svg")),
    readFile(CINZEL_WOFF_PATH),
  ]);

  const bgDataUrl = `data:image/png;base64,${bgPng.toString("base64")}`;
  const logoDataUrl = `data:image/svg+xml;base64,${logoSvg.toString("base64")}`;

  const { width, height } = size;

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          position: "relative",
          fontFamily: "Cinzel",
          color: "white",
        }}
      >
        {/* Background photograph — same asset as the hero. */}
        <img
          src={bgDataUrl}
          alt=""
          width={width}
          height={height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            objectFit: "cover",
          }}
        />

        {/* Soft radial vignette so the white wordmark stays legible across
            the whole frame. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0.35) 100%)",
          }}
        />

        {/* Flat contrast overlay, matching the hero's /45 black wash. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
          }}
        />

        {/* Centered content stack. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 80px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 54,
              fontWeight: 600,
              letterSpacing: 10,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.95)",
            }}
          >
            The Legacy of
          </div>
          <img
            src={logoDataUrl}
            alt=""
            width={960}
            height={109}
            style={{
              width: 960,
              height: 109,
              marginTop: 48,
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Cinzel",
          data: cinzelFont,
          style: "normal",
          weight: 600,
        },
      ],
    },
  );
}
