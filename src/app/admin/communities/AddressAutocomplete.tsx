"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Autocompleting street-address input backed by Mapbox Geocoding v6.
 *
 * We call the forward endpoint with `autocomplete=true` so typing returns
 * ranked suggestions, then parse the chosen feature into the component pieces
 * (line1, city, state, postal_code, country) plus lat/lng — all surfaced via
 * `onAutofill`. The wrapping input is fully controlled so the parent can
 * render the value back into the form field.
 *
 * Why Geocoding v6 (not Search Box)? The existing import pipeline already
 * uses v6 under `permanent=true`, so staying on the same endpoint keeps
 * billing + token scopes consistent and returns coordinates in the suggestion
 * response (no separate /retrieve call needed).
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type MapboxFeature = {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: {
    feature_type?: string;
    name?: string;
    name_preferred?: string;
    place_formatted?: string;
    full_address?: string;
    context?: {
      address?: { name?: string };
      street?: { name?: string };
      postcode?: { name?: string };
      place?: { name?: string };
      region?: { name?: string; region_code?: string };
      country?: { name?: string; country_code?: string };
    };
  };
};

export type AddressAutofill = {
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: string;
  longitude: string;
};

function featureToAutofill(f: MapboxFeature): AddressAutofill {
  const ctx = f.properties.context ?? {};
  const [lng, lat] = f.geometry.coordinates;
  // `name` is typically the street-level portion (e.g. "123 Main St").
  // `context.address.name` also carries that for `feature_type=address`.
  const line1 =
    ctx.address?.name ??
    f.properties.name_preferred ??
    f.properties.name ??
    "";
  return {
    line1,
    city: ctx.place?.name ?? "",
    state: ctx.region?.region_code ?? ctx.region?.name ?? "",
    postal_code: ctx.postcode?.name ?? "",
    country: ctx.country?.country_code?.toUpperCase() ?? "",
    latitude: Number.isFinite(lat) ? String(lat) : "",
    longitude: Number.isFinite(lng) ? String(lng) : "",
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onAutofill,
  name,
  required,
  className,
  country = "us",
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onAutofill: (fields: AddressAutofill) => void;
  name?: string;
  required?: boolean;
  className?: string;
  country?: string;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bumped each request so late responses for stale queries are discarded.
  const reqIdRef = useRef(0);
  // Suppresses the next fetch after a selection, so the form doesn't
  // re-open the dropdown with suggestions for the just-inserted value.
  const skipNextFetchRef = useRef(false);

  const listboxId = useId();
  const enabled = MAPBOX_TOKEN.length > 0;

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (!enabled) return;
      const trimmed = q.trim();
      if (trimmed.length < 3) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      const myReq = ++reqIdRef.current;
      setLoading(true);
      try {
        const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
        url.searchParams.set("q", trimmed);
        url.searchParams.set("autocomplete", "true");
        url.searchParams.set("types", "address,street");
        url.searchParams.set("limit", "6");
        if (country) url.searchParams.set("country", country.toLowerCase());
        url.searchParams.set("access_token", MAPBOX_TOKEN);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`mapbox ${res.status}`);
        const data = (await res.json()) as { features?: MapboxFeature[] };
        // Drop stale responses.
        if (reqIdRef.current !== myReq) return;
        const features = data.features ?? [];
        setSuggestions(features);
        setOpen(features.length > 0);
        setActiveIdx(features.length > 0 ? 0 : -1);
      } catch {
        if (reqIdRef.current !== myReq) return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (reqIdRef.current === myReq) setLoading(false);
      }
    },
    [country, enabled],
  );

  // Debounced fetch on value change.
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (!enabled) return;
    const handle = setTimeout(() => {
      void fetchSuggestions(value);
    }, 220);
    return () => clearTimeout(handle);
  }, [value, fetchSuggestions, enabled]);

  // Click-outside closes the dropdown.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function selectFeature(f: MapboxFeature) {
    const fields = featureToAutofill(f);
    skipNextFetchRef.current = true;
    onAutofill(fields);
    setOpen(false);
    setSuggestions([]);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        e.preventDefault();
        setOpen(true);
        setActiveIdx(0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        e.preventDefault();
        selectFeature(suggestions[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const activeId = useMemo(
    () => (activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined),
    [activeIdx, listboxId],
  );

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        name={name}
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeId}
      />
      {loading && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted"
        >
          …
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-background shadow-lg"
        >
          {suggestions.map((s, i) => {
            const title = s.properties.name ?? s.properties.full_address ?? "";
            const subtitle = s.properties.place_formatted ?? "";
            const isActive = i === activeIdx;
            return (
              <li
                id={`${listboxId}-opt-${i}`}
                key={s.id}
                role="option"
                aria-selected={isActive}
                // `mousedown` fires before the input's `blur`, so the click
                // registers even though clicking moves focus off the input.
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectFeature(s);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  isActive ? "bg-surface" : "bg-background"
                }`}
              >
                <div className="font-medium text-foreground">{title}</div>
                {subtitle && (
                  <div className="text-xs text-muted">{subtitle}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
