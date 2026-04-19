/**
 * Import Classic Communities from CSV, geocoding each address via Nominatim
 * (OpenStreetMap). Idempotent: re-run safely to patch missing lat/lng.
 *
 * Usage:  npm run import:communities
 *
 * Env (loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SECRET_KEY               — server-side secret key (bypasses RLS).
 *                                       Legacy `SUPABASE_SERVICE_ROLE_KEY` is
 *                                       accepted as a fallback for back-compat.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/types/database.types";

type CommunityType = Database["public"]["Enums"]["community_type"];

// ---------- env ----------
(function loadEnv(file: string) {
  try {
    const content = readFileSync(resolve(file), "utf8");
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      let value = rawValue.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* file missing is fine — env may come from the shell */
  }
})(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
  );
  process.exit(1);
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  console.warn(
    "⚠️  NEXT_PUBLIC_MAPBOX_TOKEN missing — Mapbox geocoding will be skipped (Census-only).",
  );
}
// Seed runs locally; public tokens typically have URL restrictions that require
// a matching Referer on HTTP requests.
const MAPBOX_REFERER = "http://localhost:3000/";

const supabase = createClient<Database>(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false },
});

// ---------- CSV row ----------
type Row = {
  Name: string;
  "Address (text)": string;
  "Build era": string;
  City: string;
  Location: string;
  "Num units": string;
  "Street names": string;
  Type: string;
};

// ---------- helpers ----------
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapType(raw: string): CommunityType | null {
  const t = raw.trim().toLowerCase();
  if (t === "single family") return "single_family";
  if (t === "townhome") return "townhome";
  if (t === "mixed") return "mixed";
  // "Duplex" and blanks fall through as null for now.
  return null;
}

/**
 * Parse "2012-13", "2011", "2013 - 2014", "1999, 2003", "2015-17"
 * into first/last year (inclusive). Returns both null if nothing parseable.
 */
function parseBuildEra(era: string): { startYear: number | null; endYear: number | null } {
  if (!era.trim()) return { startYear: null, endYear: null };

  const fullYears = Array.from(era.matchAll(/\b(19|20)\d{2}\b/g)).map((m) =>
    parseInt(m[0], 10),
  );
  // e.g. "2012-13" — 2-digit year after a hyphen/en-dash
  const shortYears = Array.from(era.matchAll(/[-–]\s*(\d{2})\b/g)).map((m) =>
    parseInt(m[1], 10),
  );

  if (fullYears.length === 0 && shortYears.length === 0) {
    return { startYear: null, endYear: null };
  }

  const years = [...fullYears];
  const anchor = fullYears[0] ?? 2000;
  const century = Math.floor(anchor / 100) * 100;
  for (const short of shortYears) years.push(century + short);
  years.sort((a, b) => a - b);
  return { startYear: years[0], endYear: years[years.length - 1] };
}

function yearToDate(year: number | null, which: "start" | "end"): string | null {
  if (year === null) return null;
  return which === "start" ? `${year}-01-01` : `${year}-12-31`;
}

type AddressFields = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;
  formatted: string;
};

function parseAddress(raw: string): AddressFields | null {
  const parts = raw
    .split(/,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;

  let country = "US";
  let state = "";
  let postal: string | null = null;
  let city = "";
  let line1 = "";

  // Pop optional "United States"
  const last = parts[parts.length - 1];
  if (/^united states$/i.test(last) || last.toUpperCase() === "USA") {
    parts.pop();
  } else if (last.length > 0 && !/\d/.test(last) && last.length > 3) {
    // Treat any non-numeric trailing token as a country name (rare here).
    country = last;
    parts.pop();
  }

  if (parts.length < 2) return null;

  // state + optional zip, e.g. "PA 17050-7200" or just "PA"
  const statePostal = parts.pop()!;
  const sp = statePostal.match(/^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);
  if (sp) {
    state = sp[1].toUpperCase();
    postal = sp[2] ?? null;
  } else {
    // Couldn't split cleanly — give up on this row's address.
    return null;
  }

  if (parts.length < 2) return null;
  city = parts.pop()!;
  line1 = parts.join(", ");
  if (!line1 || !city || !state) return null;

  const formatted = [
    line1,
    city,
    `${state}${postal ? " " + postal : ""}`,
    country === "US" ? "United States" : country,
  ].join(", ");

  return { line1, line2: null, city, state, postal_code: postal, country, formatted };
}

// ---------- geocode cache ----------
const CACHE_PATH = resolve("scripts/data/geocode-cache.json");
type GeocodeSuccess = {
  lat: number;
  lng: number;
  source: "census" | "mapbox";
  quality: "exact" | "street";
};
type GeocodeFailure = { lat: null; lng: null; error: string };
type CacheHit = GeocodeSuccess | GeocodeFailure;
const cache: Record<string, CacheHit> = (() => {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
})();

function saveCache() {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

// IMPORTANT: HTTP header values are ByteString (latin1) — ASCII only.
// No em dashes, smart quotes, etc. — fetch() will throw before the request.
const USER_AGENT =
  "classic-communities-import/1.0 (+https://classiccommunities.example)";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * US Census geocoder — https://geocoding.geo.census.gov
 * Free, no API key, no enforced rate limit. Requires a house number for a
 * match. When it hits, the result is truly exact (rooftop-level from TIGER).
 */
type CensusMatch = {
  coordinates: { x: number; y: number };
  matchedAddress: string;
};
async function censusGeocode(
  addr: AddressFields,
): Promise<{ lat: number; lng: number } | null> {
  if (addr.country !== "US") return null;
  const url = new URL(
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
  );
  url.searchParams.set(
    "address",
    `${addr.line1}, ${addr.city}, ${addr.state}${
      addr.postal_code ? " " + addr.postal_code : ""
    }`,
  );
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { addressMatches?: CensusMatch[] };
    };
    const match = data.result?.addressMatches?.[0];
    if (!match) return null;
    return { lat: match.coordinates.y, lng: match.coordinates.x };
  } catch {
    return null;
  }
}

