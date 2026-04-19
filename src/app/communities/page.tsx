import Link from "next/link";

import type { MapCommunity } from "@/components/CommunitiesMap";
import { HomeMapSection } from "@/components/HomeMapSection";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

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
        address:addresses ( city, state, latitude, longitude )
      `,
    )
    .order("name");

  // `community-photos` is a public bucket, so `getPublicUrl` is a pure
  // string builder — no network round-trip per community.
  const coverUrlFor = (path: string | null): string | null =>
    path
      ? supabase.storage.from("community-photos").getPublicUrl(path).data
          .publicUrl
      : null;

  // Build the subset of communities that have coordinates so the map can
  // plot them. Same shape as on the home page.
  const mappedCommunities: MapCommunity[] = (communities ?? [])
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
      cover_photo_url: coverUrlFor(c.cover_photo_path),
    }));

  return (
    <>
      <SiteHeader logo />
      <main className="flex-1 bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 pt-16">
          <header>
            <p className="text-xs uppercase tracking-[4px] text-muted">
              Our work
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
          ) : !communities || communities.length === 0 ? (
            <p className="text-muted">
              No communities to show yet. Check back soon.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {communities.map((c) => {
                const yearStart = formatYear(c.date_started);
                const yearEnd = formatYear(c.date_completed);
                const years =
                  yearStart && yearEnd
                    ? yearStart === yearEnd
                      ? yearStart
                      : `${yearStart}–${yearEnd}`
                    : (yearStart ?? yearEnd ?? null);

                const coverUrl = coverUrlFor(c.cover_photo_path);

                return (
                  <li key={c.id} className="h-full">
                    <Link
                      href={`/communities/${c.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:border-primary"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
                        {coverUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={coverUrl}
                            alt=""
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[3px] text-muted">
                            No photo
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <h2 className="text-lg font-semibold group-hover:text-primary">
                          {c.name}
                        </h2>
                        <div className="mt-1 flex flex-wrap gap-x-2 text-sm text-muted">
                          {c.community_type && (
                            <span>{TYPE_LABEL[c.community_type]}</span>
                          )}
                          {c.address && (
                            <>
                              {c.community_type && <span>·</span>}
                              <span>
                                {c.address.city}, {c.address.state}
                              </span>
                            </>
                          )}
                          {years && (
                            <>
                              {(c.community_type || c.address) && (
                                <span>·</span>
                              )}
                              <span>{years}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
