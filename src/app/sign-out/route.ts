import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * POST /sign-out — clears the Supabase session cookies and redirects to /sign-in.
 * Called from a <form action="/sign-out" method="POST"> button so it works
 * without client-side JS.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/sign-in", request.url), {
    status: 303,
  });
}
