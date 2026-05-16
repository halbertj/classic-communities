import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { createClient } from "@/lib/supabase/server";

// Per-community Open Graph image for link unfurls (iMessage, Slack,
// Twitter, etc.). Mirrors the on-page hero: the community's first
// cover photo as a full-bleed background, dimmed with a soft vignette
// + flat black wash, with the community name overlaid in white Cinzel
// (matching the on-page hero title).
//
// The "cover" is whichever photo sits first in the gallery (same rule
// as the home page / admin table), falling back to the legacy
// `cover_photo_path` column for communities with no gallery rows. We
// rely on the file-based `opengraph-image` convention so Next emits
// the matching <meta> tags for us, and on the existing
// `revalidatePath(\`/communities/${slug}\`)` calls in the photo /
// community server actions to invalidate this image whenever the
// cover changes.
//
// Satori implementation notes (same caveats as the root OG image):
//   - Every <div> with children needs `display: flex`.
//   - Use explicit top/left/right/bottom: 0 instead of `inset`.
//   - `textShadow` is unsupported; we lean on the overlays for legibility.

export const runtime = "nodejs";

export const alt = "Classic Communities";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

const CINZEL_WOFF_PATH = path.join(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "cinzel",
  "files",
  "cinzel-latin-600-normal.woff",
);

const FALLBACK_BG_PATH = path.join(process.cwd(), "public", "silver-creek.png");

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function CommunityOpenGraphImage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  // Pull the community plus its gallery photos in one round-trip. We
  // sort the gallery the same way the public page does so the OG
  // image always tracks whatever appears first on the detail page.
  const { data: community } = await supabase
    .from("communities")
    .select(
      `
        name,
        archived,
        cover_photo_path,
        address:addresses ( city, state ),
        photos:community_photos ( storage_path, display_order, created_at )
      `,
    )
    .eq("slug", slug)
    .maybeSingle();

  const locationLine = [community?.address?.city, community?.address?.state]
    .filter(Boolean)
    .join(", ");

  const orderedPhotos = [...(community?.photos ?? [])].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  const coverPath =
    orderedPhotos[0]?.storage_path ?? community?.cover_photo_path ?? null;

  const coverUrl = coverPath
    ? supabase.storage.from("community-photos").getPublicUrl(coverPath).data
        .publicUrl
    : null;

  // Fetch the cover bytes server-side and inline them as a data URL.
  // Satori / @vercel/og can only decode PNG and JPEG inline — anything
  // else (WebP, AVIF, HEIC, etc.) crashes Satori with an obscure
  // "is not iterable" error. We use Sharp to transcode non-PNG/JPEG
  // sources to JPEG before inlining, and fall back to the bundled
  // hero image if anything else goes wrong.
  let bgDataUrl: string;
  try {
    if (!coverUrl) throw new Error("no cover");
    const res = await fetch(coverUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`cover fetch ${res.status}`);
    const mime = (
      res.headers.get("content-type") ?? "image/jpeg"
    ).toLowerCase();
    const raw = Buffer.from(await res.arrayBuffer());

    let buf: Buffer;
    let outMime: string;
    if (mime.startsWith("image/png") || mime.startsWith("image/jpeg")) {
      buf = raw;
      outMime = mime.startsWith("image/png") ? "image/png" : "image/jpeg";
    } else {
      // Dynamic import so the cost is only paid for non-native formats.
      const sharp = (await import("sharp")).default;
      buf = await sharp(raw)
        // Match the OG canvas so we never re-encode more pixels than we need.
        .resize({ width: 1200, height: 630, fit: "cover" })
        .jpeg({ quality: 86 })
        .toBuffer();
      outMime = "image/jpeg";
    }
    bgDataUrl = `data:${outMime};base64,${buf.toString("base64")}`;
  } catch {
    const bgPng = await readFile(FALLBACK_BG_PATH);
    bgDataUrl = `data:image/png;base64,${bgPng.toString("base64")}`;
  }

  const cinzelFont = await readFile(CINZEL_WOFF_PATH);

  const { width, height } = size;
  const displayName = community?.name ?? "Classic Communities";

  // Soft, length-aware title sizing. Long community names would
  // otherwise wrap into a wall of text or get clipped against the
  // 80px side gutters.
  const titleFontSize =
    displayName.length > 28 ? 88 : displayName.length > 18 ? 108 : 132;

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

        {/* Soft vignette so edges don't wash out the title. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.20) 70%, rgba(0,0,0,0.45) 100%)",
          }}
        />

        {/* Light flat wash for consistent contrast across any cover. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundColor: "rgba(0, 0, 0, 0.22)",
          }}
        />

        {/* Strong bottom gradient that anchors the title — keeps the
            community name legible over any cover photo without
            darkening the whole image. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundImage:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.10) 60%, rgba(0,0,0,0.00) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            padding: "0 80px 72px 80px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.92)",
              marginBottom: 22,
            }}
          >
            Classic Communities
          </div>
          <div
            style={{
              display: "flex",
              fontSize: titleFontSize,
              fontWeight: 600,
              lineHeight: 1.02,
              color: "white",
              maxWidth: width - 160,
            }}
          >
            {displayName}
          </div>
          {locationLine ? (
            <div
              style={{
                display: "flex",
                marginTop: 20,
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {locationLine}
            </div>
          ) : null}
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