/**
 * Mapbox Geocoding v6 forward. We accept `address` (rooftop) and `street`
 * (street centroid) only — coarser feature_types (neighborhood, postcode,
 * place, region) are filtered out at the API level so we never silently
 * substitute a city centroid for a street pin.
 *
 * Result selection is score-based instead of naively preferring "address"
 * over "street", because Mapbox will occasionally parse a stray number in
 * the input (e.g. a ZIP code) as a house number and fabricate a plausible-
 * looking address in an entirely different town. See Dove Ridge (Montrose
 * Cir, Mechanicsburg 17050) which naively returned "17050 PA-706, Montrose,
 * PA 18801" — 130 miles away. We guard against this by requiring the
 * returned region to match the input state (hard rule) and by awarding
 * points for matching ZIP.
 *
 * Uses the Permanent tier (`permanent=true`) — required to legally store
 * coordinates long-term. Confirmed enabled on the project's token.
 */
type MapboxFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    feature_type?: string;
    full_address?: string;
    context?: {
      region?: { region_code?: string; name?: string };
      postcode?: { name?: string };
    };
  };
};
async function mapboxGeocode(
  addr: AddressFields,
): Promise<{ lat: number; lng: number; quality: "exact" | "street" } | null> {
  if (!MAPBOX_TOKEN) return null;
  await sleep(100); // gentle pacing; Mapbox allows ~600 req/min

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set(
    "q",
    `${addr.line1}, ${addr.city}, ${addr.state}${
      addr.postal_code ? " " + addr.postal_code : ""
    }`,
  );
  url.searchParams.set("country", addr.country.toLowerCase());
  url.searchParams.set("types", "address,street");
  url.searchParams.set("limit", "5");
  url.searchParams.set("permanent", "true");
  url.searchParams.set("access_token", MAPBOX_TOKEN);

  try {
    const res = await fetch(url, { headers: { Referer: MAPBOX_REFERER } });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: MapboxFeature[] };
    const features = data.features ?? [];
    if (features.length === 0) return null;

    const inputZip5 = addr.postal_code?.split("-")[0] ?? "";

    let best: { feature: MapboxFeature; score: number } | null = null;
    for (const f of features) {
      const ctx = f.properties.context ?? {};
      const returnedState = ctx.region?.region_code;
      const returnedZip = ctx.postcode?.name;

      // Hard rule: if Mapbox reports a state at all and it disagrees with the
      // input, it's almost certainly a fabricated match in the wrong town.
      if (returnedState && returnedState !== addr.state) continue;

      let score = 0;
      if (returnedState === addr.state) score += 10;
      if (inputZip5 && returnedZip === inputZip5) score += 5;
      // Tiebreaker: rooftop beats street centroid.
      if (f.properties.feature_type === "address") score += 2;
      // Very mild bias toward Mapbox's own ranking.
      score += 1;

      if (!best || score > best.score) best = { feature: f, score };
    }

    if (!best) return null;
    const [lng, lat] = best.feature.geometry.coordinates;
    const quality =
      best.feature.properties.feature_type === "address" ? "exact" : "street";
    return { lat, lng, quality };
  } catch {
    return null;
  }
}

/**
 * Multi-tier geocoding, most-precise-first, never falls back to a city
 * centroid:
 *   1. US Census — free, rooftop-exact, requires a house number.
 *   2. Mapbox v6 — authoritative for US streets; returns address or street.
 * Anything coarser than a street (neighborhood, place, region) is rejected.
 */
