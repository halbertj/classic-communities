import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Browser-side Supabase client.
 *
 * Use this from Client Components (files marked `"use client"`).
 * It reads the `NEXT_PUBLIC_SUPABASE_*` env vars at build/runtime and
 * persists the auth session in the browser's cookies so that Server
 * Components and Route Handlers see the same logged-in user.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
