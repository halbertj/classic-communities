"use client";

import { useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { setCoverPhoto } from "./actions";
import { EditCommunityDrawer } from "./EditCommunityDrawer";
import type { CommunityType, CommunityWithAddress } from "./types";

const TYPE_LABEL: Record<CommunityType, string> = {
  single_family: "Single family",
  townhome: "Townhome",
  mixed: "Mixed",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${m}/${d}/${y}`;
}

export function CommunitiesTable({
  communities,
}: {
  communities: CommunityWithAddress[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Optimistic overrides for cover_photo_path — lets the inline drop slot
  // update instantly without waiting for a server round-trip.
  const [coverOverrides, setCoverOverrides] = useState<
    Record<string, string | null>
  >({});

  const effectivePath = (c: CommunityWithAddress): string | null =>
    c.id in coverOverrides ? coverOverrides[c.id] : c.cover_photo_path;

  const selected = selectedId
    ? (() => {
        const base = communities.find((c) => c.id === selectedId);
        if (!base) return null;
        return { ...base, cover_photo_path: effectivePath(base) };
      })()
    : null;

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <colgroup>
            <col style={{ width: 84 }} />
            <col />
            <col style={{ width: 140 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 180 }} />
          </colgroup>
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Cover</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Completed</th>
              <th className="px-4 py-3 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {communities.map((c) => (
              <tr
                key={c.id}
                tabIndex={0}
                role="button"
                aria-label={`Edit ${c.name}`}
                onClick={() => setSelectedId(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(c.id);
                  }
                }}
                className="cursor-pointer border-t border-border outline-none transition-colors hover:bg-surface focus:bg-surface focus:ring-1 focus:ring-inset focus:ring-primary/40"
              >
                <td className="px-3 py-2 align-middle">
                  <CoverCell
                    communityId={c.id}
                    coverPath={effectivePath(c)}
                    onChange={(path) =>
                      setCoverOverrides((prev) => ({ ...prev, [c.id]: path }))
                    }
                  />
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="font-medium">{c.name}</div>
                  <div className="font-mono text-[11px] text-muted">
                    {c.slug}
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  {c.community_type ? TYPE_LABEL[c.community_type] : "—"}
                </td>
                <td className="px-4 py-3 align-middle">
                  {formatDate(c.date_started)}
                </td>
                <td className="px-4 py-3 align-middle">
                  {formatDate(c.date_completed)}
                </td>
                <td className="px-4 py-3 align-middle text-muted">
                  {c.address ? `${c.address.city}, ${c.address.state}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <EditCommunityDrawer
          key={selected.id}
          community={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

/**
 * Inline cover-photo cell.
 *   - Filled: thumbnail. Clicking bubbles up so the row opens the edit
 *     drawer (same as clicking anywhere else on the row).
 *   - Empty: dashed drop target. Click opens a file picker; drag-and-drop
 *     uploads. Both paths stop propagation so the drawer doesn't open.
 */
function CoverCell({
  communityId,
  coverPath,
  onChange,
}: {
  communityId: string;
  coverPath: string | null;
  onChange: (path: string | null) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicUrl = useMemo(() => {
    if (!coverPath) return null;
    const { data } = supabase.storage
      .from("community-photos")
      .getPublicUrl(coverPath);
    return data.publicUrl;
  }, [coverPath, supabase]);

  async function uploadFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Image files only.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Over 10MB.");
      return;
    }

    setUploading(true);
    try {
      const extFromName = file.name.split(".").pop()?.toLowerCase();
      const extFromType = file.type.split("/")[1]?.toLowerCase();
      const ext = (extFromName || extFromType || "jpg").replace(
        /[^a-z0-9]/g,
        "",
      );
      const path = `${communityId}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("community-photos")
        .upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type || undefined,
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      const res = await setCoverPhoto(communityId, path);
      if (!res.ok) throw new Error(res.message);

      onChange(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (publicUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={publicUrl}
        alt=""
        className="h-12 w-16 rounded-md object-cover ring-1 ring-black/5"
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label="Upload cover photo"
      onClick={(e) => {
        e.stopPropagation();
        if (!uploading) inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (!uploading) inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void uploadFile(file);
      }}
      className={`relative flex h-12 w-16 items-center justify-center rounded-md border border-dashed transition-colors ${
        dragging
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface text-muted hover:border-foreground/40 hover:text-foreground"
      } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      title={error ?? "Click or drop a photo to upload"}
    >
      {uploading ? (
        <svg
          className="h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="3"
          />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M12 16V4m0 0l-4 4m4-4l4 4M5 18h14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadFile(file);
        }}
      />
      {error && !dragging && (
        <span className="pointer-events-none absolute -bottom-5 left-0 whitespace-nowrap text-[10px] text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
