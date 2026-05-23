"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EntityRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type EntityMutationResult =
  | { ok: true; entity: EntityRow }
  | { ok: false; message: string };

export type DeleteEntityResult =
  | { ok: true }
  | { ok: false; message: string };

function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function mapDuplicateError(message: string): string {
  // The DB has a case-insensitive unique index on `name`; surface a
  // friendly error rather than the raw PG message.
  if (message.toLowerCase().includes("entities_name_ci_unique")) {
    return "An entity with that name already exists.";
  }
  return message;
}

export async function createEntity(name: string): Promise<EntityMutationResult> {
  await requireAdmin();

  const trimmed = cleanName(name);
  if (!trimmed) {
    return { ok: false, message: "Name is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entities")
    .insert({ name: trimmed })
    .select("id, name, created_at, updated_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: mapDuplicateError(error?.message ?? "Failed to create entity."),
    };
  }

  revalidatePath("/admin/entities");
  return { ok: true, entity: data };
}

export async function renameEntity(
  id: string,
  name: string,
): Promise<EntityMutationResult> {
  await requireAdmin();

  if (typeof id !== "string" || !id) {
    return { ok: false, message: "Missing entity id." };
  }
  const trimmed = cleanName(name);
  if (!trimmed) {
    return { ok: false, message: "Name is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entities")
    .update({ name: trimmed })
    .eq("id", id)
    .select("id, name, created_at, updated_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: mapDuplicateError(error?.message ?? "Failed to rename entity."),
    };
  }

  revalidatePath("/admin/entities");
  return { ok: true, entity: data };
}

export async function deleteEntity(id: string): Promise<DeleteEntityResult> {
  await requireAdmin();

  if (typeof id !== "string" || !id) {
    return { ok: false, message: "Missing entity id." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("entities").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/entities");
  return { ok: true };
}
