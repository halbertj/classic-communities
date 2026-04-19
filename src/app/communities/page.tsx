import type { MapCommunity } from "@/components/CommunitiesMap";
import { HomeMapSection } from "@/components/HomeMapSection";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import { CommunitiesGrid, type CommunityCard } from "./CommunitiesGrid";

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

export const metadata = {
  title: "Communities — Classic Communities",
};

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const supabase = await createClient();
  const { data: communities, error } = await supabase
    .from("communities")
    .select(
      `
        id,
        name,
        slug,
        community_type,
        date_started,
        date_completed,
        cover_photo_path,
        address:addresses ( city, state, latitude, longitude ),
        photos:community_photos ( storage_path, display_order, created_at )
      `,
    )
    // Archived (soft-deleted) communities never appear on the public site.
    .eq("archived", false)
    .order("name");

  // `community-photos` is a public bucket, so `getPublicUrl` is a pure
  // string builder — no network round-trip per community.
  const coverUrlFor = (path: string | null): string | null =>
    path
      ? supabase.storage.from("community-photos").getPublicUrl(path).data
          .publicUrl
      : null;

  // Ordered gallery URLs. The first photo is the community's cover — it
  // powers the card thumbnail and leads the map popup — so we don't
  // include a separate `cover_photo_path` entry. Legacy cover-only
  // communities (no gallery rows) fall back to the column value.
  const orderedPhotoUrlsFor = (c: {
    cover_photo_path: string | null;
    photos: Array<{
      storage_path: string;
      display_order: number;
      created_at: string;
    }> | null;
  }): string[] => {
    const ordered = [...(c.photos ?? [])].sort((a, b) => {
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      return a.created_at.localeCompare(b.created_at);
    });
    const urls = ordered
      .map((p) => coverUrlFor(p.storage_path))
      .filter((u): u is string => u !== null);
    if (urls.length === 0) {
      const legacy = coverUrlFor(c.cover_photo_path);
      if (legacy) urls.push(legacy);
    }
    return urls;
  };

  // Only surface communities with at least one photo. A community without
  // any imagery would render as an empty card / photo-less map popup, so
  // we exclude them from the public listing entirely.
  const communitiesWithCover = (communities ?? []).filter(
    (c) => orderedPhotoUrlsFor(c).length > 0,
  );

  // Flatten into display-ready card props so the (client) search grid
  // doesn't need to know anything about Supabase shapes or storage URLs.
  const cards: CommunityCard[] = communitiesWithCover.map((c) => {
    const yearStart = formatYear(c.date_started);
    const yearEnd = formatYear(c.date_completed);
    const years =
      yearStart && yearEnd
        ? yearStart === yearEnd
          ? yearStart
          : `${yearStart}–${yearEnd}`
        : (yearStart ?? yearEnd ?? null);

    const typeLabel = c.community_type ? TYPE_LABEL[c.community_type] : null;
    const locationLabel = c.address
      ? `${c.address.city}, ${c.address.state}`
      : null;

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      typeLabel,
      locationLabel,
      years,
      coverUrl: orderedPhotoUrlsFor(c)[0] ?? null,
      searchText: [c.name, locationLabel ?? "", typeLabel ?? ""]
        .join(" ")
        .toLowerCase(),
    };
  });

  // Build the subset of communities that have coordinates so the map can
  // plot them. Same shape as on the home page.
  const mappedCommunities: MapCommunity[] = communitiesWithCover
    .filter(
      (c) =>
        c.address &&
        typeof c.address.latitude === "number" &&
        typeof c.address.longitude === "number",
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      community_type: c.community_type,
      city: c.address!.city,
      state: c.address!.state,
      latitude: c.address!.latitude as number,
      longitude: c.address!.longitude as number,
      photo_urls: orderedPhotoUrlsFor(c),
    }));

  return (
    <>
      <SiteHeader logo />
      <main className="flex-1 bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 pt-16">
          <header>
            <p className="text-xs uppercase tracking-[4px] text-muted">
              Portfolio
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
              Communities
            </h1>
            <p className="mt-3 max-w-2xl text-muted">
              A portfolio of Classic Communities developments.
            </p>
          </header>
        </div>

        {mappedCommunities.length > 0 && (
          <HomeMapSection
            communities={mappedCommunities}
            totalCount={mappedCommunities.length}
            showHeading={false}
            showCta={false}
            className="py-12"
            maxWidthClass="max-w-5xl px-6"
            mapHeightClass="h-[360px]"
          />
        )}

        <div className="mx-auto w-full max-w-5xl px-6 pb-16">
          {error ? (
            <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Couldn&apos;t load communities: {error.message}
            </p>
          ) : cards.length === 0 ? (
            <p className="text-muted">
              No communities to show yet. Check back soon.
            </p>
          ) : (
            <CommunitiesGrid cards={cards} />
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
