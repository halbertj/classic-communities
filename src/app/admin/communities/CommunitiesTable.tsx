"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { setCoverPhoto, setStarred } from "./actions";
import { EditCommunityDrawer } from "./EditCommunityDrawer";
import type { CommunityType, CommunityWithAddress } from "./types";

const TYPE_LABEL: Record<CommunityType, string> = {
  single_family: "Single family",
  townhome: "Townhome",
  mixed: "Mixed",
};

function formatYear(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 4);
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

  // Same pattern for the inline star toggle.
  const [starredOverrides, setStarredOverrides] = useState<
    Record<string, boolean>
  >({});

  const effectivePath = (c: CommunityWithAddress): string | null =>
    c.id in coverOverrides ? coverOverrides[c.id] : c.cover_photo_path;

  const effectiveStarred = (c: CommunityWithAddress): boolean =>
    c.id in starredOverrides ? starredOverrides[c.id] : c.starred;

  const selected = selectedId
    ? (() => {
        const base = communities.find((c) => c.id === selectedId);
        if (!base) return null;
        return {
          ...base,
          cover_photo_path: effectivePath(base),
          starred: effectiveStarred(base),
        };
      })()
    : null;

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: 84 }} />
            <col />
            <col style={{ width: 140 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 180 }} />
          </colgroup>
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-2 py-3 font-medium">
                <span className="sr-only">Featured</span>
              </th>
              <th className="px-3 py-3 font-medium">Cover</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Completed</th>
              <th className="px-4 py-3 font-medium">Homes</th>
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
                <td className="px-2 py-2 align-middle">
                  <StarCell
                    communityId={c.id}
                    starred={effectiveStarred(c)}
                    onChange={(value) =>
                      setStarredOverrides((prev) => ({
                        ...prev,
                        [c.id]: value,
                      }))
                    }
                  />
                </td>
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
                <td className="px-4 py-3 align-middle tabular-nums">
                  {formatYear(c.date_started)}
                </td>
                <td className="px-4 py-3 align-middle tabular-nums">
                  {formatYear(c.date_completed)}
                </td>
                <td className="px-4 py-3 align-middle tabular-nums">
                  {typeof c.num_homes === "number" ? c.num_homes : "—"}
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
 * Inline star-toggle cell.
 *   - Click toggles `starred` and fires the server mutation optimistically.
 *   - We stop event propagation so clicking the star doesn't also open
 *     the edit drawer (same pattern as the cover upload slot).
 *   - On failure we revert and surface the error inline via `title`.
 */
function StarCell({
  communityId,
  starred,
  onChange,
}: {
  communityId: string;
  starred: boolean;
  onChange: (value: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !starred;
    setError(null);
    setPending(true);
    onChange(next);
    try {
      const res = await setStarred(communityId, next);
      if (!res.ok) throw new Error(res.message);
    } catch (err) {
      onChange(!next);
      setError(err instanceof Error ? err.message : "Couldn’t update.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!pending) void toggle();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
        }
      }}
      aria-pressed={starred}
      aria-label={starred ? "Unstar community" : "Star community"}
      title={
        error ??
        (starred ? "Featured on the home page" : "Mark as featured")
      }
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        starred
          ? "text-amber-500 hover:bg-amber-500/10"
          : "text-muted hover:bg-surface hover:text-foreground"
      } ${pending ? "opacity-60" : ""}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={starred ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.2L12 17.8l-5.4 2.7 1-6.2L3.2 10l6.1-.9L12 3.5z" />
      </svg>
    </button>
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
      <Image
        src={publicUrl}
        alt=""
        width={64}
        height={48}
        sizes="64px"
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
