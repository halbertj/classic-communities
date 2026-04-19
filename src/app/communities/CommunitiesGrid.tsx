"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

export type CommunityCard = {
  id: string;
  name: string;
  slug: string;
  typeLabel: string | null;
  locationLabel: string | null;
  years: string | null;
  coverUrl: string | null;
  // Pre-lowercased haystack (name + city + state + type) so filtering is a
  // simple `indexOf` per row — no allocations while the user types.
  searchText: string;
};

export function CommunitiesGrid({ cards }: { cards: CommunityCard[] }) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => c.searchText.includes(q));
  }, [cards, query]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          >
            <circle
              cx="9"
              cy="9"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="m14 14 3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, city, or state…"
            aria-label="Search communities"
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {query && (
          <span className="text-xs text-muted tabular-nums">
            {visible.length} of {cards.length}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted">
          No communities match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <li key={c.id} className="h-full">
              <Link
                href={`/communities/${c.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:border-primary"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
                  {c.coverUrl ? (
                    <Image
                      src={c.coverUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
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
                    {c.typeLabel && <span>{c.typeLabel}</span>}
                    {c.locationLabel && (
                      <>
                        {c.typeLabel && <span>·</span>}
                        <span>{c.locationLabel}</span>
                      </>
                    )}
                    {c.years && (
                      <>
                        {(c.typeLabel || c.locationLabel) && <span>·</span>}
                        <span>{c.years}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
