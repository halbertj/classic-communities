"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type AboutPhoto = {
  src: string;
  alt: string;
  caption?: string;
};

export function AboutGallery({ photos }: { photos: AboutPhoto[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro.disconnect();
    };
  }, [updateEdges]);

  const scrollByOneTile = useCallback((direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Find the first fully visible tile's width (incl. gap) from its first
    // child so the arrow advances by one card regardless of viewport size.
    const firstTile = el.querySelector<HTMLElement>("[data-tile]");
    const step = firstTile
      ? firstTile.getBoundingClientRect().width + 16
      : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  if (photos.length === 0) return null;

  return (
    <div className="relative mt-14">
      {/* Edge fades — fade out tiles as they approach the section's edges so
          the row looks like a continuous strip rather than an abrupt clip. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-surface to-transparent transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-surface to-transparent transition-opacity duration-200 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={scrollerRef}
        className="cc-about-scroller flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
      >
        {photos.map((photo) => (
          <figure
            key={photo.src}
            data-tile
            className="relative shrink-0 snap-center overflow-hidden rounded-xl bg-background ring-1 ring-black/5 shadow-[0_10px_30px_-15px_rgba(15,23,42,0.25)]"
            style={{ width: "min(80vw, 420px)" }}
          >
            <div className="relative aspect-[3/2]">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(min-width: 768px) 420px, 80vw"
                className="object-cover"
              />
            </div>
            {photo.caption && (
              <figcaption className="px-4 py-3 text-left text-xs text-muted">
                {photo.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {/* Desktop-only arrow controls. Hidden on touch sizes where swipe is
          the natural interaction. */}
      <button
        type="button"
        aria-label="Previous photo"
        onClick={() => scrollByOneTile(-1)}
        disabled={!canScrollLeft}
        className="hidden md:grid absolute left-2 top-1/2 z-20 h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-foreground shadow-[0_6px_20px_-6px_rgba(15,23,42,0.35)] ring-1 ring-black/5 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-0"
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 3L5 8l5 5" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next photo"
        onClick={() => scrollByOneTile(1)}
        disabled={!canScrollRight}
        className="hidden md:grid absolute right-2 top-1/2 z-20 h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-foreground shadow-[0_6px_20px_-6px_rgba(15,23,42,0.35)] ring-1 ring-black/5 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-0"
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>
    </div>
  );
}
