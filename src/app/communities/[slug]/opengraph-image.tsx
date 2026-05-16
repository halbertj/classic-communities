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
        photos:community_photos ( storage_path, display_order, created_at )
      `,
    )
    .eq("slug", slug)
    .maybeSingle();

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
  // Satori can resolve absolute URLs directly, but doing it ourselves
  // means we can (a) cleanly fall back to the bundled hero image if
  // the network fetch fails and (b) avoid a second egress hop from
  // the OG renderer to Supabase storage at request time.
  let bgDataUrl: string;
  try {
    if (!coverUrl) throw new Error("no cover");
    const res = await fetch(coverUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`cover fetch ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    bgDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
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

        {/* Vignette to keep edges from washing out the title. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundImage:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0.50) 100%)",
          }}
        />

        {/* Flat wash for consistent contrast across any cover photo. */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundColor: "rgba(0, 0, 0, 0.40)",
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
            alignItems: "center",
            justifyContent: "center",
            padding: "0 80px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
              marginBottom: 28,
            }}
          >
            Classic Communities
          </div>
          <div
            style={{
              display: "flex",
              fontSize: titleFontSize,
              fontWeight: 600,
              lineHeight: 1.05,
              color: "white",
              textAlign: "center",
              maxWidth: width - 200,
            }}
          >
            {displayName}
          </div>
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
