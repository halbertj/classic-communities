import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Refreshes the Supabase auth session on every request and returns a
 * `NextResponse` with updated auth cookies attached.
 *
 * This is called from the root `middleware.ts` so that:
 *   - expired access tokens get silently refreshed using the refresh token
 *   - Server Components always see a fresh session
 *   - logged-out users can still browse public pages
 *
 * IMPORTANT: don't run any code between `createServerClient(...)` and
 * `supabase.auth.getUser()` — it's what actually refreshes the session.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