async function geocodeAddress(addr: AddressFields): Promise<CacheHit> {
  const key = addr.formatted;
  if (cache[key]) return cache[key];

  const census = await censusGeocode(addr);
  if (census) {
    const hit: GeocodeSuccess = { ...census, source: "census", quality: "exact" };
    cache[key] = hit;
    return hit;
  }

  const mapbox = await mapboxGeocode(addr);
  if (mapbox) {
    const hit: GeocodeSuccess = {
      lat: mapbox.lat,
      lng: mapbox.lng,
      source: "mapbox",
      quality: mapbox.quality,
    };
    cache[key] = hit;
    return hit;
  }

  const fail: GeocodeFailure = {
    lat: null,
    lng: null,
    error: "no exact or street-level match",
  };
  cache[key] = fail;
  return fail;
}

// ---------- main ----------
async function main() {
  const csvPath = resolve("scripts/data/communities.csv");
  // Strip UTF-8 BOM (Notion-exported CSVs include one, which would poison the
  // first column header and make `row.Name` undefined for every row).
  const raw = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];

  console.log(`Read ${rows.length} rows from ${csvPath}`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let geocoded = 0;
  let addressMissing = 0;

  for (const [index, row] of rows.entries()) {
    const name = row.Name?.trim();
    if (!name) {
      skipped += 1;
      continue;
    }
    const slug = slugify(name);

    // --- parse fields ---
    const communityType = mapType(row.Type ?? "");
    const { startYear, endYear } = parseBuildEra(row["Build era"] ?? "");
    const dateStarted = yearToDate(startYear, "start");
    const dateCompleted = yearToDate(endYear, "end");

    // Prefer the cleaner "Location" field; fall back to "Address (text)"
    const locationRaw = row.Location?.trim() || row["Address (text)"]?.trim() || "";
    const address = locationRaw ? parseAddress(locationRaw) : null;

    // --- look up existing community ---
    const { data: existing, error: fetchErr } = await supabase
      .from("communities")
      .select("id, address_id")
      .eq("slug", slug)
      .maybeSingle();

    if (fetchErr) {
      console.error(`  ✗ ${name}: failed to query (${fetchErr.message})`);
      continue;
    }

    // --- ensure address row ---
    let addressId: string | null = existing?.address_id ?? null;

    if (address) {
      const geo = await geocodeAddress(address);
      if (geo.lat !== null) geocoded += 1;

      const addressPayload = {
        ...address,
        latitude: geo.lat,
        longitude: geo.lng,
      };

      if (addressId) {
        const { error } = await supabase
          .from("addresses")
          .update(addressPayload)
          .eq("id", addressId);
        if (error) console.error(`  ✗ ${name}: address update — ${error.message}`);
      } else {
        const { data, error } = await supabase
          .from("addresses")
          .insert(addressPayload)
          .select("id")
          .single();
        if (error || !data) {
          console.error(`  ✗ ${name}: address insert — ${error?.message}`);
        } else {
          addressId = data.id;
        }
      }
    } else {
      addressMissing += 1;
    }

    // --- upsert community ---
    const communityPayload = {
      name,
      slug,
      community_type: communityType,
      date_started: dateStarted,
      date_completed: dateCompleted,
      address_id: addressId,
    };

    if (existing) {
      const { error } = await supabase
        .from("communities")
        .update(communityPayload)
        .eq("id", existing.id);
      if (error) {
        console.error(`  ✗ ${name}: community update — ${error.message}`);
      } else {
        updated += 1;
      }
    } else {
      const { error } = await supabase.from("communities").insert(communityPayload);
      if (error) {
        console.error(`  ✗ ${name}: community insert — ${error.message}`);
      } else {
        imported += 1;
      }
    }

    const geoLabel = (() => {
      if (!address) return "no address";
      if (!addressId) return "address insert failed";
      // After an address was processed, look up its cache entry for the label.
      const hit = cache[address.formatted];
      if (hit && hit.lat !== null) {
        const tag = hit.quality === "exact" ? "📍 exact" : "📌 street-level";
        return `${tag} (${hit.source}) · ${address.city}, ${address.state}`;
      }
      return `⚠️  unplaceable · ${address.city}, ${address.state}`;
    })();
    const status = geoLabel;
    console.log(
      `  [${String(index + 1).padStart(2)}/${rows.length}] ${name} — ${status}`,
    );

    // Persist cache every 5 rows so a crash doesn't waste geocodes.
    if (index % 5 === 4) saveCache();
  }

  saveCache();

  console.log(
    `\nDone. imported=${imported} updated=${updated} skipped=${skipped} geocoded=${geocoded} no_address=${addressMissing}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
