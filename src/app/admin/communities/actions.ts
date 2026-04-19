"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Constants, type Database } from "@/types/database.types";

type CommunityType = Database["public"]["Enums"]["community_type"];

const COMMUNITY_TYPES =
  Constants.public.Enums.community_type as ReadonlyArray<CommunityType>;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type UpdateCommunityState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v.length ? v : null;
}

function parseOptionalDate(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v.length ? v : null;
}

function parseOptionalCoord(
  formData: FormData,
  key: string,
  min: number,
  max: number,
): { value: number | null; error?: string } {
  const v = str(formData, key);
  if (!v) return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n)) return { value: null, error: "Must be a number." };
  if (n < min || n > max) {
    return { value: null, error: `Must be between ${min} and ${max}.` };
  }
  return { value: n };
}

export async function updateCommunity(
  _prev: UpdateCommunityState,
  formData: FormData,
): Promise<UpdateCommunityState> {
  await requireAdmin();

  const id = str(formData, "id");
  if (!id) {
    return { status: "error", message: "Missing community id." };
  }

  const fieldErrors: Record<string, string> = {};

  const name = str(formData, "name");
  if (!name) fieldErrors.name = "Name is required.";

  const slug = str(formData, "slug");
  if (!slug) {
    fieldErrors.slug = "Slug is required.";
  } else if (!SLUG_RE.test(slug)) {
    fieldErrors.slug =
      "Use lowercase letters, numbers, and single hyphens (e.g. silver-creek).";
  }

  const rawType = str(formData, "community_type");
  let communityType: CommunityType | null = null;
  if (rawType) {
    if (!COMMUNITY_TYPES.includes(rawType as CommunityType)) {
      fieldErrors.community_type = "Invalid community type.";
    } else {
      communityType = rawType as CommunityType;
    }
  }

  const dateStarted = parseOptionalDate(formData, "date_started");
  const dateCompleted = parseOptionalDate(formData, "date_completed");
  if (dateStarted && dateCompleted && dateCompleted < dateStarted) {
    fieldErrors.date_completed =
      "Completion date must be on or after the start date.";
  }

  const line1 = str(formData, "line1");
  const city = str(formData, "city");
  const state = str(formData, "state");
  if (!line1) fieldErrors.line1 = "Street address is required.";
  if (!city) fieldErrors.city = "City is required.";
  if (!state) fieldErrors.state = "State is required.";

  const line2 = optionalStr(formData, "line2");
  const postalCode = optionalStr(formData, "postal_code");
  const country = str(formData, "country") || "US";

  const lat = parseOptionalCoord(formData, "latitude", -90, 90);
  if (lat.error) fieldErrors.latitude = lat.error;
  const lng = parseOptionalCoord(formData, "longitude", -180, 180);
  if (lng.error) fieldErrors.longitude = lng.error;

  // `cover_photo_path` is a hidden field set by the drawer after a direct
  // upload to Supabase Storage; "" means "remove the photo".
  const newCoverPath = optionalStr(formData, "cover_photo_path");

  // Same pattern as cover_photo_path, but against the
  // `community-site-plans` bucket.
  const newSitePlanPath = optionalStr(formData, "site_plan_path");

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("communities")
    .select("id, slug, address_id, cover_photo_path, site_plan_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return {
      status: "error",
      message: fetchErr?.message ?? "Community not found.",
    };
  }

  // --- Upsert the address row. ---
  const addressPayload = {
    line1,
    line2,
    city,
    state,
    postal_code: postalCode,
    country,
    latitude: lat.value,
    longitude: lng.value,
  };

  let addressId: string | null = existing.address_id;

  if (addressId) {
    const { error } = await supabase
      .from("addresses")
      .update(addressPayload)
      .eq("id", addressId);
    if (error) {
      return { status: "error", message: `Address update failed: ${error.message}` };
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("addresses")
      .insert(addressPayload)
      .select("id")
      .single();
    if (error || !inserted) {
      return {
        status: "error",
        message: error?.message ?? "Failed to create address.",
      };
    }
    addressId = inserted.id;
  }

  // --- Update the community row. ---
  const { error: updateErr } = await supabase
    .from("communities")
    .update({
      name,
      slug,
      community_type: communityType,
      date_started: dateStarted,
      date_completed: dateCompleted,
      cover_photo_path: newCoverPath,
      site_plan_path: newSitePlanPath,
      address_id: addressId,
    })
    .eq("id", id);

  if (updateErr) {
    const isDupSlug =
      updateErr.code === "23505" && updateErr.message.includes("slug");
    return {
      status: "error",
      message: isDupSlug
        ? "That slug is already taken. Try another."
        : updateErr.message,
      fieldErrors: isDupSlug ? { slug: "Slug must be unique." } : undefined,
    };
  }

  // --- Housekeeping: remove the previous photo if it was replaced. ---
  const oldPath = existing.cover_photo_path;
  if (oldPath && oldPath !== newCoverPath) {
    // Fire-and-forget; an orphaned object is cheaper than a failed save.
    await supabase.storage.from("community-photos").remove([oldPath]);
  }

  const oldSitePlanPath = existing.site_plan_path;
  if (oldSitePlanPath && oldSitePlanPath !== newSitePlanPath) {
    await supabase.storage
      .from("community-site-plans")
      .remove([oldSitePlanPath]);
  }

  revalidatePath("/admin/communities");
  revalidatePath("/communities");
  if (existing.slug !== slug) revalidatePath(`/communities/${existing.slug}`);
  revalidatePath(`/communities/${slug}`);

  return { status: "success" };
}

