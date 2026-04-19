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
  cover_photo_path: string | null;
  site_plan_path: string | null;
  logo_path: string | null;
  starred: boolean;
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
