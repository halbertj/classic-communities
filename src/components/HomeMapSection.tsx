"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import type { MapCommunity } from "./CommunitiesMap";

// Leaflet touches `window` at import time, so we can only load it on the client.
const CommunitiesMap = dynamic(() => import("./CommunitiesMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-surface text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function HomeMapSection({
  communities,
  showHeading = true,
  showCta = true,
  className,
  maxWidthClass = "max-w-6xl",
  // Shorter on phones so the landing map doesn’t dominate the viewport;
  // scale up from `sm` and match the original 560px from large screens.
  mapHeightClass = "h-[360px] sm:h-[480px] lg:h-[560px]",
}: {
  communities: MapCommunity[];
  totalCount: number;
  showHeading?: boolean;
  showCta?: boolean;
  className?: string;
  maxWidthClass?: string;
  mapHeightClass?: string;
}) {
  return (
    <section
      id="map"
      className={
        className ??
        "border-t border-border bg-background px-6 py-16 sm:py-24"
      }
    >
      <div className={`mx-auto w-full ${maxWidthClass}`}>
        {showHeading && (
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[4px] text-muted">
              Where we&apos;ve built
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">
              Every Classic Community
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted">
              Decades of building, one community at a time
            </p>
          </div>
        )}

        <div
          className={`relative isolate overflow-hidden rounded-2xl bg-surface shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-black/5 ${mapHeightClass}`}
        >
          <CommunitiesMap communities={communities} />
        </div>

        {showCta && (
          <div className="mt-10 flex justify-center">
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
        )}
      </div>
    </section>
  );
}
