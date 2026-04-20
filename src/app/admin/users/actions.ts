"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "user" | "admin";

export type SetUserRoleResult =
  | { ok: true; role: UserRole }
  | { ok: false; message: string };

/**
 * Flip a profile's role between 'user' and 'admin'.
 *
 * Admins can grant/revoke admin on any profile (enforced by RLS), but we
 * explicitly forbid an admin from demoting themselves — that's the kind
 * of foot-gun that locks the last admin out of the dashboard. Promote
 * someone else first, then have *them* demote you.
 */
export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<SetUserRoleResult> {
  const session = await requireAdmin();

  if (typeof userId !== "string" || !userId) {
    return { ok: false, message: "Missing user id." };
  }
  if (role !== "user" && role !== "admin") {
    return { ok: false, message: "Invalid role." };
  }

  if (userId === session.user.id && role !== "admin") {
    return {
      ok: false,
      message:
        "You can’t demote yourself. Ask another admin to change your role.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/users");
  return { ok: true, role };
}
