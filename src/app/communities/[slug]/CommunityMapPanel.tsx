"use client";

import dynamic from "next/dynamic";

import type { MapCommunity } from "@/components/CommunitiesMap";

// Leaflet touches `window` at import time, so the map can only render
// on the client.
const CommunitiesMap = dynamic(
  () => import("@/components/CommunitiesMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-surface text-sm text-muted">
        Loading map…
      </div>
    ),
  },
);

export function CommunityMapPanel({ community }: { community: MapCommunity }) {
  return (
    <div className="relative h-[420px] overflow-hidden rounded-xl bg-surface ring-1 ring-black/5 sm:h-[480px]">
      <CommunitiesMap
        communities={[community]}
        popupVariant="city"
        singlePointZoom={17}
        defaultBaseStyle="satellite"
      />
    </div>
  );
}
