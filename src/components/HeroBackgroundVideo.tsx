"use client";

import { useEffect, useRef } from "react";

/**
 * Background hero video that *actually* autoplays on mobile.
 *
 * The HTML attributes (`muted`, `playsInline`, `autoPlay`) are the
 * standard recipe browsers require to autoplay without a user
 * gesture — but Safari (iOS, especially Low Power Mode) and some
 * Android Chrome versions still occasionally refuse to start the
 * video when they're only set as JSX attributes. The fix is two-fold:
 *
 *   1. Set `muted = true` on the DOM element imperatively. React
 *      mutes the element via a property, not the HTML attribute, and
 *      Safari sometimes evaluates autoplay before that property
 *      lands. Setting it ourselves on mount sidesteps the race.
 *   2. Call `play()` directly after mount and swallow the promise
 *      rejection. Low Power Mode will reject; that's fine — the
 *      poster keeps the hero looking right and the user can tap to
 *      start playback elsewhere on the page if they want.
 */
export function HeroBackgroundVideo({
  src,
  poster,
}: {
  src: string;
  poster: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Force the muted property *before* asking it to play. Mobile
    // Safari treats the attribute and the property as separate things
    // when deciding whether autoplay is allowed.
    el.muted = true;
    el.defaultMuted = true;

    const tryPlay = () => {
      // `play()` returns a promise in modern browsers; rejection is
      // expected on Low Power Mode iOS and other autoplay-blocked
      // contexts. Silencing it avoids noisy unhandled-rejection logs.
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          /* autoplay blocked — leave the poster visible */
        });
      }
    };

    tryPlay();
    // If playback was deferred (e.g. tab was backgrounded at mount),
    // re-attempt once metadata loads.
    el.addEventListener("loadedmetadata", tryPlay);
    return () => {
      el.removeEventListener("loadedmetadata", tryPlay);
    };
  }, []);

  // React's HTMLVideoElement typings don't include the non-standard
  // `webkit-playsinline` (legacy iOS) or `x5-playsinline` (some
  // Android in-app webviews like WeChat / UC) attributes that some
  // browsers still honor. We spread them in as untyped extras so the
  // attributes land on the rendered <video> without tripping TS.
  const nonStandardAttrs = {
    "webkit-playsinline": "true",
    "x5-playsinline": "true",
  } as Record<string, string>;

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      {...nonStandardAttrs}
    />
  );
}
