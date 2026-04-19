import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { CommunitiesTable } from "./CommunitiesTable";
import type { CommunityWithAddress } from "./types";

export const dynamic = "force-dynamic";

export default async function AdminCommunitiesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select(
      `
        id,
        name,
        slug,
        community_type,
        date_started,
        date_completed,
        cover_photo_path,
        site_plan_path,
        created_at,
        address:addresses (
          id,
          line1,
          line2,
          city,
          state,
          postal_code,
          country,
          latitude,
          longitude
        )
      `,
    )
    .order("name");

  const communities: CommunityWithAddress[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    community_type: row.community_type,
    date_started: row.date_started,
    date_completed: row.date_completed,
    cover_photo_path: row.cover_photo_path,
    site_plan_path: row.site_plan_path,
    created_at: row.created_at,
    address: row.address
      ? {
          id: row.address.id,
          line1: row.address.line1,
          line2: row.address.line2,
          city: row.address.city,
          state: row.address.state,
          postal_code: row.address.postal_code,
          country: row.address.country,
          latitude: row.address.latitude,
          longitude: row.address.longitude,
        }
      : null,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Communities</h1>
          <p className="text-sm text-muted">
            Click any row to edit. {communities.length}{" "}
            {communities.length === 1 ? "community" : "communities"} total.
          </p>
        </div>
        <Link
          href="/admin/communities/new"
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New community
        </Link>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error loading communities: {error.message}
        </p>
      ) : communities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm text-muted">
            No communities yet. Create your first one to get started.
          </p>
        </div>
      ) : (
        <CommunitiesTable communities={communities} />
      )}
    </div>
  );
}
