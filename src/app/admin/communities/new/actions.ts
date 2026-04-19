"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import { createClient } from "@/lib/supabase/server";
import { Constants, type Database } from "@/types/database.types";

type CommunityType = Database["public"]["Enums"]["community_type"];

const COMMUNITY_TYPES = Constants.public.Enums.community_type as ReadonlyArray<CommunityType>;

export type CreateCommunityState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalStr(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v.length ? v : null;
}

function parseOptionalDate(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  // <input type="date"> returns YYYY-MM-DD which is a valid Postgres `date`.
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

export async function createCommunity(
  _prev: CreateCommunityState,
  formData: FormData,
): Promise<CreateCommunityState> {
  await requireAdmin();

  const fieldErrors: Record<string, string> = {};

  const name = str(formData, "name");
  if (!name) fieldErrors.name = "Name is required.";

  let slug = str(formData, "slug");
  if (!slug && name) slug = slugify(name);
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
    fieldErrors.date_completed = "Completion date must be on or after the start date.";
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

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const supabase = await createClient();

  // Insert the address first; if the community insert fails afterwards
  // we'll roll it back so we don't leak orphaned rows.
  const { data: address, error: addressError } = await supabase
    .from("addresses")
    .insert({
      line1,
      line2,
      city,
      state,
      postal_code: postalCode,
      country,
      latitude: lat.value,
      longitude: lng.value,
    })
    .select("id")
    .single();

  if (addressError || !address) {
    return {
      status: "error",
      message: addressError?.message ?? "Failed to save address.",
    };
  }

  const { error: communityError } = await supabase.from("communities").insert({
    name,
    slug,
    community_type: communityType,
    date_started: dateStarted,
    date_completed: dateCompleted,
    address_id: address.id,
  });

  if (communityError) {
    // Roll back the orphaned address row.
    await supabase.from("addresses").delete().eq("id", address.id);

    // 23505 = unique_violation — likely the slug.
    const isDupSlug =
      communityError.code === "23505" &&
      communityError.message.includes("slug");
    return {
      status: "error",
      message: isDupSlug
        ? "That slug is already taken. Try another."
        : communityError.message,
      fieldErrors: isDupSlug ? { slug: "Slug must be unique." } : undefined,
    };
  }

  revalidatePath("/admin/communities");
  revalidatePath("/communities");
  redirect("/admin/communities");
}
