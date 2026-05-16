/**
 * Warm the per-community Open Graph image cache.
 *
 * The dynamic `app/communities/[slug]/opengraph-image.tsx` route is
 * generated lazily — the first social crawler (or `next start`
 * request) for `/communities/<slug>` triggers Satori to composite
 * the community's cover photo with its name. After that, the image
 * is cached until something calls `revalidatePath('/communities/<slug>')`,
 * which the photo / community server actions already do.
 *
 * This script "backfills" by hitting every non-archived community's
 * OG image URL once, so the first real link-share unfurls instantly
 * instead of paying the cold-start cost.
 *
 * Usage:  npm run warm:og [-- --base-url=https://example.com] [--concurrency=4]
 *
 * Env (loaded from .env.local, same as the import script):
 *   NEXT_PUBLIC_SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SECRET_KEY               — server-side secret key (bypasses RLS).
 *                                       Legacy `SUPABASE_SERVICE_ROLE_KEY` is
 *                                       accepted as a fallback for back-compat.
 *   NEXT_PUBLIC_SITE_URL              — origin to warm against (default).
 *                                       Override with `--base-url=`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/types/database.types";

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
    /* .env.local is optional */
  }
})(".env.local");

// ---------- args ----------
function parseArgs(): { baseUrl: string | null; concurrency: number } {
  let baseUrl: string | null = null;
  let concurrency = 4;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length).trim() || null;
    } else if (arg.startsWith("--concurrency=")) {
      const n = Number(arg.slice("--concurrency=".length));
      if (Number.isInteger(n) && n > 0) concurrency = n;
    }
  }
  return { baseUrl, concurrency };
}

function resolveBaseUrl(explicit: string | null): string {
  const candidate =
    explicit ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!candidate) {
    throw new Error(
      "No base URL. Pass --base-url=https://... or set NEXT_PUBLIC_SITE_URL.",
    );
  }
  const withScheme = /^https?:\/\//i.test(candidate)
    ? candidate
    : /^(localhost|127\.)/i.test(candidate)
      ? `http://${candidate}`
      : `https://${candidate}`;
  return withScheme.replace(/\/+$/, "");
}

// ---------- main ----------
async function main() {
  const { baseUrl: argBase, concurrency } = parseArgs();
  const baseUrl = resolveBaseUrl(argBase);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in env.",
    );
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from("communities")
    .select("slug, name, archived")
    .eq("archived", false)
    .order("name");
  if (error) throw new Error(`Failed to list communities: ${error.message}`);
  if (!rows || rows.length === 0) {
    console.log("No communities to warm.");
    return;
  }

  console.log(
    `Warming ${rows.length} OG image${rows.length === 1 ? "" : "s"} against ${baseUrl} (concurrency ${concurrency})…`,
  );

  // The og-image route lives at `/communities/<slug>/opengraph-image`.
  // Hitting the page itself would also work (Next renders the metadata
  // and the image route is fetched by crawlers), but going straight to
  // the image asset is one fewer render and guarantees we exercise the
  // Satori path even if the parent page is statically cached.
  const targets = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    url: `${baseUrl}/communities/${encodeURIComponent(r.slug)}/opengraph-image`,
  }));

  let ok = 0;
  let failed = 0;
  let cursor = 0;

  async function worker(id: number) {
    while (true) {
      const i = cursor++;
      if (i >= targets.length) return;
      const t = targets[i];
      const start = Date.now();
      try {
        // `no-store` + `Pragma: no-cache` make sure we're not getting
        // a 304 off the CDN — we want the origin to actually render
        // the image so it lands in the runtime cache.
        const res = await fetch(t.url, {
          cache: "no-store",
          headers: { "cache-control": "no-cache", pragma: "no-cache" },
        });
        // Drain the body so the connection can be reused and we have
        // a real signal that the render finished.
        await res.arrayBuffer();
        const ms = Date.now() - start;
        if (!res.ok) {
          failed++;
          console.warn(
            `  [w${id}] ${t.slug}: HTTP ${res.status} in ${ms}ms — ${t.name}`,
          );
        } else {
          ok++;
          console.log(`  [w${id}] ${t.slug}: ok in ${ms}ms — ${t.name}`);
        }
      } catch (e) {
        failed++;
        const ms = Date.now() - start;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`  [w${id}] ${t.slug}: ${msg} after ${ms}ms`);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, targets.length) },
    (_, i) => worker(i + 1),
  );
  await Promise.all(workers);

  console.log(`Done. ${ok} ok, ${failed} failed, ${targets.length} total.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
