"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { archiveCommunity, setStarred } from "./actions";
import { ArchiveDialog } from "./ArchiveDialog";
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
  const [query, setQuery] = useState("");

  // Simple case-insensitive substring match across the columns a viewer
  // can reasonably expect to search: name, slug, city, state.
  const visibleCommunities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => {
      const city = c.address?.city ?? "";
      const state = c.address?.state ?? "";
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        city.toLowerCase().includes(q) ||
        state.toLowerCase().includes(q)
      );
    });
  }, [communities, query]);

  // Optimistic overrides for the inline star toggle so the button can
  // flip instantly without waiting for a server round-trip.
  const [starredOverrides, setStarredOverrides] = useState<
    Record<string, boolean>
  >({});

  // Same pattern for archive/unarchive. Archived rows stay in the table
  // (muted) so admins can restore them.
  const [archivedOverrides, setArchivedOverrides] = useState<
    Record<string, boolean>
  >({});

  // Which community (if any) is showing the archive confirmation dialog.
  const [archiveTarget, setArchiveTarget] =
    useState<CommunityWithAddress | null>(null);

  const effectiveStarred = (c: CommunityWithAddress): boolean =>
    c.id in starredOverrides ? starredOverrides[c.id] : c.starred;

  const effectiveArchived = (c: CommunityWithAddress): boolean =>
    c.id in archivedOverrides ? archivedOverrides[c.id] : c.archived;

  const selected = selectedId
    ? (() => {
        const base = communities.find((c) => c.id === selectedId);
        if (!base) return null;
        return {
          ...base,
          starred: effectiveStarred(base),
          archived: effectiveArchived(base),
        };
      })()
    : null;

  async function handleSetArchived(id: string, archived: boolean) {
    const prev = archivedOverrides[id];
    setArchivedOverrides((p) => ({ ...p, [id]: archived }));
    const res = await archiveCommunity(id, archived);
    if (!res.ok) {
      setArchivedOverrides((p) => ({
        ...p,
        [id]: prev ?? !archived,
      }));
      throw new Error(res.message);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          >
            <circle
              cx="9"
              cy="9"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="m14 14 3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, slug, city, state…"
            aria-label="Search communities"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {query && (
          <span className="text-xs text-muted tabular-nums">
            {visibleCommunities.length} of {communities.length}
          </span>
        )}
      </div>

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
            <col style={{ width: 48 }} />
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
              <th className="px-2 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleCommunities.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-muted"
                >
                  No communities match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
            {visibleCommunities.map((c) => {
              const archived = effectiveArchived(c);
              return (
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
                  className={`cursor-pointer border-t border-border outline-none transition-colors hover:bg-surface focus:bg-surface focus:ring-1 focus:ring-inset focus:ring-primary/40 ${
                    archived ? "bg-surface/40 text-muted" : ""
                  }`}
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
                    <div className={archived ? "opacity-50" : ""}>
                      <CoverCell coverPath={c.cover_photo_path} />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {archived && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                          Archived
                        </span>
                      )}
                    </div>
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
                  <td className="px-2 py-2 align-middle">
                    <RowMenu
                      community={c}
                      archived={archived}
                      onEdit={() => setSelectedId(c.id)}
                      onArchive={() => setArchiveTarget(c)}
                      onUnarchive={async () => {
                        try {
                          await handleSetArchived(c.id, false);
                        } catch {
                          /* error bubbles via alert elsewhere; menu just
                             closes so the admin can retry */
                        }
                      }}
                    />
                  </td>
                </tr>
              );
            })}
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

      {archiveTarget && (
        <ArchiveDialog
          communityName={archiveTarget.name}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={async () => {
            await handleSetArchived(archiveTarget.id, true);
            setArchiveTarget(null);
          }}
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
 * Read-only thumbnail for the community's cover. The cover is whichever
 * photo sits first in the gallery (or the legacy `cover_photo_path` for
 * communities that haven't uploaded a gallery yet). To change it, the
 * admin opens the drawer and reorders / uploads photos.
 */
/**
 * Per-row actions menu (the trailing ⋮ button).
 *
 *   - Edit — opens the edit drawer (same as clicking the row).
 *   - View — opens the public community detail page in a new tab.
 *   - Archive / Restore — archive triggers a double-confirmation
 *     dialog, restore is a single click.
 *
 * Click + keyboard handlers all `stopPropagation` so interacting with the
 * menu never also bubbles up to the row and opens the drawer.
 */
function RowMenu({
  community,
  archived,
  onEdit,
  onArchive,
  onUnarchive,
}: {
  community: CommunityWithAddress;
  archived: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / ESC.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="relative" onClick={stop} onKeyDown={stop}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${community.name}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground ${
          open ? "bg-surface text-foreground" : ""
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="4" r="1.5" fill="currentColor" />
          <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          <circle cx="10" cy="16" r="1.5" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-md border border-border bg-background shadow-lg"
        >
          <MenuItem
            onSelect={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </MenuItem>
          <MenuItem
            as={Link}
            href={`/communities/${community.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            onSelect={() => setOpen(false)}
          >
            <span className="flex items-center justify-between gap-2">
              View public page
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                className="text-muted"
              >
                <path
                  d="M4 2h6v6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 2L5 7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <path
                  d="M8 7v3H2V4h3"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </MenuItem>
          <div className="my-1 h-px bg-border" />
          {archived ? (
            <MenuItem
              onSelect={async () => {
                setOpen(false);
                await onUnarchive();
              }}
            >
              Restore
            </MenuItem>
          ) : (
            <MenuItem
              danger
              onSelect={() => {
                setOpen(false);
                onArchive();
              }}
            >
              Archive…
            </MenuItem>
          )}
        </div>
      )}
    </div>
  );
}

type MenuItemBaseProps = {
  children: React.ReactNode;
  danger?: boolean;
  onSelect: () => void | Promise<void>;
};

type MenuItemProps =
  | (MenuItemBaseProps & { as?: undefined })
  | (MenuItemBaseProps & {
      as: typeof Link;
      href: string;
      target?: string;
      rel?: string;
    });

/** Shared menu-item styling so Link and button variants match. */
function MenuItem(props: MenuItemProps) {
  const classes = `block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-surface focus:bg-surface focus:outline-none ${
    props.danger ? "text-red-600" : "text-foreground"
  }`;

  if ("as" in props && props.as === Link) {
    return (
      <Link
        role="menuitem"
        href={props.href}
        target={props.target}
        rel={props.rel}
        onClick={(e) => {
          e.stopPropagation();
          void props.onSelect();
        }}
        className={classes}
      >
        {props.children}
      </Link>
    );
  }

  return (
    <button
      role="menuitem"
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void props.onSelect();
      }}
      className={classes}
    >
      {props.children}
    </button>
  );
}

function CoverCell({ coverPath }: { coverPath: string | null }) {
  const supabase = useMemo(() => createClient(), []);

  const publicUrl = useMemo(() => {
    if (!coverPath) return null;
    const { data } = supabase.storage
      .from("community-photos")
      .getPublicUrl(coverPath);
    return data.publicUrl;
  }, [coverPath, supabase]);

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
      aria-hidden
      title="No photo yet — add one in the drawer"
      className="flex h-12 w-16 items-center justify-center rounded-md border border-dashed border-border bg-surface text-muted"
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d="M4 16l4-5 3 4 3-3 6 7M4 7h16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
