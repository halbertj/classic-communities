import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Session = { user: User; profile: Profile };

/**
 * Returns the signed-in Supabase user + their profile row, or `null`
 * if nobody is signed in. Safe to call from any Server Component.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return { user, profile };
}

/**
 * Use at the top of any admin-only Server Component / Server Action.
 * Redirects to /sign-in if not signed in, or to / if signed in but not admin.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.profile.role !== "admin") redirect("/");
  return session;
}