export type SetCoverPhotoResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Inline cover-photo mutation for the admin list. Used by the drag-and-drop
 * slot in `CommunitiesTable` — lighter than `updateCommunity` because there
 * are no other fields to validate. Also cleans up the previous storage
 * object so we don't leak orphans.
 */
export async function setCoverPhoto(
  communityId: string,
  path: string | null,
): Promise<SetCoverPhotoResult> {
  await requireAdmin();

  if (typeof communityId !== "string" || !communityId) {
    return { ok: false, message: "Missing community id." };
  }

  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("communities")
    .select("id, slug, cover_photo_path")
    .eq("id", communityId)
    .maybeSingle();
  if (fetchErr || !existing) {
    return { ok: false, message: fetchErr?.message ?? "Community not found." };
  }

  const { error: updateErr } = await supabase
    .from("communities")
    .update({ cover_photo_path: path })
    .eq("id", communityId);
  if (updateErr) return { ok: false, message: updateErr.message };

  const oldPath = existing.cover_photo_path;
  if (oldPath && oldPath !== path) {
    await supabase.storage.from("community-photos").remove([oldPath]);
  }

  revalidatePath("/admin/communities");
  revalidatePath("/communities");
  revalidatePath(`/communities/${existing.slug}`);

  return { ok: true };
}

export type CommunityPhotoRow = {
  id: string;
  storage_path: string;
  display_order: number;
};

export type AddCommunityPhotosResult =
  | { ok: true; rows: CommunityPhotoRow[] }
  | { ok: false; message: string };

/**
 * Append one or more already-uploaded photos (storage keys) to a community's
 * gallery. Display order picks up from whatever the community's current max
 * is, so new uploads always land at the end of the list.
 *
 * We do not touch storage here — the files were already uploaded directly
 * from the browser. If the DB insert fails the objects become harmless
 * orphans (same pattern the existing cover/site-plan flows use).
 */
export async function addCommunityPhotos(
  communityId: string,
  storagePaths: string[],
): Promise<AddCommunityPhotosResult> {
  await requireAdmin();

  if (!communityId) {
    return { ok: false, message: "Missing community id." };
  }
  const paths = storagePaths
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0);
  if (paths.length === 0) {
    return { ok: false, message: "No photos to add." };
  }

  const supabase = await createClient();

  const { data: community, error: fetchErr } = await supabase
    .from("communities")
    .select("id, slug")
    .eq("id", communityId)
    .maybeSingle();
  if (fetchErr || !community) {
    return { ok: false, message: fetchErr?.message ?? "Community not found." };
  }

  const { data: last, error: orderErr } = await supabase
    .from("community_photos")
    .select("display_order")
    .eq("community_id", communityId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderErr) return { ok: false, message: orderErr.message };

  const base = last?.display_order ?? -1;
  const rowsToInsert = paths.map((path, i) => ({
    community_id: communityId,
    storage_path: path,
    display_order: base + 1 + i,
  }));

  const { data, error } = await supabase
    .from("community_photos")
    .insert(rowsToInsert)
    .select("id, storage_path, display_order")
    .order("display_order");
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Insert failed." };
  }

  revalidatePath("/admin/communities");
  revalidatePath("/communities");
  revalidatePath(`/communities/${community.slug}`);

  return { ok: true, rows: data };
}

export type ReorderCommunityPhotosResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Persist a new display order for a community's gallery photos. `orderedIds`
 * is the full list of photo ids in the order the admin wants them to appear;
 * each row's `display_order` is rewritten to its index in that array.
 *
 * We rewrite every row (rather than only the ones that moved) so the stored
 * values stay dense and gap-free — simpler to reason about, and trivial to
 * merge with `addCommunityPhotos`' "append at max+1" logic.
 */
export async function reorderCommunityPhotos(
  communityId: string,
  orderedIds: string[],
): Promise<ReorderCommunityPhotosResult> {
  await requireAdmin();

  if (!communityId) return { ok: false, message: "Missing community id." };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, message: "Nothing to reorder." };
  }

  const supabase = await createClient();

  // Sanity check: only accept ids that actually belong to this community.
  // Prevents a client bug (or a stale form) from stamping display_order onto
  // some other community's rows.
  const { data: existing, error: fetchErr } = await supabase
    .from("community_photos")
    .select("id, community:community_id ( slug )")
    .eq("community_id", communityId);
  if (fetchErr) return { ok: false, message: fetchErr.message };

  const validIds = new Set((existing ?? []).map((r) => r.id));
  const seen = new Set<string>();
  const clean = orderedIds.filter((id) => {
    if (typeof id !== "string" || !validIds.has(id) || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });

  if (clean.length === 0) {
    return { ok: false, message: "No matching photos to reorder." };
  }

  // Parallel single-row updates. The table has no unique constraint on
  // (community_id, display_order), so intermediate collisions are fine.
  const results = await Promise.all(
    clean.map((id, i) =>
      supabase
        .from("community_photos")
        .update({ display_order: i })
        .eq("id", id)
        .eq("community_id", communityId),
    ),
  );
  const firstErr = results.find((r) => r.error)?.error;
  if (firstErr) return { ok: false, message: firstErr.message };

  const slug = existing?.[0]?.community?.slug;
  revalidatePath("/admin/communities");
  revalidatePath("/communities");
  if (slug) revalidatePath(`/communities/${slug}`);

  return { ok: true };
}

export type RemoveCommunityPhotoResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Delete a gallery photo. We grab the storage path + community slug up
 * front, delete the row, then clean up the backing storage object through
 * the Storage API. A DB-level trigger used to handle the storage delete,
 * but Supabase now forbids direct writes to `storage.objects` ("Direct
 * deletion from storage tables is not allowed. Use the Storage API
 * instead."), so the trigger was dropped in a follow-up migration.
 *
 * Order matters: if the row delete fails we abort without touching
 * storage; if storage cleanup fails after the row is gone we swallow the
 * error (an orphaned object is harmless and easier to garbage-collect
 * later than a "row deleted but storage kept" inconsistency).
 */
export async function removeCommunityPhoto(
  photoId: string,
): Promise<RemoveCommunityPhotoResult> {
  await requireAdmin();

  if (!photoId) return { ok: false, message: "Missing photo id." };

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("community_photos")
    .select("storage_path, community:community_id ( slug )")
    .eq("id", photoId)
    .maybeSingle();
  if (fetchErr) return { ok: false, message: fetchErr.message };
  if (!row) return { ok: false, message: "Photo not found." };

  const { error } = await supabase
    .from("community_photos")
    .delete()
    .eq("id", photoId);
  if (error) return { ok: false, message: error.message };

  if (row.storage_path) {
    await supabase.storage.from("community-photos").remove([row.storage_path]);
  }

  const slug = row.community?.slug;
  revalidatePath("/admin/communities");
  revalidatePath("/communities");
  if (slug) revalidatePath(`/communities/${slug}`);

  return { ok: true };
}
