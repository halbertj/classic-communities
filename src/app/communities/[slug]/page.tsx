import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import type { MapCommunity } from "@/components/CommunitiesMap";

import { CommunityGallery, type GalleryPhoto } from "./CommunityGallery";
import { CommunityMapPanel } from "./CommunityMapPanel";

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
        cover_photo_path,
        site_plan_path,
        logo_path,
        date_started,
        date_completed,
        num_homes,
        address:addresses ( city, state, line1, line2, postal_code, latitude, longitude ),
        photos:community_photos (
          id,
          storage_path,
          alt_text,
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
      <main className="flex-1 bg-background px-6 py-16">
        <div className="mx-auto w-full max-w-5xl">
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Couldn&apos;t load community: {error.message}
          </p>
        </div>
      </main>
    );
  }

  if (!community) {
    notFound();
  }

  // Build an ordered gallery. We prefer the admin-curated order on
  // `community_photos`, and only fall back to the single `cover_photo_path`
  // if the community has no photos attached yet.
  const orderedPhotos = [...(community.photos ?? [])].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  const galleryPhotos: GalleryPhoto[] = orderedPhotos.map((p) => ({
    id: p.id,
    url: supabase.storage
      .from("community-photos")
      .getPublicUrl(p.storage_path).data.publicUrl,
    alt: p.alt_text ?? p.caption ?? community.name,
  }));

  if (galleryPhotos.length === 0 && community.cover_photo_path) {
    galleryPhotos.push({
      id: "cover",
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
          cover_photo_url: community.cover_photo_path
            ? supabase.storage
                .from("community-photos")
                .getPublicUrl(community.cover_photo_path).data.publicUrl
            : null,
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

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10 sm:pt-14">
        {/* Breadcrumb / back link */}
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

        {/* Gallery */}
        <CommunityGallery
          photos={galleryPhotos}
          communityName={community.name}
          logoUrl={logoUrl}
        />

        {/* Overview / description */}
        <section className="mt-10">
          <p className="text-xs uppercase tracking-[4px] text-muted">
            Classic community
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">
            {community.name}
          </h1>

          {/* Facts row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {typeLabel && <span>{typeLabel}</span>}
            {typeLabel && locationLine && <span aria-hidden>·</span>}
            {locationLine && <span>{locationLine}</span>}
            {(typeLabel || locationLine) && years && (
              <span aria-hidden>·</span>
            )}
            {years && <span>Built {years}</span>}
            {typeof community.num_homes === "number" && (
              <>
                {(typeLabel || locationLine || years) && (
                  <span aria-hidden>·</span>
                )}
                <span>
                  {community.num_homes}{" "}
                  {community.num_homes === 1 ? "home" : "homes"}
                </span>
              </>
            )}
          </div>

          <div className="mt-8 h-px w-full bg-border" />

          {/* Description */}
          <div className="mt-8 max-w-2xl space-y-4 text-[15px] leading-relaxed text-foreground/90">
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              About this community
            </h2>
            <p>
              {community.name} is
              {typeLabel
                ? ` a ${typeLabel.toLowerCase()} community`
                : " a community"}
              {locationLine ? ` in ${locationLine}` : ""}
              {years ? `, built ${years}` : ""}. Designed and developed by
              Classic Communities, it carries the same craft, siting, and
              neighborhood-first planning that defines the Classic portfolio.
            </p>
            <p className="text-muted">
              A longer write-up — the story of the land, the floor plans
              offered here, and the families who&apos;ve called it home — will
              live here soon.
            </p>
          </div>
        </section>

        {/* Location */}
        {mapCommunity && (
          <section className="mt-16 border-t border-border pt-12">
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

        {sitePlanUrl && (
          <section className="mt-16 border-t border-border pt-12">
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
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <iframe
                  src={sitePlanUrl}
                  title={`${community.name} site plan`}
                  className="h-[520px] w-full sm:h-[680px]"
                />
              </div>
            ) : (
              <a
                href={sitePlanUrl}
                className="group block overflow-hidden rounded-xl border border-border bg-surface"
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

        {/* Homes in this community — placeholder for now */}
        <section className="mt-16 border-t border-border pt-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[4px] text-muted">
                Coming soon
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">
                Homes in {community.name}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted">
                Individual homes and floor plans will appear here once
                they&apos;re added.
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 text-sm text-muted"
                aria-hidden
              >
                Home listing
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
