"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import Link from "next/link";

import "leaflet/dist/leaflet.css";

import type { Database } from "@/types/database.types";

type CommunityType = Database["public"]["Enums"]["community_type"];

export type MapCommunity = {
  id: string;
  name: string;
  slug: string;
  community_type: CommunityType | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  // Ordered list of photo URLs for the popup gallery. First entry is the
  // cover (if present), followed by the community's gallery photos in the
  // admin-curated order. Empty list means "no imagery" — popup falls back
  // to the text body only.
  photo_urls: string[];
};

const TYPE_LABEL: Record<CommunityType, string> = {
  single_family: "Single family",
  townhome: "Townhome",
  mixed: "Mixed",
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/**
 * Rewrite a Supabase Storage public URL to go through the
 * `render/image/public/...` transformation endpoint, returning a
 * server-cropped, recompressed WebP at the popup's exact display
 * dimensions. The popup cover is 280×160 CSS px, so the un-transformed
 * full-res photo (often 2 MB+) is wildly oversized — the resized
 * variant is typically 10–35 KB.
 *
 * We pass *both* `width` and `height` plus `resize=cover` so the
 * server does a center-crop to the box's aspect ratio. Passing only a
 * width makes Supabase scale by width and keep the full source
 * height, which means a portrait photo comes back as e.g. 280×1000 —
 * after the popup's `object-fit: cover` reframes that on the client
 * the result looks heavily zoomed in. Matching the aspect ratio at
 * the server avoids the double-crop and matches the pre-transform
 * framing exactly.
 *
 * Falls back to the original URL when `src` isn't a Supabase Storage
 * object URL or is already a transform URL (avoid double-wrapping).
 *
 * Quality 70 is the visually-lossless default for WebP per Supabase
 * docs; WebP is supported in every browser we care about (Safari 14+,
 * all evergreen).
 */
function thumbUrl(src: string, width: number, height: number): string {
  if (
    !src.includes("/storage/v1/object/public/") ||
    src.includes("/storage/v1/render/image/public/")
  ) {
    return src;
  }
  const rendered = src.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );
  const sep = rendered.includes("?") ? "&" : "?";
  return `${rendered}${sep}width=${width}&height=${height}&resize=cover&quality=70&format=webp`;
}

type BaseStyle = "satellite" | "streets";

const TILE_CONFIGS: Record<
  BaseStyle,
  { styleId: string; attribution: string }
> = {
  satellite: {
    // Satellite imagery with roads + labels on top. Most dramatic for a
    // homebuilder story — you can actually see the neighborhoods.
    styleId: "satellite-streets-v12",
    attribution:
      '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://www.maxar.com" target="_blank" rel="noopener">Maxar</a>',
  },
  streets: {
    // Rich modern basemap — colors for parks, water, etc. without the dated
    // OSM look.
    styleId: "streets-v12",
    attribution:
      '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  },
};

function tileUrl(styleId: string): string {
  return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/512/{z}/{x}/{y}{r}?access_token=${MAPBOX_TOKEN}`;
}

// Pin is a nested SVG circle so we can style layers independently (solid core,
// translucent halo, crisp white ring) for a crisper look than a CSS-only dot.
// All Tailwind classes are static so the JIT picks them up at build time.
const PIN_ICON = L.divIcon({
  className: "cc-pin",
  html: `
    <span class="cc-pin__halo"></span>
    <span class="cc-pin__dot"></span>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

// Custom zoom control — we disable Leaflet's default ugly square control on
// the MapContainer and render our own circular buttons so they match the
// rest of the map chrome (basemap toggle, pin, popup close button).
function ZoomControls() {
  const map = useMap();
  return (
    <div className="leaflet-top leaflet-left">
      <div className="leaflet-control cc-zoom">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => map.zoomIn()}
          className="cc-zoom__btn"
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
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => map.zoomOut()}
          className="cc-zoom__btn"
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
          >
            <path d="M3 8h10" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Auto-fit the map to the supplied points whenever they change.
function FitBounds({
  points,
  singlePointZoom,
}: {
  points: Array<[number, number]>;
  singlePointZoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], singlePointZoom);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, points, singlePointZoom]);
  return null;
}

// "card"  – full photo + name + type + city popup (used on the home map)
// "city"  – compact "City, ST" label (used on the single-community detail map)
export type PopupVariant = "card" | "city";

