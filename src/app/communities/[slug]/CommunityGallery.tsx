"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * A single media item in the gallery. Photos and videos share the same
 * index space so the lightbox can navigate across them with arrow keys.
 *
 * `posterUrl` is only meaningful for videos and is optional — when absent,
 * thumbnails fall back to a dark tile with a play glyph. (Native <video>
 * elements will produce a frame poster on their own once metadata loads;
 * we don't try to capture/serve that here.)
 */
export type GalleryItem = {
  id: string;
  kind: "photo" | "video";
  url: string;
  alt: string;
  posterUrl?: string | null;
};

/**
 * Back-compat alias. Older callers used `GalleryPhoto` when the gallery
 * only knew about photos. New callers should use `GalleryItem`.
 */
export type GalleryPhoto = GalleryItem;

/**
 * Optional title-overlay rendered centered on the hero. When provided,
 * the hero gets a dark vignette gradient and the title (+ optional
 * sub-line) is laid over it in white serif type.
 */
export type HeroTitle = {
  title: string;
  /** Short factual sub-line, e.g. "Single family · Wenatchee, WA · Built 2014". */
  subtitle?: string | null;
};

/**
 * Mixed-media gallery (photos + videos).
 *
 * Layout rules:
 *   - If the first item is a video → the hero is a single full-width video
 *     player and a horizontal thumbnail strip of all remaining items sits
 *     below it. Videos and stills don't compose cleanly in a tiled hero,
 *     so we keep the hero focused.
 *   - If the first item is a photo → the original Airbnb-style layout
 *     applies (mobile hero on small screens; ≥sm renders either a 2-up
 *     split for 2–4 items or a 1-big + 2×2 grid for ≥5 items). Video items
 *     among the tiles get a play-icon overlay so they're still discoverable.
 *
 * Clicking any tile/thumbnail opens a full-screen lightbox that plays
 * videos inline and uses arrow keys / click navigation across the full
 * mixed list.
 */
export function CommunityGallery({
  items,
  communityName,
  logoUrl,
  heroTitle,
}: {
  items: GalleryItem[];
  communityName: string;
  /**
   * Optional community logo. When present, it's rendered as a small chip
   * anchored to the top-left of the hero — a tasteful piece of branding
   * that reads clearly over any image or video frame.
   */
  logoUrl?: string | null;
  /**
   * Optional title to overlay on the hero. When set, the hero gets a
   * dark gradient + centered serif name (and an optional sub-line). The
   * caller should drop their own page-level <h1> in that case to avoid
   * duplicate headings.
   */
  heroTitle?: HeroTitle | null;
}) {
  const total = items.length;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openAt = useCallback((index: number) => setLightboxIndex(index), []);
  const close = useCallback(() => setLightboxIndex(null), []);

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
    <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center rounded-2xl bg-[#FFFFFF] px-2.5 py-1.5 shadow-[0_4px_16px_rgba(15,23,42,0.22)] ring-1 ring-black/5 sm:left-5 sm:top-5 sm:px-3 sm:py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={`${communityName} logo`}
        className="h-12 w-auto max-w-[200px] object-contain sm:h-14 sm:max-w-[260px]"
      />
    </div>
  ) : null;

  // Dark vignette + centered serif title. `pointer-events-none` on the
  // wrapper so the underlying click overlay / video / tile remains
  // interactive. Used by both hero variants when `heroTitle` is set so
  // photo and video heroes look visually consistent.
  const titleOverlay = heroTitle ? (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
      {/* Gradient: darkest at top and bottom (where it meets the page
          background / header), gentler in the middle so the image/video
          still reads behind the type. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.4)_0%,rgba(0,0,0,0.15)_38%,rgba(0,0,0,0.15)_62%,rgba(0,0,0,0.4)_100%)]"
      />
      <div className="relative z-10 max-w-3xl">
        <h1 className="font-serif text-4xl font-semibold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-5xl md:text-6xl">
          {heroTitle.title}
        </h1>
        {heroTitle.subtitle && (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[4px] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:mt-4 sm:text-sm">
            {heroTitle.subtitle}
          </p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Unified hero: full-bleed band rendering either the first video
          (autoplaying loop) or the first photo. Both look and behave
          identically apart from the media element itself, so photo-only
          communities feel like a still version of the video communities
          rather than a different page shape. */}
      <MediaHeroLayout
        items={items}
        openAt={openAt}
        communityName={communityName}
        logoOverlay={logoOverlay}
        titleOverlay={titleOverlay}
      />

      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={close}
          communityName={communityName}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// MediaHeroLayout
//
// Full-bleed hero band used for *every* community detail page, whether
// the first item is a video or a photo. The only difference between the
// two cases is the media element itself (`<video>` vs `<img>`) — sizing,
// overlays, title, click-to-open behavior and the "Show all" pill are
// identical. This is what makes photo-only communities feel "the same,
// minus the autoplay" as video-led communities.
// ---------------------------------------------------------------------------

function MediaHeroLayout({
  items,
  openAt,
  communityName,
  logoOverlay,
  titleOverlay,
}: {
  items: GalleryItem[];
  openAt: (i: number) => void;
  communityName: string;
  logoOverlay: React.ReactNode;
  titleOverlay: React.ReactNode;
}) {
  const hero = items[0];
  const isVideo = hero.kind === "video";

  return (
    <div
      className="relative left-[calc(50%-50vw)] w-screen overflow-hidden bg-black"
      style={{ maxWidth: "100vw" }}
    >
      {logoOverlay}
      {/* Clickable overlay so the whole hero opens the lightbox.
          z-10 above the media; the title overlay sits at z-10 too but
          with pointer-events-none so clicks fall through here. */}
      <button
        type="button"
        onClick={() => openAt(0)}
        aria-label={`Open ${communityName} gallery`}
        className="absolute inset-0 z-10"
      />
      {isVideo ? (
        <video
          src={hero.url}
          poster={hero.posterUrl ?? undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate nofullscreen"
          aria-label={`${communityName} video`}
          className="h-[70vh] w-full bg-black object-cover"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={hero.url}
          alt={hero.alt}
          // Same height / object treatment as the video so the two
          // variants compose interchangeably on the page.
          className="h-[70vh] w-full bg-black object-cover"
        />
      )}
      {titleOverlay}
    </div>
  );
}

function ThumbnailButton({
  item,
  onClick,
}: {
  item: GalleryItem;
  onClick: () => void;
}) {
  const isVideo = item.kind === "video";
  // For videos: prefer an admin-supplied poster, otherwise show the dark
  // tile + play glyph (the underlying <video> element would also produce
  // a frame poster, but rendering a real <video> per thumbnail is heavy).
  const thumbUrl = isVideo ? (item.posterUrl ?? null) : item.url;
  const labelPrefix = isVideo ? "Play video" : "Open photo";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${labelPrefix}: ${item.alt}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-md bg-surface ring-1 ring-black/5 transition hover:ring-black/15"
    >
      {thumbUrl ? (
        <Image
          src={thumbUrl}
          alt=""
          fill
          sizes="(min-width: 640px) 200px, 140px"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
      )}

      {isVideo && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/25"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 2l7 4-7 4V2z" fill="currentColor" />
            </svg>
          </span>
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Photo-grid layout (used when there are no videos, or the first item is a
// photo — preserves the original Airbnb-style hero exactly).
// ---------------------------------------------------------------------------

function PhotoGridLayout({
  tiles,
  total,
  useCompactLayout,
  openAt,
  communityName,
  logoOverlay,
  titleOverlay,
}: {
  tiles: GalleryItem[];
  total: number;
  useCompactLayout: boolean;
  openAt: (i: number) => void;
  communityName: string;
  logoOverlay: React.ReactNode;
  titleOverlay: React.ReactNode;
}) {
  return (
    <>
      {/* ---------------- Mobile: single hero ---------------- */}
      <button
        type="button"
        onClick={() => openAt(0)}
        className="group relative block h-[320px] w-full overflow-hidden rounded-2xl bg-surface sm:hidden"
        aria-label={`Open ${communityName} photos`}
      >
        {tiles[0].kind === "video" ? (
          // Rare path: a video managed to land at index 0 inside the photo
          // layout (would only happen if the parent passed mixed items but
          // the very first was a photo? — kept defensive). Show poster with
          // play glyph.
          <VideoTileBackdrop item={tiles[0]} />
        ) : (
          <Image
            src={tiles[0].url}
            alt={tiles[0].alt}
            fill
            sizes="100vw"
            priority
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        {titleOverlay}
        {logoOverlay}
        <span className="absolute bottom-3 right-3 z-20 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
          1 / {total}
        </span>
      </button>

      {/* ---------------- Desktop: 2-up grid ---------------- */}
      <div className="relative hidden h-[420px] w-full overflow-hidden rounded-2xl sm:block md:h-[480px] lg:h-[520px]">
        {logoOverlay}
        {titleOverlay}
        {total === 1 ? (
          <GalleryTile
            item={tiles[0]}
            className="h-full w-full"
            onClick={() => openAt(0)}
            sizes="(min-width: 1280px) 1200px, 100vw"
          />
        ) : useCompactLayout ? (
          <div className="grid h-full w-full grid-cols-2 gap-2">
            <GalleryTile
              item={tiles[0]}
              className="col-span-1"
              onClick={() => openAt(0)}
              sizes="(min-width: 1280px) 600px, 50vw"
            />
            <GalleryTile
              item={tiles[1]}
              className="col-span-1"
              onClick={() => openAt(1)}
              sizes="(min-width: 1280px) 600px, 50vw"
            />
          </div>
        ) : (
          <div className="grid h-full w-full grid-cols-4 grid-rows-2 gap-2">
            <GalleryTile
              item={tiles[0]}
              className="col-span-2 row-span-2"
              onClick={() => openAt(0)}
              sizes="(min-width: 1280px) 600px, 50vw"
            />

            {[1, 2, 3, 4].map((i) => (
              <GalleryTile
                key={tiles[i].id}
                item={tiles[i]}
                className="col-span-1 row-span-1"
                onClick={() => openAt(i)}
                sizes="(min-width: 1280px) 300px, 25vw"
              />
            ))}
          </div>
        )}

      </div>
    </>
  );
}

function VideoTileBackdrop({ item }: { item: GalleryItem }) {
  if (item.posterUrl) {
    return (
      <Image
        src={item.posterUrl}
        alt={item.alt}
        fill
        sizes="100vw"
        className="object-cover"
      />
    );
  }
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
  );
}

function GalleryTile({
  item,
  className,
  onClick,
  sizes,
}: {
  item: GalleryItem;
  className: string;
  onClick: () => void;
  /** Passed straight through to next/image so the optimizer can pick the
   *  right variant for this tile's share of the grid. */
  sizes: string;
}) {
  const isVideo = item.kind === "video";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block overflow-hidden bg-surface ${className}`}
      aria-label={isVideo ? `Play video: ${item.alt}` : `Open photo: ${item.alt}`}
    >
      {isVideo ? (
        <VideoTileBackdrop item={item} />
      ) : (
        <Image
          src={item.url}
          alt={item.alt}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />
      {isVideo && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md">
            <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 2l7 4-7 4V2z" fill="currentColor" />
            </svg>
          </span>
        </span>
      )}
    </button>
  );
}

/**
 * Full-screen lightbox. Supports:
 *   - ESC to close
 *   - ← / → to navigate (wraps)
 *   - Click outside media to close
 *   - Thumbnail strip on larger screens (videos get a play glyph)
 *   - Photos render as <img>; videos render as <video controls autoPlay>.
 */
function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
  communityName,
}: {
  items: GalleryItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  communityName: string;
}) {
  const total = items.length;

  const prev = useCallback(
    () => onIndexChange((index - 1 + total) % total),
    [index, total, onIndexChange],
  );
  const next = useCallback(
    () => onIndexChange((index + 1) % total),
    [index, total, onIndexChange],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const current = items[index];
  const isVideo = current.kind === "video";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${communityName} ${isVideo ? "video" : "photo"} ${
        index + 1
      } of ${total}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
    >
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

      {/* Backdrop area: clicking the empty space around the media closes
          the lightbox. Rendered as a div (with a stopPropagation media
          child) so the nested prev/next buttons don't trigger React's
          "button inside button" hydration error. Keyboard users still
          have Esc + the explicit Close button in the header. */}
      <div
        onClick={onClose}
        aria-hidden
        className="relative flex flex-1 items-center justify-center overflow-hidden px-4"
      >
        {isVideo ? (
          <video
            // `key` forces React to mount a fresh <video> when we change
            // index, otherwise the previous source keeps playing while the
            // new src loads.
            key={current.id}
            src={current.url}
            poster={current.posterUrl ?? undefined}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full cursor-default rounded-lg bg-black shadow-2xl"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={current.url}
            alt={current.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full cursor-default rounded-lg object-contain shadow-2xl"
          />
        )}

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
      </div>

      {total > 1 && (
        <div className="hidden border-t border-white/10 px-4 py-3 sm:block">
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-1 py-1">
            {items.map((it, i) => {
              const tIsVideo = it.kind === "video";
              const tUrl = tIsVideo ? it.posterUrl : it.url;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={`Go to ${tIsVideo ? "video" : "photo"} ${i + 1}`}
                  aria-current={i === index}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-md transition ${
                    i === index
                      ? "ring-2 ring-white"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  {tUrl ? (
                    <Image src={tUrl} alt="" fill sizes="96px" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
                  )}
                  {tIsVideo && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-foreground">
                        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                          <path d="M3 2l7 4-7 4V2z" fill="currentColor" />
                        </svg>
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
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
      aria-label={isPrev ? "Previous" : "Next"}
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

// ---------------------------------------------------------------------------
// CommunityMediaStrip
//
// A horizontally-scrollable "peek" preview of the community's media that's
// rendered lower on the page (e.g. under the description). Reuses the same
// lightbox component as `CommunityGallery`, so tapping any tile opens the
// full-screen viewer with the original indices intact — videos play with
// controls, arrow keys navigate across the full mixed list.
//
// Responsive tile count is achieved with `flex-basis: calc(100% / N - gap)`
// where N is the *desired visible count* (so 2.5 → `100%/2.5`). The
// container clips the overflow; `scroll-snap` aligns each tile so the row
// feels intentional rather than mid-scroll.
//
// `excludeIndex` lets the caller omit whatever's already serving as the
// hero — typically `0`. The clicked tile's *original* index is preserved
// when opening the lightbox so the modal opens on the right item.
// ---------------------------------------------------------------------------

export function CommunityMediaStrip({
  items,
  communityName,
  excludeIndex,
}: {
  items: GalleryItem[];
  communityName: string;
  /** Index in `items` to omit from the preview row (typically the hero). */
  excludeIndex?: number;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  // Tracks whether the strip has more content to the right than is
  // currently visible. We use this to gate the fade gradient so it
  // doesn't sit on top of the last tile when everything already fits.
  const [showRightFade, setShowRightFade] = useState(false);

  const visible = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ index }) => index !== excludeIndex),
    [items, excludeIndex],
  );

  // Recompute "is there more to scroll to" on mount, on resize, and on
  // every scroll. A 1px slack covers sub-pixel layout rounding.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
      setShowRightFade(remaining > 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [visible.length]);

  if (visible.length === 0) return null;

  return (
    <>
      {/* `-mx-6` widens the strip into the page's gutters so the first /
          last tile can sit visually flush with the column edge while
          still allowing tiles to peek beyond it. `px-6` then puts the
          scroll padding back so snap-aligned tiles align to the column
          edge, not the bleed edge.

          The right-edge fade is rendered as a child of the scroll
          container (positioned with `sticky`) rather than as a sibling
          overlay so it always tracks the actual visible edge, and we
          only show it when there's content still hidden to the right. */}
      <div className="relative -mx-6">
        <ul
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2"
          style={{ scrollPaddingLeft: "1.5rem", scrollPaddingRight: "1.5rem" }}
        >
          {visible.map(({ item, index }) => (
            <li
              key={item.id}
              // Responsive "peek" sizing using arbitrary Tailwind utilities.
              // The fraction is `100% / N` where N is the desired number of
              // visible tiles, minus the share of the gutter that each
              // tile "owes" in the row. For a 12px (0.75rem) gap:
              //   2.5 tiles → 100/2.5  - (0.75 * 1.5/2.5)  = 40% - 0.45rem
              //   3.5 tiles → 100/3.5  - (0.75 * 2.5/3.5)  ≈ 28.57% - 0.54rem
              //   4.5 tiles → 100/4.5  - (0.75 * 3.5/4.5)  ≈ 22.22% - 0.58rem
              className="shrink-0 snap-start basis-[calc(40%-0.45rem)] sm:basis-[calc(28.57%-0.54rem)] md:basis-[calc(22.22%-0.58rem)]"
            >
              <ThumbnailButton
                item={item}
                onClick={() => setLightboxIndex(index)}
              />
            </li>
          ))}
        </ul>

        {showRightFade && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent"
          />
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          communityName={communityName}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CommunityMediaShowcase
//
// A "cinematic split" gallery preview meant to live below the description.
// Layout:
//
//   ┌─────────────────────────┬──────────────┐
//   │                         │   tile B     │
//   │        FEATURE (A)      ├──────────────┤
//   │                         │   tile C     │
//   │                         ├──────────────┤
//   │                         │   tile D     │
//   └─────────────────────────┴──────────────┘
//   ┌─ rest ─┬─ rest ─┬─ rest ─┬─ rest ─┬─ … (horizontal scroll if needed)
//
// On small screens it collapses to a single column: feature on top, then
// the column tiles stacked, then the filmstrip.
//
// Graceful degradation by visible-count:
//   1 item   → feature only
//   2–3      → feature + column (column shows what's available)
//   4+       → feature + column + filmstrip of the remainder
//
// Videos blend in with a play badge (same `ThumbnailButton` used by the
// strip). Clicking anywhere opens the same `Lightbox` the hero uses, with
// the *original* indices intact so navigation traverses the full mixed
// list — including the hero — once the modal is open.
// ---------------------------------------------------------------------------

export function CommunityMediaShowcase({
  items,
  communityName,
  excludeIndex,
  // Filmstrip below the feature + column grid. Temporarily hidden by
  // default — keep the implementation around so we can flip this back
  // on without re-deriving anything. The lightbox still reaches every
  // item via the "View all" pill on the feature tile, so users aren't
  // losing access to anything when the filmstrip is off.
  showFilmstrip = false,
}: {
  items: GalleryItem[];
  communityName: string;
  excludeIndex?: number;
  showFilmstrip?: boolean;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const railRef = useRef<HTMLUListElement | null>(null);
  const [showRailFade, setShowRailFade] = useState(false);

  // Preserve the original indices so the lightbox opens on the right slide.
  const visible = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ index }) => index !== excludeIndex),
    [items, excludeIndex],
  );

  const open = useCallback((i: number) => setLightboxIndex(i), []);

  // Carve the visible list into feature / column / rest. The column holds
  // up to three tiles; everything beyond goes into the bottom filmstrip.
  const feature = visible[0];
  const column = visible.slice(1, 4);
  const rest = visible.slice(4);

  // Right-edge fade for the filmstrip (same approach as the strip
  // component above — only show when there's content hidden to the right).
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const update = () => {
      const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
      setShowRailFade(remaining > 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [rest.length]);

  if (!feature) return null;

  // The "+N more" pill on the feature tile surfaces the full reachable
  // count via the lightbox (which navigates the *entire* mixed list,
  // including the excluded hero). Anchoring on `items.length` rather
  // than `visible.length` so the pill reads "View all N" with N being
  // the gallery's true total, not a subset.
  const totalReachable = items.length;

  return (
    <>
      {/* ---------------- Feature + column ----------------
          Fixed grid height on ≥sm so the row-spans actually have
          something to distribute. Below sm the grid collapses to a
          single column and each tile relies on its own aspect ratio
          for height (see Feature/ColumnTileMedia's `sm:hidden` aspect
          spacers). */}
      <div className="grid gap-3 sm:h-[480px] sm:grid-cols-5 sm:grid-rows-3 md:h-[560px] md:gap-4 lg:h-[600px]">
        {/* Feature tile. Spans the full row on mobile, 3/5 of the columns
            and all 3 rows on ≥sm. Slightly larger play badge (rendered
            inside ThumbnailButton for videos) so it reads as the focal
            point even when it's a clip. */}
        <button
          type="button"
          onClick={() => open(feature.index)}
          aria-label={
            feature.item.kind === "video"
              ? `Play video: ${feature.item.alt}`
              : `Open photo: ${feature.item.alt}`
          }
          className="group relative col-span-1 row-span-1 block overflow-hidden rounded-xl bg-surface ring-1 ring-black/5 transition hover:ring-black/15 sm:col-span-3 sm:row-span-3"
        >
          <FeatureTileMedia item={feature.item} />
        </button>

        {/* Column tiles (B, C, D). Each occupies one of the three
            grid rows on ≥sm. On mobile they collapse below the feature
            into a single-column stack. The "View all" pill sits on the
            last column tile (bottom-right of the grid on ≥sm, bottom of
            the stack on mobile). */}
        {column.map((entry, i) => {
          const isLast = i === column.length - 1;
          return (
            <button
              key={entry.item.id}
              type="button"
              onClick={() => open(entry.index)}
              aria-label={
                entry.item.kind === "video"
                  ? `Play video: ${entry.item.alt}`
                  : `Open photo: ${entry.item.alt}`
              }
              className="group relative col-span-1 row-span-1 block overflow-hidden rounded-xl bg-surface ring-1 ring-black/5 transition hover:ring-black/15 sm:col-span-2 sm:row-span-1"
            >
              <ColumnTileMedia item={entry.item} />
              {isLast && (
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-[0_2px_8px_rgba(15,23,42,0.16)] backdrop-blur transition group-hover:bg-white">
                  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
                    <path
                      d="M1.5 2.5h5v5h-5zM9.5 2.5h5v5h-5zM1.5 8.5h5v5h-5zM9.5 8.5h5v5h-5z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  View all {totalReachable}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---------------- Filmstrip of the remaining items ----------------
          Aligned flush with the feature/column grid above (no negative
          bleed margins): the first and last tiles sit at the same x
          positions as the feature tile's edges. Gated behind
          `showFilmstrip` so callers can opt in; the lightbox still walks
          the full list either way. */}
      {showFilmstrip && rest.length > 0 && (
        <div className="relative mt-3 md:mt-4">
          <ul
            ref={railRef}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
          >
            {rest.map((entry) => (
              <li
                key={entry.item.id}
                // Slightly tighter "peek" than the strip: 3.5 / 4.5 / 5.5
                // visible across breakpoints since the showcase already
                // satisfies the visual appetite with the feature + column,
                // and this rail is meant to read as a contact sheet.
                className="shrink-0 snap-start basis-[calc(28.57%-0.54rem)] sm:basis-[calc(22.22%-0.58rem)] md:basis-[calc(18.18%-0.61rem)]"
              >
                <ThumbnailButton
                  item={entry.item}
                  onClick={() => open(entry.index)}
                />
              </li>
            ))}
          </ul>
          {showRailFade && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent"
            />
          )}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          communityName={communityName}
        />
      )}
    </>
  );
}

// Feature-sized media renderer: large, eager-loaded image (since it's
// the primary focal point), or a poster + play badge for video items.
function FeatureTileMedia({ item }: { item: GalleryItem }) {
  const isVideo = item.kind === "video";
  const thumbUrl = isVideo ? (item.posterUrl ?? null) : item.url;
  return (
    <>
      {thumbUrl ? (
        <Image
          src={thumbUrl}
          alt={item.alt}
          fill
          sizes="(min-width: 1280px) 720px, (min-width: 640px) 60vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
      )}
      {/* Keep an aspect on mobile so the tile has height when there's no
          grid row to stretch into. On ≥sm the surrounding grid rows
          define the height. */}
      <div className="aspect-[4/3] w-full sm:hidden" aria-hidden />
      {isVideo && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md">
            <svg width="18" height="18" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 2l7 4-7 4V2z" fill="currentColor" />
            </svg>
          </span>
        </span>
      )}
    </>
  );
}

// Column-tile renderer: medium, lazy-loaded image; video tiles get the
// same play badge sizing as the lightbox thumbnails.
function ColumnTileMedia({ item }: { item: GalleryItem }) {
  const isVideo = item.kind === "video";
  const thumbUrl = isVideo ? (item.posterUrl ?? null) : item.url;
  return (
    <>
      {thumbUrl ? (
        <Image
          src={thumbUrl}
          alt={item.alt}
          fill
          sizes="(min-width: 1280px) 360px, (min-width: 640px) 25vw, 100vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
      )}
      <div className="aspect-[5/4] w-full sm:hidden" aria-hidden />
      {isVideo && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/25"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm">
            <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 2l7 4-7 4V2z" fill="currentColor" />
            </svg>
          </span>
        </span>
      )}
    </>
  );
}
