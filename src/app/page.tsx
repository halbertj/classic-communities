import Image from "next/image";
import Link from "next/link";

import { AboutGallery } from "@/components/AboutGallery";
import { HomeMapSection } from "@/components/HomeMapSection";
import type { MapCommunity } from "@/components/CommunitiesMap";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Photos shown in the About section, in the exact order they should appear.
// To reorder, rearrange these entries. To add a photo, drop the file in
// `public/about/` and add a new entry here. `caption` is optional.
const ABOUT_PHOTOS: Array<{ src: string; alt: string; caption?: string }> = [
  {
    src: "/about/03-inside-the-framed-house.png",
    alt: "Dad and me inside the wood framing of a house under construction",
  },
  {
    src: "/about/01-on-the-lot.png",
    alt: "Dad holding me on a cleared lot, a new Classic home rising in the background",
  },
  {
    src: "/about/04-at-the-backhoe.png",
    alt: "Dad and me next to a Caterpillar 310 backhoe on a job site",
  },
  {
    src: "/about/02-framing-with-toy-roller.png",
    alt: "Dad working inside a framed house while I follow along with a toy paint roller",
  },
];

async function loadCommunities(): Promise<{
  mapped: MapCommunity[];
  total: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select(
      `
        id,
        name,
        slug,
        community_type,
        cover_photo_path,
        address:addresses ( city, state, latitude, longitude )
      `,
    )
    .order("name");

  if (error || !data) {
    return { mapped: [], total: 0 };
  }

  const mapped: MapCommunity[] = [];
  for (const c of data) {
    const addr = c.address;
    if (
      addr &&
      typeof addr.latitude === "number" &&
      typeof addr.longitude === "number"
    ) {
      // Bucket is public, so `getPublicUrl` is a pure string builder — no
      // network round-trip per community.
      const coverUrl = c.cover_photo_path
        ? supabase.storage
            .from("community-photos")
            .getPublicUrl(c.cover_photo_path).data.publicUrl
        : null;

      mapped.push({
        id: c.id,
        name: c.name,
        slug: c.slug,
        community_type: c.community_type,
        city: addr.city,
        state: addr.state,
        latitude: addr.latitude,
        longitude: addr.longitude,
        cover_photo_url: coverUrl,
      });
    }
  }

  return { mapped, total: data.length };
}

export default async function HomePage() {
  const { mapped, total } = await loadCommunities();

  return (
    <>
      <section className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden">
        {/* Background photograph */}
        <Image
          src="/silver-creek.png"
          alt="Aerial view of a Classic Communities neighborhood"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        {/* Minimal top-right nav, sits above the overlays */}
        <nav className="absolute right-6 top-6 z-20 flex items-center gap-6 text-xs uppercase tracking-[3px] text-white/90">
          <Link href="/communities" className="hover:text-white">
            Communities
          </Link>
          <Link href="/sign-in" className="hover:text-white">
            Sign in
          </Link>
        </nav>

        {/* Soft vignette so the white wordmark stays legible across the whole frame */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.18)_60%,rgba(0,0,0,0.35)_100%)]"
        />

        {/* Contrast overlay so the white text stays readable over bright areas of the photo */}
        <div aria-hidden className="absolute inset-0 bg-black/45" />

        {/* Hero content */}
        <div className="relative z-10 flex w-full max-w-[1100px] flex-col items-center px-6 text-center text-white">
          <p
            className="whitespace-nowrap font-serif text-[32px] font-semibold uppercase tracking-[4px] text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            The Legacy of
          </p>

          <div className="mt-6 w-full sm:mt-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logowhite.svg"
              alt="Classic Communities"
              width={776}
              height={88}
              className="mx-auto h-auto w-full max-w-[min(78vw,780px)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
            />
          </div>

          <p className="mt-10 max-w-[860px] text-balance text-[17px] font-normal leading-relaxed text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] sm:text-[19px]">
            A tribute to my grandma Virginia Halbert, my dad Jim, my uncle Doug, and the Classic Team who together built homes for thousands of families across Central Pennsylvania
          </p>

          <a
            href="#map"
            className="mt-14 text-[10px] uppercase tracking-[4px] text-white/80 hover:text-white"
          >
            Explore ↓
          </a>
        </div>
      </section>

      <HomeMapSection communities={mapped} totalCount={total} />

      <section
        id="about"
        className="border-t border-border bg-surface px-6 py-20 sm:py-28"
      >
        <div className="mx-auto w-full max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[4px] text-muted">
              About this project
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">
              In memory of my dad, Jim
            </h2>
            <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-foreground/85">
              <p>
                This project is made in memory of my dad, Jim Halbert, who
                passed away at 51 from cancer.
              </p>
              <p>
                I built it to celebrate the work he did and the impact he had —
                on the neighborhoods he helped shape, on the team he led, and
                on the thousands of families who call a Classic community home.
              </p>
            </div>
          </div>

          <AboutGallery photos={ABOUT_PHOTOS} />
        </div>
      </section>
    </>
  );
}
