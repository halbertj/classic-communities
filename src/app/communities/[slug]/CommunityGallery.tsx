"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

export type GalleryPhoto = {
  id: string;
  url: string;
  alt: string;
};

/**
 * Airbnb-style photo gallery.
 *
 * Layout
 *   - Mobile: a single hero image with a "1 / N" counter.
 *   - ≥sm with ≥5 photos: a 2-column grid — the first photo on the left at
 *            full height, and four smaller photos tiled 2×2 on the right.
 *   - ≥sm with <5 photos: a simpler 2-up split — hero on the left, one
 *            companion photo on the right at full height — so we never show
 *            awkward empty tiles.
 *
 * A "Show all photos" pill sits bottom-right over the grid. Clicking any photo
 * (or the pill) opens a full-screen lightbox with keyboard + click navigation.
 */
export function CommunityGallery({
  photos,
  communityName,
  logoUrl,
}: {
  photos: GalleryPhoto[];
  communityName: string;
  /**
   * Optional community logo. When present, it's rendered as a small chip
   * anchored to the top-left of the hero photo — a tasteful piece of
   * branding that reads clearly over any image.
   */
  logoUrl?: string | null;
}) {
  const total = photos.length;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openAt = useCallback((index: number) => setLightboxIndex(index), []);
  const close = useCallback(() => setLightboxIndex(null), []);

  // When there are fewer than 5 photos we collapse to a 2-up preview so the
  // grid never renders empty cells. Otherwise we show the full 5-tile layout.
  const useCompactLayout = total < 5;
  const tiles = useMemo(
    () => photos.slice(0, useCompactLayout ? 2 : 5),
    [photos, useCompactLayout],
  );

  if (total === 0) {
    return (
      <div className="flex h-[280px] w-full items-center justify-center rounded-2xl bg-surface text-sm text-muted sm:h-[420px]">
        No photos yet.
      </div>
    );
  }

  const logoOverlay = logoUrl ? (
    /* `pointer-events-none` so the chip doesn't block clicks into the
       underlying tile (which opens the lightbox). `rounded-xl` + white
       background + soft shadow = reads over any photo, light or dark. */
    <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center rounded-2xl bg-white/95 px-2.5 py-1.5 shadow-[0_4px_16px_rgba(15,23,42,0.22)] ring-1 ring-black/5 backdrop-blur sm:left-5 sm:top-5 sm:px-3 sm:py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={`${communityName} logo`}
        className="h-12 w-auto max-w-[200px] object-contain sm:h-14 sm:max-w-[260px]"
      />
    </div>
  ) : null;

  return (
    <>
      {/* ---------------- Mobile: single hero ---------------- */}
      <button
        type="button"
        onClick={() => openAt(0)}
        className="group relative block h-[320px] w-full overflow-hidden rounded-2xl bg-surface sm:hidden"
        aria-label={`Open ${communityName} photos`}
      >
        <Image
          src={tiles[0].url}
          alt={tiles[0].alt}
          fill
          sizes="100vw"
          priority
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        {logoOverlay}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
          1 / {total}
        </span>
      </button>

      {/* ---------------- Desktop: 2-up grid ---------------- */}
      <div className="relative hidden h-[420px] w-full overflow-hidden rounded-2xl sm:block md:h-[480px] lg:h-[520px]">
        {logoOverlay}
        {total === 1 ? (
          // Single photo: render it full-width with no grid at all.
          <GalleryTile
            photo={tiles[0]}
            className="h-full w-full"
            onClick={() => openAt(0)}
            sizes="(min-width: 1280px) 1200px, 100vw"
          />
        ) : useCompactLayout ? (
          // Compact preview for communities with 2–4 photos: a simple
          // 50/50 split, hero + one companion at full height.
          <div className="grid h-full w-full grid-cols-2 gap-2">
            <GalleryTile
              photo={tiles[0]}
              className="col-span-1"
              onClick={() => openAt(0)}
              sizes="(min-width: 1280px) 600px, 50vw"
            />
            <GalleryTile
              photo={tiles[1]}
              className="col-span-1"
              onClick={() => openAt(1)}
              sizes="(min-width: 1280px) 600px, 50vw"
            />
          </div>
        ) : (
          <div className="grid h-full w-full grid-cols-4 grid-rows-2 gap-2">
            {/* Big hero photo — left half, full height */}
            <GalleryTile
              photo={tiles[0]}
              className="col-span-2 row-span-2"
              onClick={() => openAt(0)}
              sizes="(min-width: 1280px) 600px, 50vw"
            />

            {/* Four smaller photos on the right (2×2). Individual tile
                corners stay square; the outer rounded container clips the
                four outside corners into a single rounded card. */}
            {[1, 2, 3, 4].map((i) => (
              <GalleryTile
                key={tiles[i].id}
                photo={tiles[i]}
                className="col-span-1 row-span-1"
                onClick={() => openAt(i)}
                sizes="(min-width: 1280px) 300px, 25vw"
              />
            ))}
          </div>
        )}

        {/* "Show all photos" pill — hidden when there's only one photo since
            there's nothing more to show. Always shown otherwise so the
            affordance for the lightbox is clear. */}
        {total > 1 && (
        <button
          type="button"
          onClick={() => openAt(0)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground shadow-[0_2px_8px_rgba(15,23,42,0.12)] transition hover:scale-[1.02] hover:shadow-[0_4px_14px_rgba(15,23,42,0.18)]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M1.5 2.5h5v5h-5zM9.5 2.5h5v5h-5zM1.5 8.5h5v5h-5zM9.5 8.5h5v5h-5z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          Show all {total} photos
        </button>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={close}
          communityName={communityName}
        />
      )}
    </>
  );
}

function GalleryTile({
  photo,
  className,
  onClick,
  sizes,
}: {
  photo: GalleryPhoto;
  className: string;
  onClick: () => void;
  /** Passed straight through to next/image so the optimizer can pick the
   *  right variant for this tile's share of the grid. */
  sizes: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block overflow-hidden bg-surface ${className}`}
      aria-label={`Open photo: ${photo.alt}`}
    >
      <Image
        src={photo.url}
        alt={photo.alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      />
      <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />
    </button>
  );
}

/**
 * Full-screen lightbox. Supports:
 *   - ESC to close
 *   - ← / → to navigate (wraps)
 *   - Click outside image to close
 *   - Thumbnail strip on larger screens
 */
function Lightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  communityName,
}: {
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  communityName: string;
}) {
  const total = photos.length;

  const prev = useCallback(
    () => onIndexChange((index - 1 + total) % total),
    [index, total, onIndexChange],
  );
  const next = useCallback(
    () => onIndexChange((index + 1) % total),
    [index, total, onIndexChange],
  );

  // Keyboard navigation.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  // Lock background scroll while the lightbox is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const current = photos[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${communityName} photo ${index + 1} of ${total}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 text-white">
        <span className="text-sm tabular-nums">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <path
              d="M5 5l12 12M17 5L5 17"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Main image area. Clicking the empty space (not the image itself)
          closes the lightbox — matching what most image viewers do. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="relative flex flex-1 items-center justify-center overflow-hidden px-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full cursor-default rounded-lg object-contain shadow-2xl"
        />

        {total > 1 && (
          <>
            <NavArrow
              direction="prev"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
            />
            <NavArrow
              direction="next"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
            />
          </>
        )}
      </button>

      {/* Thumbnail strip — hidden on very small viewports to keep the focus
          on the main photo. */}
      {total > 1 && (
        <div className="hidden border-t border-white/10 px-4 py-3 sm:block">
          {/* `overflow-x-auto` implicitly forces `overflow-y: auto`, which
              would clip the 2px selected-ring on the top/bottom edge of the
              active thumbnail. `py-1` reserves that breathing room. */}
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto py-1">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`Go to photo ${i + 1}`}
                aria-current={i === index}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-md transition ${
                  i === index
                    ? "ring-2 ring-white"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <Image
                  src={p.url}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NavArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: (e: React.MouseEvent) => void;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 -translate-y-1/2 ${
        isPrev ? "left-4" : "right-4"
      } inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-foreground shadow-lg transition hover:scale-105 hover:bg-white`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path
          d={isPrev ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </button>
  );
}
