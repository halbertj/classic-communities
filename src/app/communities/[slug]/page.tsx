import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactDOM from "react-dom";

import type { MapCommunity } from "@/components/CommunitiesMap";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import {
  CommunityGallery,
  CommunityMediaShowcase,
  type GalleryItem,
} from "./CommunityGallery";
import { CommunityMapPanel } from "./CommunityMapPanel";
import {
  CommunityPageTabs,
  type CommunityPageTab,
} from "./CommunityPageTabs";

type CommunityType = Database["public"]["Enums"]["community_type"];

const TYPE_LABEL: Record<CommunityType, string> = {
  single_family: "Single family",
  townhome: "Townhome",
  mixed: "Mixed",
};

function formatYear(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 4);
}

// Next 15 passes `params` as a Promise. This helper resolves it once.
type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("communities")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();

  return {
    title: data?.name
      ? `${data.name} — Classic Communities`
      : "Community — Classic Communities",
  };
}

export default async function CommunityDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: community, error } = await supabase
    .from("communities")
    .select(
      `
        id,
        name,
        slug,
        community_type,
        archived,
        cover_photo_path,
        site_plan_path,
        logo_path,
        date_started,
        date_completed,
        num_homes,
        description,
        address:addresses ( city, state, line1, line2, postal_code, latitude, longitude ),
        photos:community_photos (
          id,
          storage_path,
          alt_text,
          caption,
          display_order,
          created_at
        ),
        videos:community_videos (
          id,
          storage_path,
          poster_path,
          caption,
          display_order,
          created_at
        )
      `,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return (
      <>
        <SiteHeader logo />
        <main className="flex-1 bg-background px-6 py-16">
          <div className="mx-auto w-full max-w-5xl">
            <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Couldn&apos;t load community: {error.message}
            </p>
          </div>
        </main>

        <SiteFooter />
      </>
    );
  }

  // Archived communities are hidden from the public site. We 404 here
  // rather than show a "gone" page so bookmarked URLs are indistinguishable
  // from genuinely missing slugs.
  if (!community || community.archived) {
    notFound();
  }

  // Build an ordered gallery. Within each media kind we honor the
  // admin-curated `display_order`. In the combined list, *videos come
  // first* so a community that has uploaded video uses it as the hero
  // (the gallery component switches to a single-video hero + thumbnail
  // strip when items[0] is a video). Photos follow in their own order.
  //
  // We fall back to the single `cover_photo_path` only if the community
  // has neither a photo gallery nor any videos.
  const orderedVideos = [...(community.videos ?? [])].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.created_at.localeCompare(b.created_at);
  });
  const orderedPhotos = [...(community.photos ?? [])].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  const videoItems: GalleryItem[] = orderedVideos.map((v) => ({
    id: `v-${v.id}`,
    kind: "video",
    url: supabase.storage
      .from("community-videos")
      .getPublicUrl(v.storage_path).data.publicUrl,
    alt: v.caption ?? community.name,
    posterUrl: v.poster_path
      ? supabase.storage
          .from("community-photos")
          .getPublicUrl(v.poster_path).data.publicUrl
      : null,
  }));

  const photoItems: GalleryItem[] = orderedPhotos.map((p) => ({
    id: `p-${p.id}`,
    kind: "photo",
    url: supabase.storage
      .from("community-photos")
      .getPublicUrl(p.storage_path).data.publicUrl,
    alt: p.alt_text ?? p.caption ?? community.name,
  }));

  const galleryItems: GalleryItem[] = [...videoItems, ...photoItems];

  if (galleryItems.length === 0 && community.cover_photo_path) {
    galleryItems.push({
      id: "cover",
      kind: "photo",
      url: supabase.storage
        .from("community-photos")
        .getPublicUrl(community.cover_photo_path).data.publicUrl,
      alt: community.name,
    });
  }

  const yearStart = formatYear(community.date_started);
  const yearEnd = formatYear(community.date_completed);
  const years =
    yearStart && yearEnd
      ? yearStart === yearEnd
        ? yearStart
        : `${yearStart}–${yearEnd}`
      : (yearStart ?? yearEnd ?? null);

  const typeLabel = community.community_type
    ? TYPE_LABEL[community.community_type]
    : null;

  const locationLine = community.address
    ? `${community.address.city}, ${community.address.state}`
    : null;

  // Only show the map if the address has real coordinates. Everything else
  // the popup needs (cover, type, city/state) comes straight off the record
  // we already loaded.
  const addr = community.address;
  const mapCommunity: MapCommunity | null =
    addr &&
    typeof addr.latitude === "number" &&
    typeof addr.longitude === "number"
      ? {
          id: community.id,
          name: community.name,
          slug: community.slug,
          community_type: community.community_type,
          city: addr.city,
          state: addr.state,
          latitude: addr.latitude,
          longitude: addr.longitude,
          // Detail-page map uses the compact "city" popup (no imagery),
          // but we still populate photo_urls so the same component shape
          // holds for any future variant change. Only photo items are
          // sent here — the map popup variants don't know how to render
          // videos, and the field name predates the mixed gallery.
          photo_urls: photoItems.map((p) => p.url),
        }
      : null;

  const sitePlanUrl = community.site_plan_path
    ? supabase.storage
        .from("community-site-plans")
        .getPublicUrl(community.site_plan_path).data.publicUrl
    : null;
  const logoUrl = community.logo_path
    ? supabase.storage
        .from("community-logos")
        .getPublicUrl(community.logo_path).data.publicUrl
    : null;
  const sitePlanIsPdf =
    community.site_plan_path?.toLowerCase().endsWith(".pdf") ?? false;

  // Prioritize the above-the-fold hero assets. We emit high-priority
  // preload hints (hoisted into <head> by Next/React) for the logo chip
  // and — when the hero is a video — the video file and its poster, so
  // the browser fetches them ahead of the lazy-loaded gallery photos
  // further down the page. The logo and hero video are the first things
  // a visitor sees, so they should win the initial bandwidth race.
  const heroItem = galleryItems[0] ?? null;
  if (logoUrl) {
    ReactDOM.preload(logoUrl, { as: "image", fetchPriority: "high" });
  }
  if (heroItem?.kind === "video") {
    ReactDOM.preload(heroItem.url, { as: "video", fetchPriority: "high" });
    if (heroItem.posterUrl) {
      ReactDOM.preload(heroItem.posterUrl, {
        as: "image",
        fetchPriority: "high",
      });
    }
  }

  // Individual homes aren't modeled in the DB yet. Keeping this as an
  // explicit empty list (instead of omitting the section) means the layout
  // below lights up automatically the moment we start populating homes.
  const homes: { id: string; name: string }[] = [];

  // The gallery now always renders a full-bleed hero band (video or
  // photo), so the breadcrumb would visually compete with it and the
  // container's top padding would push it down off the header. The site
  // header still provides "back to communities" via its nav. We treat
  // "has any media at all" as the trigger so communities with no media
  // (rare, but possible) keep the legacy breadcrumb + top padding.
  const hasHero = galleryItems.length > 0;

  // Title to overlay on the hero (centered, white serif). Sub-line is
  // the same fact triplet that lives in the section below; we keep it
  // succinct (no `num_homes`) so it reads as a single line on most
  // viewport widths.
  const heroSubline =
    [typeLabel, locationLine, years ? `Built ${years}` : null]
      .filter((p): p is string => !!p)
      .join(" · ") || null;
  const heroTitle =
    galleryItems.length > 0
      ? { title: community.name, subtitle: heroSubline }
      : null;

  // In-page section tabs. We only surface a tab when its underlying
  // section will actually render, so a community without a site plan or
  // mappable address simply gets a shorter tab bar.
  const tabs: CommunityPageTab[] = [
    { id: "about", label: "About" },
    ...(galleryItems.length > 1
      ? [{ id: "gallery", label: "Gallery" } as CommunityPageTab]
      : []),
    ...(sitePlanUrl
      ? [{ id: "site-plan", label: "Site plan" } as CommunityPageTab]
      : []),
    ...(mapCommunity
      ? [{ id: "map", label: "Map" } as CommunityPageTab]
      : []),
  ];

  return (
    <>
      <SiteHeader logo />
      <main className="flex-1 bg-background">
        {/* When the gallery has any media, drop the container's top
            padding so the full-bleed hero sits flush under the site
            header. Communities with no media at all keep the original
            breathing room above the body content. */}
        <div
          className={`mx-auto w-full max-w-6xl px-6 pb-24 ${
            hasHero ? "pt-0" : "pt-10 sm:pt-14"
          }`}
        >
        {/* Breadcrumb / back link.
            Suppressed whenever the gallery shows a full-bleed hero —
            see `hasHero` above. */}
        {!hasHero && (
          <nav className="mb-6 text-sm">
            <Link
              href="/communities"
              className="inline-flex items-center gap-1.5 text-muted transition hover:text-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                <path
                  d="M10 3L5 8l5 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              All communities
            </Link>
          </nav>
        )}

        {/* Gallery */}
        <CommunityGallery
          items={galleryItems}
          communityName={community.name}
          logoUrl={logoUrl}
          heroTitle={heroTitle}
        />

        {/* Sticky in-page tabs that scroll to each section below.
            Rendered only when at least one section anchor is present
            (which is essentially always, since "About" is unconditional). */}
        {tabs.length > 0 && <CommunityPageTabs tabs={tabs} />}

        {/* Overview / description.
            When the hero already displays the community name + subline,
            we drop the duplicate <h1> + eyebrow below and let the facts
            row stand on its own. This keeps a single, canonical headline
            on the page. */}
        <section id="about" className="scroll-mt-32 mt-10">
          {!heroTitle && (
            <>
              <p className="text-xs uppercase tracking-[4px] text-muted">
                Classic community
              </p>
              <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">
                {community.name}
              </h1>
            </>
          )}

          {/* Two-column layout: a wider "About" column on the left and a
              narrower "Stats" column on the right that surfaces the same
              facts the hero subtitle previously summarized. Stacks under
              About on mobile so nothing gets squeezed. */}
          <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-3">
            {/* Description.
                Prefer the admin-authored `description` when it's been
                filled in. We render with `whitespace-pre-line` so
                paragraph breaks from the textarea survive without pulling
                in a markdown parser. If no description is set yet, we
                fall back to the auto-generated one-liner. */}
            <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90 md:col-span-2">
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                About this community
              </h2>
              {community.description ? (
                <p className="whitespace-pre-line">{community.description}</p>
              ) : (
                <p>
                  {community.name} is
                  {typeLabel
                    ? ` a ${typeLabel.toLowerCase()} community`
                    : " a community"}
                  {locationLine ? ` in ${locationLine}` : ""}
                  {years ? `, built ${years}` : ""}. Designed and developed
                  by Classic Communities, it carries the same craft, care,
                  and neighborhood-first planning that defines the Classic
                  portfolio.
                </p>
              )}
            </div>

            {/* Stats column. Each row is a label/value pair so the data
                scans cleanly even with a narrow column. We only render
                rows that have a value, so a partially-filled community
                still looks intentional. */}
            <aside className="md:col-span-1">
              <dl className="divide-y divide-border border-y border-border text-sm">
                {typeLabel && (
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">Type</dt>
                    <dd className="font-medium text-foreground">{typeLabel}</dd>
                  </div>
                )}
                {locationLine && (
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">Location</dt>
                    <dd className="font-medium text-foreground">
                      {locationLine}
                    </dd>
                  </div>
                )}
                {years && (
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">Built</dt>
                    <dd className="font-medium text-foreground">{years}</dd>
                  </div>
                )}
                {typeof community.num_homes === "number" && (
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">Homes</dt>
                    <dd className="font-medium text-foreground">
                      {community.num_homes}
                    </dd>
                  </div>
                )}
              </dl>
            </aside>
          </div>
        </section>

        {/* Cinematic split showcase.
            Renders only when there's media beyond the hero. A large
            feature tile sits to the left with three medium tiles
            stacked beside it; anything else flows into a contact-sheet
            filmstrip below. Clicking any tile opens the same lightbox
            the gallery uses.
            We exclude index 0 *only* when the hero is a single video —
            that item isn't shown anywhere else on the page. For
            photo-led communities the hero now cycles through every
            photo via the Ken Burns slideshow, so duplicating none of
            them in the showcase below means the first photo would
            never get its own static tile; we include it here. */}
        {galleryItems.length > 1 && (
          <section id="gallery" className="scroll-mt-32 mt-12">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[4px] text-muted">
                Gallery
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground">
                More from {community.name}
              </h2>
            </div>
            <CommunityMediaShowcase
              items={galleryItems}
              communityName={community.name}
              excludeIndex={galleryItems[0].kind === "video" ? 0 : undefined}
            />
          </section>
        )}

        {sitePlanUrl && (
          <section
            id="site-plan"
            className="scroll-mt-32 mt-16 border-t border-border pt-12"
          >
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[4px] text-muted">
                  Layout
                </p>
                <h2 className="mt-2 font-serif text-3xl font-semibold">
                  Site plan
                </h2>
              </div>
              <a
                href={sitePlanUrl}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
              >
                Open full
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 11 11"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3 8l5-5M8 3H4m4 0v4"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>

            {sitePlanIsPdf ? (
              <div className="overflow-hidden rounded-xl bg-white">
                <iframe
                  src={sitePlanUrl}
                  title={`${community.name} site plan`}
                  className="h-[520px] w-full sm:h-[680px]"
                />
              </div>
            ) : (
              <a
                href={sitePlanUrl}
                className="group block overflow-hidden rounded-xl bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sitePlanUrl}
                  alt={`${community.name} site plan`}
                  className="h-full max-h-[720px] w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                />
              </a>
            )}
          </section>
        )}

        {/* Location */}
        {mapCommunity && (
          <section
            id="map"
            className="scroll-mt-32 mt-16 border-t border-border pt-12"
          >
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[4px] text-muted">
                Location
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">
                {locationLine ?? "On the map"}
              </h2>
            </div>
            <CommunityMapPanel community={mapCommunity} />
          </section>
        )}

        {/*
          Homes in this community. There's no homes table yet, so `homes`
          is always empty and this section is hidden. Once homes are wired
          up, this guard will flip on automatically as soon as any exist.
        */}
        {/* Quiet tribute at the bottom of every community page to the
            people who built Classic Communities. */}
        <section className="mt-20 border-t border-border pt-12 text-center">
          <p className="text-xs uppercase tracking-[4px] text-muted">
            In gratitude
          </p>
          <p className="mx-auto mt-4 max-w-2xl font-serif text-lg italic leading-relaxed text-foreground/80 sm:text-xl">
            Dedicated to Jim, Virginia, Doug, and the Classic team, whose care
            and craft made these neighborhoods home
          </p>
          <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-2xl border border-border bg-surface/40 shadow-sm">
            <Image
              src="/story/founders-portrait.png"
              alt="Jim, Virginia, and Doug standing in front of a Classic Communities home"
              width={970}
              height={580}
              className="h-auto w-full"
              sizes="(max-width: 768px) 100vw, 28rem"
            />
          </div>
          <div className="mt-6 flex justify-center">
            <Link
              href="/story"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground/80 transition hover:border-foreground/40 hover:text-foreground"
            >
              Read their story
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        {homes.length > 0 && (
          <section className="mt-16 border-t border-border pt-12">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[4px] text-muted">
                  Available
                </p>
                <h2 className="mt-2 font-serif text-3xl font-semibold">
                  Homes in {community.name}
                </h2>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {homes.map((home) => (
                <div
                  key={home.id}
                  className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 text-sm text-muted"
                  aria-hidden
                >
                  {home.name}
                </div>
              ))}
            </div>
          </section>
        )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