export default function CommunitiesMap({
  communities,
  popupVariant = "card",
  singlePointZoom = 13,
  defaultBaseStyle = "streets",
}: {
  communities: MapCommunity[];
  popupVariant?: PopupVariant;
  // Zoom level applied when exactly one community is on the map. The
  // detail-page map passes a higher value to focus on the neighborhood.
  singlePointZoom?: number;
  // Which Mapbox basemap to start on. The detail-page map defaults to
  // satellite so you can actually see the neighborhood.
  defaultBaseStyle?: BaseStyle;
}) {
  const points = useMemo(
    () =>
      communities.map(
        (c) => [c.latitude, c.longitude] as [number, number],
      ),
    [communities],
  );

  const [baseStyle, setBaseStyle] = useState<BaseStyle>(defaultBaseStyle);

  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-surface text-sm text-muted">
        No mapped communities yet.
      </div>
    );
  }

  // Default center (Harrisburg, PA area) — FitBounds will adjust immediately.
  const defaultCenter: [number, number] = [40.2732, -76.8867];

  const useMapbox = MAPBOX_TOKEN.length > 0;
  const config = TILE_CONFIGS[baseStyle];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={10}
      // Mapbox raster tiles exist up to z22, so let the map zoom that far.
      // Leaflet's default TileLayer max is 18, which would otherwise cap the
      // "+" button early (especially noticeable on retina with detectRetina,
      // since that effectively shifts the cap one level lower).
      maxZoom={22}
      scrollWheelZoom={false}
      zoomControl={false}
      className="h-full w-full"
    >
      {useMapbox ? (
        <TileLayer
          key={baseStyle}
          attribution={config.attribution}
          url={tileUrl(config.styleId)}
          tileSize={512}
          zoomOffset={-1}
          maxZoom={22}
          detectRetina
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      )}
      {useMapbox && (
        <div className="leaflet-top leaflet-right">
          <div className="leaflet-control cc-basemap-toggle">
            <button
              type="button"
              onClick={() => setBaseStyle("streets")}
              aria-pressed={baseStyle === "streets"}
              className={`cc-basemap-btn ${
                baseStyle === "streets" ? "cc-basemap-btn--active" : ""
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setBaseStyle("satellite")}
              aria-pressed={baseStyle === "satellite"}
              className={`cc-basemap-btn ${
                baseStyle === "satellite" ? "cc-basemap-btn--active" : ""
              }`}
            >
              Satellite
            </button>
          </div>
        </div>
      )}
      <ZoomControls />
      <FitBounds points={points} singlePointZoom={singlePointZoom} />
      {communities.map((c) => (
        <Marker key={c.id} position={[c.latitude, c.longitude]} icon={PIN_ICON}>
          {popupVariant === "city" ? (
            <Popup className="cc-popup cc-popup--city" closeButton={false}>
              <div className="cc-popup__city">
                {c.city ?? c.name}
                {c.state ? `, ${c.state}` : ""}
              </div>
            </Popup>
          ) : (
            <Popup className="cc-popup" minWidth={280} maxWidth={280}>
              <div className="w-[280px]">
                <PopupGallery photos={c.photo_urls} name={c.name} />
                <div className="cc-popup__body">
                  <Link
                    href={`/communities/${c.slug}`}
                    className="block text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {c.name}
                  </Link>
                  <div className="mt-1 text-xs text-muted">
                    {c.community_type && (
                      <span>{TYPE_LABEL[c.community_type]}</span>
                    )}
                    {c.community_type && c.city && <span> · </span>}
                    {c.city && (
                      <span>
                        {c.city}
                        {c.state ? `, ${c.state}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}

/**
 * Popup-internal photo gallery. Cycles through `photos` with prev/next
 * buttons when more than one is present; renders a single image (no
 * controls) when there's just a cover; renders nothing at all when the
 * community has no imagery.
 *
 * State is local — Leaflet tears down the popup DOM on close, which
 * resets the index. That's desired: reopening a popup starts fresh on
 * the cover.
 */
function PopupGallery({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);

  const clamped = index >= photos.length ? 0 : index;
  const total = photos.length;

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return;
      setIndex((prev) => (prev + delta + total) % total);
    },
    [total],
  );

  if (total === 0) return null;

  return (
    <div
      className="cc-popup__gallery"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.stopPropagation();
          go(-1);
        } else if (e.key === "ArrowRight") {
          e.stopPropagation();
          go(1);
        }
      }}
      tabIndex={total > 1 ? 0 : -1}
      role={total > 1 ? "group" : undefined}
      aria-label={total > 1 ? `${name} photos` : undefined}
    >
      {/* Horizontal track of every photo, shifted by translateX so
          paging slides the next/previous frame into view instead of
          hard-cutting. Each slide is exactly the viewport width
          (`flex-basis: 100%` via the CSS class) and the wrapper above
          clips overflow. Plain <img> (not next/image) — Leaflet renders
          the popup into a portal outside React's tree, and next/image's
          layout requirements don't play nicely inside the
          absolutely-positioned popup wrapper. */}
      <div
        className="cc-popup__cover-track"
        style={{ transform: `translate3d(-${clamped * 100}%, 0, 0)` }}
      >
        {photos.map((src, i) => {
          // The popup cover is 280×160 CSS px. Request a 1x and a 2x
          // variant at that exact aspect ratio so retina displays get
          // a crisp frame and 1x displays don't pay for retina pixels,
          // and so portrait source photos are center-cropped at the
          // server (matching the popup's `object-fit: cover` framing)
          // instead of being scaled to a tall sliver and then cropped
          // again on the client.
          const src1x = thumbUrl(src, 280, 160);
          const src2x = thumbUrl(src, 560, 320);
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src1x}
              srcSet={`${src1x} 1x, ${src2x} 2x`}
              sizes="280px"
              alt={
                total > 1
                  ? `${name} — photo ${i + 1} of ${total}`
                  : name
              }
              className="cc-popup__cover"
              // Eager-load the current frame; neighbours can lazy in.
              // (At ~60 KB each we used to need to preload them for
              // the slide animation; now they're small enough that
              // the lazy fetch completes before the user can swipe.)
              loading={i === clamped ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={i === clamped ? "high" : "low"}
              draggable={false}
            />
          );
        })}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="cc-popup__nav cc-popup__nav--prev"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="cc-popup__nav cc-popup__nav--next"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          <span className="cc-popup__counter" aria-hidden>
            {clamped + 1} / {total}
          </span>
        </>
      )}
    </div>
  );
}
