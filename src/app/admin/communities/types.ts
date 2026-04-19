import type { Database } from "@/types/database.types";

export type CommunityType = Database["public"]["Enums"]["community_type"];

/**
 * Everything the admin table + edit drawer needs about a single community.
 * Shape matches the joined select in `page.tsx` and is shared with the
 * client components so the drawer can hydrate instantly on row click.
 */
export type CommunityWithAddress = {
  id: string;
  name: string;
  slug: string;
  community_type: CommunityType | null;
  date_started: string | null;
  date_completed: string | null;
  num_homes: number | null;
  /**
   * Admin-authored long-form copy shown under "About this community" on
   * the public detail page. Plain text; newlines are preserved at render.
   * `null` means the page should fall back to the auto-generated one-liner.
   */
  description: string | null;
  /**
   * Storage path of the first photo in the community's gallery — used as
   * the cover across the admin table, home page, and public listing. The
   * legacy `cover_photo_path` column is consulted only as a fallback when
   * the gallery is empty, so this field carries whichever one is active.
   */
  cover_photo_path: string | null;
  site_plan_path: string | null;
  logo_path: string | null;
  starred: boolean;
  /**
   * Soft-delete flag. Archived communities are hidden from the public
   * site (home map, /communities, /communities/[slug]) but still render
   * in the admin table so they can be restored.
   */
  archived: boolean;
  archived_at: string | null;
  /**
   * Ordered list of street names that make up this community (e.g.
   * "Maple Lane", "Oak Circle"). Always an array — never null — thanks
   * to the DB default.
   */
  street_names: string[];
  created_at: string;
  address: {
    id: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string | null;
    country: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
};
