import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Server-side Supabase client.
 *
 * Use this from Server Components, Route Handlers, and Server Actions.
 * It wires Supabase's cookie read/write hooks into Next.js's `cookies()` API
 * so the session stays in sync with the browser.
 *
 * Note: `next/headers`' `cookies()` is async in Next.js 15, hence the
 * `await` below.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions on every request (see middleware.ts).
          }
        },
      },
    },
  );
}
