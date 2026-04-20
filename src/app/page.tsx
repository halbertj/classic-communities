import Image from "next/image";
import Link from "next/link";

import { AboutGallery } from "@/components/AboutGallery";
import { HomeMapSection } from "@/components/HomeMapSection";
import type { MapCommunity } from "@/components/CommunitiesMap";
import { SiteFooter } from "@/components/SiteFooter";
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

type FeaturedCommunity = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  cover_photo_url: string | null;
};

async function loadCommunities(): Promise<{
  mapped: MapCommunity[];
  featured: FeaturedCommunity[];
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
        starred,
        address:addresses ( city, state, latitude, longitude ),
        photos:community_photos ( storage_path, display_order, created_at )
      `,
    )
    // Archived (soft-deleted) communities never appear on the public site.
    .eq("archived", false)
    .order("name");

  if (error || !data) {
    return { mapped: [], featured: [], total: 0 };
  }

  const publicUrl = (path: string) =>
    supabase.storage.from("community-photos").getPublicUrl(path).data.publicUrl;

  const mapped: MapCommunity[] = [];
  const featured: FeaturedCommunity[] = [];
  for (const c of data) {
    const addr = c.address;
    // Bucket is public, so `getPublicUrl` is a pure string builder — no
    // network round-trip per community.

    // The cover is whichever photo sits first in the gallery. We fall
    // back to the legacy `cover_photo_path` column only for communities
    // that haven't uploaded a gallery yet, which keeps a single source
    // of truth and — critically — prevents the map popup from showing
    // the same image twice.
    const orderedPhotos = [...(c.photos ?? [])].sort((a, b) => {
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      return a.created_at.localeCompare(b.created_at);
    });
    const photoUrls: string[] = orderedPhotos.map((p) =>
      publicUrl(p.storage_path),
    );
    const coverUrl =
      photoUrls[0] ??
      (c.cover_photo_path ? publicUrl(c.cover_photo_path) : null);
    if (photoUrls.length === 0 && coverUrl) {
      photoUrls.push(coverUrl);
    }

    if (
      addr &&
      typeof addr.latitude === "number" &&
      typeof addr.longitude === "number"
    ) {
      mapped.push({
        id: c.id,
        name: c.name,
        slug: c.slug,
        community_type: c.community_type,
        city: addr.city,
        state: addr.state,
        latitude: addr.latitude,
        longitude: addr.longitude,
        photo_urls: photoUrls,
      });
    }

    if (c.starred) {
      featured.push({
        id: c.id,
        name: c.name,
        slug: c.slug,
        city: addr?.city ?? null,
        state: addr?.state ?? null,
        cover_photo_url: coverUrl,
      });
    }
  }

  return { mapped, featured, total: data.length };
}

export default async function HomePage() {
  const { mapped, featured, total } = await loadCommunities();

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

        {/* Minimal top-right nav, sits above the overlays. Kept inline
            (rather than reusing <SiteHeader />) so the hero can stay
            logo-free on the left and let the centered wordmark carry
            the composition. */}
        <nav className="absolute right-6 top-6 z-20 flex items-center gap-6 text-xs uppercase tracking-[3px] text-white/90">
          <Link href="/communities" className="hover:text-white">
            Communities
          </Link>
          <Link
            href="/story"
            className="hidden hover:text-white sm:inline"
          >
            Story
          </Link>
          <Link
            href="/#about"
            className="hidden hover:text-white sm:inline"
          >
            About
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
            className="whitespace-nowrap font-serif text-[22px] font-semibold uppercase tracking-[3px] text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] sm:text-[32px] sm:tracking-[4px]"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            The Legacy of
          </p>

          <div className="mt-4 w-full sm:mt-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logowhite.svg"
              alt="Classic Communities"
              width={776}
              height={88}
              className="mx-auto h-auto w-full max-w-[min(92vw,780px)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:max-w-[min(78vw,780px)]"
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

      <HomeMapSection
        communities={mapped}
        totalCount={total}
        showCta={featured.length === 0}
      />

      {featured.length > 0 && (
        <section className="border-t border-border bg-background px-6 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[4px] text-muted">
                Featured
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">
                Community spotlight
              </h2>
              <p className="mt-3 max-w-xl text-sm text-muted">
                The best of Classic Communities
              </p>
            </div>

            <ul
              className={`grid gap-6 ${
                featured.length === 1
                  ? "grid-cols-1 sm:mx-auto sm:max-w-2xl"
                  : featured.length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {featured.map((c) => (
                <li key={c.id} className="h-full">
                  <Link
                    href={`/communities/${c.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_40px_-20px_rgba(15,23,42,0.25)] ring-1 ring-black/5 transition hover:border-primary hover:shadow-[0_18px_60px_-20px_rgba(15,23,42,0.35)]"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
                      {c.cover_photo_url ? (
                        <Image
                          src={c.cover_photo_url}
                          alt=""
                          fill
                          // Max container is max-w-6xl (≈1152px). At lg we
                          // show up to 3 columns (~380px each), 2 columns at
                          // sm, 1 column below.
                          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[3px] text-muted">
                          No photo
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-serif text-xl font-semibold group-hover:text-primary">
                        {c.name}
                      </h3>
                      {(c.city || c.state) && (
                        <p className="mt-1 text-sm text-muted">
                          {[c.city, c.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-12 flex justify-center">
              <Link
                href="/communities"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                See All Communities
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      <section
        id="story"
        className="border-t border-border bg-background px-6 py-16 sm:py-24"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/5">
            <Image
              src="/story/founders.png"
              alt="Doug Halbert, Virginia Halbert, and Jim Halbert in front of a Classic home"
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[4px] text-muted">
              The story
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">
              A family-built legacy
            </h2>
            <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-foreground/85">
              <p>
                Classic Communities began as a family company — founded by
                Virginia Halbert and carried forward by her sons Jim and Doug,
                who grew it into one of Central Pennsylvania&apos;s most
                trusted home builders.
              </p>
              <p>
                Over the decades, the team helped shape dozens of
                neighborhoods and welcomed thousands of families into homes
                they&apos;re still proud of today.
              </p>
            </div>
            <Link
              href="/story"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Read the story
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      <section
        id="about"
        className="border-t border-border bg-surface px-6 py-20 sm:py-28"
      >
        <div className="mx-auto w-full max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
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
              <p>
                He left behind a legacy of kindness, quiet generosity, and a
                deep love for his family. I&apos;m inspired every day by his
                vision and his entrepreneurship.
              </p>
            </div>
            <p className="mt-8 font-serif text-lg italic text-foreground/80">
              — Jacob Halbert
            </p>
          </div>

          <AboutGallery photos={ABOUT_PHOTOS} />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
