"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slugify";

import {
  addCommunityPhotos,
  removeCommunityPhoto,
  reorderCommunityPhotos,
  updateCommunity,
  type CommunityPhotoRow,
  type UpdateCommunityState,
} from "./actions";
import { AddressAutocomplete } from "./AddressAutocomplete";
import type { CommunityWithAddress } from "./types";

const INITIAL: UpdateCommunityState = { status: "idle" };

// Custom mime type used during in-grid photo reorder drags so the outer
// drop zone (which checks `dataTransfer.types.includes("Files")`) ignores
// reorder drags, and our handlers ignore stray OS-file drags.
const REORDER_MIME = "application/x-cc-photo-id";

const COMMUNITY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "— Select type —" },
  { value: "single_family", label: "Single family" },
  { value: "townhome", label: "Townhome" },
  { value: "mixed", label: "Mixed" },
];

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export function EditCommunityDrawer({
  community,
  onClose,
}: {
  community: CommunityWithAddress;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(updateCommunity, INITIAL);

  // Slug autosync. If the admin has touched the slug field, stop overwriting.
  const [name, setName] = useState(community.name);
  const [slug, setSlug] = useState(community.slug);
  const [slugTouched, setSlugTouched] = useState(false);

  // Cover photo state. Uploads happen directly from the browser to Supabase
  // Storage (bypassing Next.js Server Action body limits). The final path is
  // submitted as a hidden field.
  const [coverPath, setCoverPath] = useState<string | null>(
    community.cover_photo_path,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [coverDragging, setCoverDragging] = useState(false);

  // Site plan state. Site plans are typically PDFs or large images
  // (lot layouts), so they live in a dedicated `community-site-plans`
  // bucket. Same direct-to-Storage upload pattern as the cover photo.
  const [sitePlanPath, setSitePlanPath] = useState<string | null>(
    community.site_plan_path,
  );
  const [sitePlanUploading, setSitePlanUploading] = useState(false);
  const [sitePlanError, setSitePlanError] = useState<string | null>(null);
  const [sitePlanDragging, setSitePlanDragging] = useState(false);

  // Logo state. Logos live in their own `community-logos` bucket so we
  // can later lock down allowed MIME types without impacting the gallery.
  // Same direct-to-Storage upload pattern as cover/site plan.
  const [logoPath, setLogoPath] = useState<string | null>(community.logo_path);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoDragging, setLogoDragging] = useState(false);

  // Gallery photos (the `community_photos` table — separate from the single
  // `cover_photo_path` managed above). Loaded lazily when the drawer opens.
  type PhotoQueueItem = { id: string; name: string };
  const [photos, setPhotos] = useState<CommunityPhotoRow[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photoQueue, setPhotoQueue] = useState<PhotoQueueItem[]>([]);
  const [photosDragging, setPhotosDragging] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Reorder-drag state. `reorderDraggingId` is the photo currently being
  // dragged within the grid. `reorderSnapshotRef` holds the pre-drag order so
  // we can revert optimistic swaps if the server persist fails.
  const [reorderDraggingId, setReorderDraggingId] = useState<string | null>(
    null,
  );
  const reorderSnapshotRef = useRef<CommunityPhotoRow[] | null>(null);

  // Slide-in animation (applies the translate-x-0 on the next frame after
  // mount so the transform actually animates).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // ESC to close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Auto-close after a successful save (server action returns "success").
  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  const fieldErrors =
    state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const supabase = useMemo(() => createClient(), []);

  // Public URL for preview (cover_photo_path stores the Storage key; the
  // bucket is public so getPublicUrl is sync + does not hit the network).
  const coverPreviewUrl = useMemo(() => {
    if (!coverPath) return null;
    const { data } = supabase.storage
      .from("community-photos")
      .getPublicUrl(coverPath);
    return data.publicUrl;
  }, [coverPath, supabase]);

  const sitePlanPreviewUrl = useMemo(() => {
    if (!sitePlanPath) return null;
    const { data } = supabase.storage
      .from("community-site-plans")
      .getPublicUrl(sitePlanPath);
    return data.publicUrl;
  }, [sitePlanPath, supabase]);

  const sitePlanIsPdf = (sitePlanPath ?? "").toLowerCase().endsWith(".pdf");

  const logoPreviewUrl = useMemo(() => {
    if (!logoPath) return null;
    const { data } = supabase.storage
      .from("community-logos")
      .getPublicUrl(logoPath);
    return data.publicUrl;
  }, [logoPath, supabase]);

  async function uploadCoverFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Cover must be an image file.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const extFromName = file.name.split(".").pop()?.toLowerCase();
      const extFromType = file.type.split("/")[1]?.toLowerCase();
      const ext = (extFromName || extFromType || "jpg").replace(
        /[^a-z0-9]/g,
        "",
      );
      const path = `${community.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("community-photos")
        .upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type || undefined,
          upsert: false,
        });
      if (error) throw error;
      setCoverPath(path);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handlePhotoChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    await uploadCoverFile(file);
  }

  // Drag-and-drop onto the cover preview. Same pattern as the site-plan
  // drop zone: filter on `dataTransfer.types` so nested children don't
  // flicker the overlay, and bail entirely if a file upload is in flight.
  function handleCoverDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (uploading) return;
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!coverDragging) setCoverDragging(true);
  }

  function handleCoverDragLeave(event: React.DragEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setCoverDragging(false);
  }

  async function handleCoverDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setCoverDragging(false);
    if (uploading) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadCoverFile(file);
  }

  async function uploadSitePlanFile(file: File) {
    // Site plans are typically higher-fidelity than a cover photo
    // (scanned PDFs, large exports). Cap at 25 MB.
    const tooBig = file.size > 25 * 1024 * 1024;
    if (tooBig) {
      setSitePlanError("Site plan is larger than 25MB — try a smaller file.");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isImage && !isPdf) {
      setSitePlanError("Upload a PDF or image file.");
      return;
    }

    setSitePlanUploading(true);
    setSitePlanError(null);
    try {
      const extFromName = file.name.split(".").pop()?.toLowerCase();
      const extFromType = isPdf ? "pdf" : file.type.split("/")[1]?.toLowerCase();
      const ext = (extFromName || extFromType || "pdf").replace(
        /[^a-z0-9]/g,
        "",
      );
      const path = `${community.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("community-site-plans")
        .upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type || undefined,
          upsert: false,
        });
      if (error) throw error;
      setSitePlanPath(path);
    } catch (err) {
      setSitePlanError(
        err instanceof Error ? err.message : "Upload failed. Try again.",
      );
    } finally {
      setSitePlanUploading(false);
    }
  }

  async function handleSitePlanChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadSitePlanFile(file);
  }

  // Drag-and-drop onto the site-plan preview box. We rely on a small
  // counter via `dataTransfer.types` check so nested children (the
  // <img>/<a>/placeholder) don't cause flicker when the pointer crosses
  // element boundaries inside the drop zone.
  function handleSitePlanDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (sitePlanUploading) return;
    // Only react to OS file drags.
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!sitePlanDragging) setSitePlanDragging(true);
  }

  function handleSitePlanDragLeave(event: React.DragEvent<HTMLDivElement>) {
    // `relatedTarget` is null / outside the drop zone when we've truly left.
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setSitePlanDragging(false);
  }

  async function handleSitePlanDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setSitePlanDragging(false);
    if (sitePlanUploading) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadSitePlanFile(file);
  }

  // --- Logo upload ----------------------------------------------------

  async function uploadLogoFile(file: File) {
    // Accept common raster formats and SVG. SVGs have text/* or
    // image/svg+xml on various browsers, so we allow both and also fall
    // back to the file extension.
    const isImage = file.type.startsWith("image/");
    const isSvg =
      file.type === "image/svg+xml" ||
      file.name.toLowerCase().endsWith(".svg");
    if (!isImage && !isSvg) {
      setLogoError("Logo must be an image (PNG, JPG, SVG, …).");
      return;
    }

    setLogoUploading(true);
    setLogoError(null);
    try {
      const extFromName = file.name.split(".").pop()?.toLowerCase();
      const extFromType = file.type.split("/")[1]?.toLowerCase();
      const ext = (extFromName || extFromType || "png").replace(
        /[^a-z0-9]/g,
        "",
      );
      const path = `${community.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("community-logos")
        .upload(path, file, {
          cacheControl: "31536000",
          contentType: file.type || undefined,
          upsert: false,
        });
      if (error) throw error;
      setLogoPath(path);
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : "Upload failed. Try again.",
      );
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadLogoFile(file);
  }

  function handleLogoDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (logoUploading) return;
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!logoDragging) setLogoDragging(true);
  }

  function handleLogoDragLeave(event: React.DragEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setLogoDragging(false);
  }

  async function handleLogoDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setLogoDragging(false);
    if (logoUploading) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadLogoFile(file);
  }

  // --- Gallery photos -------------------------------------------------

  // Load existing gallery rows when the drawer mounts. The public bucket
  // means we only need paths + ids; URLs are derived client-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("community_photos")
        .select("id, storage_path, display_order, created_at")
        .eq("community_id", community.id)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        setPhotosError(error.message);
        setPhotosLoading(false);
        return;
      }
      setPhotos(
        (data ?? []).map((r) => ({
          id: r.id,
          storage_path: r.storage_path,
          display_order: r.display_order,
        })),
      );
      setPhotosLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [community.id, supabase]);

  function publicPhotoUrl(path: string) {
    return supabase.storage.from("community-photos").getPublicUrl(path).data
      .publicUrl;
  }

  async function uploadPhotoFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const valid: File[] = [];
    const invalid: string[] = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        invalid.push(`${f.name}: not an image`);
        continue;
      }
      if (f.size > 15 * 1024 * 1024) {
        invalid.push(`${f.name}: over 15MB`);
        continue;
      }
      valid.push(f);
    }

    if (invalid.length > 0) {
      setPhotosError(invalid.join(" · "));
    } else {
      setPhotosError(null);
    }
    if (valid.length === 0) return;

    // Queue placeholders so the grid shows uploading tiles immediately.
    const queueItems: PhotoQueueItem[] = valid.map((f, i) => ({
      id: `q-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
    }));
    setPhotoQueue((prev) => [...prev, ...queueItems]);

    // Upload files in parallel directly to Storage. Each file gets a unique
    // key so we never collide with the cover photo or other uploads.
    const uploads = await Promise.all(
      valid.map(async (file, i) => {
        try {
          const extFromName = file.name.split(".").pop()?.toLowerCase();
          const extFromType = file.type.split("/")[1]?.toLowerCase();
          const ext = (extFromName || extFromType || "jpg").replace(
            /[^a-z0-9]/g,
            "",
          );
          const path = `${community.id}/gallery/${Date.now()}-${i}-${Math.random()
            .toString(36)
            .slice(2, 8)}.${ext}`;
          const { error } = await supabase.storage
            .from("community-photos")
            .upload(path, file, {
              cacheControl: "31536000",
              contentType: file.type || undefined,
              upsert: false,
            });
          if (error) throw error;
          return { ok: true as const, path, queueId: queueItems[i].id };
        } catch (err) {
          return {
            ok: false as const,
            queueId: queueItems[i].id,
            name: file.name,
            message: err instanceof Error ? err.message : "Upload failed",
          };
        }
      }),
    );

    const uploadedPaths = uploads.filter((u) => u.ok).map((u) => u.path);

    if (uploadedPaths.length > 0) {
      const res = await addCommunityPhotos(community.id, uploadedPaths);
      if (res.ok) {
        setPhotos((prev) =>
          [...prev, ...res.rows].sort(
            (a, b) => a.display_order - b.display_order,
          ),
        );
      } else {
        setPhotosError(res.message);
      }
    }

    // Drop finished items from the queue.
    const finishedIds = new Set(uploads.map((u) => u.queueId));
    setPhotoQueue((prev) => prev.filter((q) => !finishedIds.has(q.id)));

    const failures = uploads.filter((u) => !u.ok);
    if (failures.length > 0) {
      setPhotosError(
        failures
          .map((f) => (f.ok ? "" : `${f.name}: ${f.message}`))
          .filter(Boolean)
          .join(" · "),
      );
    }
  }

  async function handlePhotoInputChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = event.target.files;
    event.target.value = "";
    if (!files || files.length === 0) return;
    await uploadPhotoFiles(files);
  }

  function handlePhotosDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!photosDragging) setPhotosDragging(true);
  }

  function handlePhotosDragLeave(event: React.DragEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setPhotosDragging(false);
  }

  async function handlePhotosDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setPhotosDragging(false);
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    await uploadPhotoFiles(files);
  }

  async function handleRemovePhoto(id: string) {
    // Optimistic removal.
    const snapshot = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const res = await removeCommunityPhoto(id);
    if (!res.ok) {
      setPhotos(snapshot);
      setPhotosError(res.message);
    }
  }

  // --- Reorder photos via drag-and-drop ------------------------------
  //
  // Strategy: as the user drags a thumbnail over another, we optimistically
  // splice the dragged photo into the target's index in local state so the
  // grid animates live. On drop we persist the new order; if the server
  // rejects we restore the snapshot captured at dragStart.

  function handlePhotoDragStart(
    event: React.DragEvent<HTMLLIElement>,
    id: string,
  ) {
    reorderSnapshotRef.current = photos;
    setReorderDraggingId(id);
    event.dataTransfer.effectAllowed = "move";
    // Value is ignored; the *presence* of the mime type is what our handlers
    // key off to distinguish reorder drags from OS-file drags.
    event.dataTransfer.setData(REORDER_MIME, id);
  }

  function handlePhotoDragOver(event: React.DragEvent<HTMLLIElement>) {
    if (!event.dataTransfer.types.includes(REORDER_MIME)) return;
    event.preventDefault();
    // Don't let this drag bubble to the outer drop zone, which otherwise
    // flashes its "Drop to upload" overlay for file drags.
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  }

  function handlePhotoDragEnter(
    event: React.DragEvent<HTMLLIElement>,
    overId: string,
  ) {
    if (!event.dataTransfer.types.includes(REORDER_MIME)) return;
    if (!reorderDraggingId || reorderDraggingId === overId) return;
    event.preventDefault();
    event.stopPropagation();
    setPhotos((prev) => {
      const fromIdx = prev.findIndex((p) => p.id === reorderDraggingId);
      const toIdx = prev.findIndex((p) => p.id === overId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const next = prev.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  async function handlePhotoDrop(event: React.DragEvent<HTMLLIElement>) {
    if (!event.dataTransfer.types.includes(REORDER_MIME)) return;
    event.preventDefault();
    event.stopPropagation();

    const snapshot = reorderSnapshotRef.current;
    reorderSnapshotRef.current = null;
    setReorderDraggingId(null);

    const orderedIds = photos.map((p) => p.id);
    // No-op if the drop landed in the original position.
    if (
      snapshot &&
      snapshot.length === orderedIds.length &&
      snapshot.every((p, i) => p.id === orderedIds[i])
    ) {
      return;
    }

    const res = await reorderCommunityPhotos(community.id, orderedIds);
    if (!res.ok) {
      if (snapshot) setPhotos(snapshot);
      setPhotosError(res.message);
    } else {
      setPhotosError(null);
    }
  }

  function handlePhotoDragEnd() {
    // Fires on the source element regardless of where the drop happened
    // (or if it was cancelled). If a drop handler already cleared the
    // snapshot, this is a no-op; otherwise we revert.
    if (reorderSnapshotRef.current) {
      setPhotos(reorderSnapshotRef.current);
      reorderSnapshotRef.current = null;
    }
    setReorderDraggingId(null);
  }

  const addr = community.address;

  // Address fields are controlled so the autocomplete on the street line can
  // fan out and populate the rest of the form (city/state/zip/lat/lng) when
  // the admin picks a Mapbox suggestion.
  const [line1, setLine1] = useState(addr?.line1 ?? "");
  const [line2, setLine2] = useState(addr?.line2 ?? "");
  const [city, setCity] = useState(addr?.city ?? "");
  const [stateField, setStateField] = useState(addr?.state ?? "");
  const [postalCode, setPostalCode] = useState(addr?.postal_code ?? "");
  const [country, setCountry] = useState(addr?.country ?? "US");
  const [latitude, setLatitude] = useState(
    addr?.latitude != null ? String(addr.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    addr?.longitude != null ? String(addr.longitude) : "",
  );

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${community.name}`}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-xl transform flex-col overflow-y-auto bg-background shadow-2xl transition-transform duration-300 ease-out ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[3px] text-muted">
              Edit community
            </p>
            <h2 className="truncate text-lg font-semibold">{community.name}</h2>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`/communities/${community.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open public page in new tab"
              title="Open public page"
              className="rounded-full p-2 text-muted hover:bg-surface hover:text-foreground"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
              >
                <path
                  d="M11 3h6v6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17 3l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 11v4a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 text-muted hover:bg-surface hover:text-foreground"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
              >
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </header>

        <form
          action={formAction}
          className="flex flex-1 flex-col gap-8 px-6 py-6"
        >
          <input type="hidden" name="id" value={community.id} />
          <input
            type="hidden"
            name="cover_photo_path"
            value={coverPath ?? ""}
          />
          <input
            type="hidden"
            name="site_plan_path"
            value={sitePlanPath ?? ""}
          />
          <input
            type="hidden"
            name="logo_path"
            value={logoPath ?? ""}
          />

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Cover photo
            </h3>
            <div
              onDragEnter={handleCoverDragOver}
              onDragOver={handleCoverDragOver}
              onDragLeave={handleCoverDragLeave}
              onDrop={handleCoverDrop}
              className={`relative overflow-hidden rounded-lg border bg-surface transition-colors ${
                coverDragging
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border"
              }`}
            >
              {coverPreviewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={coverPreviewUrl}
                  alt=""
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 w-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-muted">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="text-muted"
                  >
                    <path
                      d="M12 16V4m0 0l-4 4m4-4l4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>No photo yet</span>
                  <span className="text-xs text-muted">
                    Drag an image here, or use the button below.
                  </span>
                </div>
              )}
              {coverDragging && !uploading && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/10 text-sm font-medium text-primary"
                >
                  Drop to upload
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
                  Uploading…
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="cursor-pointer rounded border border-border px-3 py-1.5 hover:bg-surface">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={uploading}
                />
                {coverPath ? "Replace photo" : "Upload photo"}
              </label>
              {coverPath && (
                <button
                  type="button"
                  onClick={() => setCoverPath(null)}
                  className="text-muted hover:text-red-600"
                >
                  Remove
                </button>
              )}
              {uploadError && (
                <span className="text-xs text-red-600" role="alert">
                  {uploadError}
                </span>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Site plan
            </h3>
            <div
              onDragEnter={handleSitePlanDragOver}
              onDragOver={handleSitePlanDragOver}
              onDragLeave={handleSitePlanDragLeave}
              onDrop={handleSitePlanDrop}
              className={`relative overflow-hidden rounded-lg border bg-surface transition-colors ${
                sitePlanDragging
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border"
              }`}
            >
              {sitePlanPreviewUrl ? (
                sitePlanIsPdf ? (
                  <a
                    href={sitePlanPreviewUrl}
                    className="flex h-48 w-full items-center justify-center gap-3 px-4 text-sm text-foreground hover:bg-surface/80"
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M14 3v5h5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span className="font-medium">Open site plan (PDF)</span>
                  </a>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={sitePlanPreviewUrl}
                    alt=""
                    className="h-48 w-full object-contain"
                  />
                )
              ) : (
                <div className="flex h-48 w-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-muted">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="text-muted"
                  >
                    <path
                      d="M12 16V4m0 0l-4 4m4-4l4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>No site plan yet</span>
                  <span className="text-xs text-muted">
                    Drag a PDF or image here, or use the button below.
                  </span>
                </div>
              )}
              {sitePlanDragging && !sitePlanUploading && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/10 text-sm font-medium text-primary"
                >
                  Drop to upload
                </div>
              )}
              {sitePlanUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
                  Uploading…
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="cursor-pointer rounded border border-border px-3 py-1.5 hover:bg-surface">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleSitePlanChange}
                  disabled={sitePlanUploading}
                />
                {sitePlanPath ? "Replace site plan" : "Upload site plan"}
              </label>
              {sitePlanPath && (
                <button
                  type="button"
                  onClick={() => setSitePlanPath(null)}
                  className="text-muted hover:text-red-600"
                >
                  Remove
                </button>
              )}
              <span className="text-xs text-muted">PDF or image, up to 25MB.</span>
              {sitePlanError && (
                <span className="text-xs text-red-600" role="alert">
                  {sitePlanError}
                </span>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Logo
            </h3>
            <div
              onDragEnter={handleLogoDragOver}
              onDragOver={handleLogoDragOver}
              onDragLeave={handleLogoDragLeave}
              onDrop={handleLogoDrop}
              className={`relative overflow-hidden rounded-lg border bg-surface transition-colors ${
                logoDragging
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border"
              }`}
            >
              {logoPreviewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logoPreviewUrl}
                  alt=""
                  className="h-40 w-full object-contain p-4"
                />
              ) : (
                <div className="flex h-40 w-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-muted">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="text-muted"
                  >
                    <path
                      d="M12 16V4m0 0l-4 4m4-4l4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>No logo yet</span>
                  <span className="text-xs text-muted">
                    Drag an image here, or use the button below.
                  </span>
                </div>
              )}
              {logoDragging && !logoUploading && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/10 text-sm font-medium text-primary"
                >
                  Drop to upload
                </div>
              )}
              {logoUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
                  Uploading…
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="cursor-pointer rounded border border-border px-3 py-1.5 hover:bg-surface">
                <input
                  type="file"
                  accept="image/*,.svg"
                  className="hidden"
                  onChange={handleLogoChange}
                  disabled={logoUploading}
                />
                {logoPath ? "Replace logo" : "Upload logo"}
              </label>
              {logoPath && (
                <button
                  type="button"
                  onClick={() => setLogoPath(null)}
                  className="text-muted hover:text-red-600"
                >
                  Remove
                </button>
              )}
              <span className="text-xs text-muted">PNG, JPG, or SVG.</span>
              {logoError && (
                <span className="text-xs text-red-600" role="alert">
                  {logoError}
                </span>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Photos
              </h3>
              <span className="text-xs text-muted">
                {photos.length + photoQueue.length}{" "}
                {photos.length + photoQueue.length === 1 ? "photo" : "photos"}
              </span>
            </div>

            <div
              onDragEnter={handlePhotosDragOver}
              onDragOver={handlePhotosDragOver}
              onDragLeave={handlePhotosDragLeave}
              onDrop={handlePhotosDrop}
              onClick={() => photoInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                // Only react when the drop zone itself has focus — not when a
                // nested thumbnail's remove button fires Enter/Space.
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  photoInputRef.current?.click();
                }
              }}
              aria-label="Add photos"
              className={`relative cursor-pointer rounded-lg border-2 border-dashed bg-surface p-3 transition-colors ${
                photosDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              {photosLoading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted">
                  Loading photos…
                </div>
              ) : photos.length === 0 && photoQueue.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center gap-1 text-center text-sm text-muted">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M12 16V4m0 0l-4 4m4-4l4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Drag photos here</span>
                  <span className="text-xs">
                    or click to choose — you can select multiple
                  </span>
                </div>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((p) => (
                    <li
                      key={p.id}
                      draggable
                      onDragStart={(e) => handlePhotoDragStart(e, p.id)}
                      onDragOver={handlePhotoDragOver}
                      onDragEnter={(e) => handlePhotoDragEnter(e, p.id)}
                      onDrop={handlePhotoDrop}
                      onDragEnd={handlePhotoDragEnd}
                      className={`group relative aspect-square cursor-grab overflow-hidden rounded-md border border-border bg-background transition-opacity active:cursor-grabbing ${
                        reorderDraggingId === p.id ? "opacity-40" : ""
                      }`}
                    >
                      {/* `draggable={false}` on the <img> so the native image
                          drag (which would fire on the img itself) doesn't
                          preempt the <li>'s reorder drag. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={publicPhotoUrl(p.storage_path)}
                        alt=""
                        draggable={false}
                        className="h-full w-full select-none object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemovePhoto(p.id);
                        }}
                        aria-label="Remove photo"
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus:opacity-100 group-hover:opacity-100"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M3 3l6 6M9 3L3 9"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                  {photoQueue.map((q) => (
                    <li
                      key={q.id}
                      className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-background"
                      title={q.name}
                    >
                      <svg
                        className="h-5 w-5 animate-spin text-muted"
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
                    </li>
                  ))}
                </ul>
              )}

              {photosDragging && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-primary/10 text-sm font-medium text-primary"
                >
                  Drop to upload
                </div>
              )}
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoInputChange}
            />

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <span>
                Images up to 15MB each. Drop multiple at once — drag
                thumbnails to reorder.
              </span>
              {photosError && (
                <span className="text-red-600" role="alert">
                  {photosError}
                </span>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Basics
            </h3>
            <Field label="Name" error={fieldErrors.name}>
              <input
                name="name"
                required
                value={name}
                onChange={(e) => {
                  const next = e.target.value;
                  setName(next);
                  if (!slugTouched) setSlug(slugify(next));
                }}
                className={inputCls}
              />
            </Field>

            <Field
              label="Slug"
              hint="URL path, e.g. /communities/silver-creek"
              error={fieldErrors.slug}
            >
              <input
                name="slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Type" error={fieldErrors.community_type}>
                <select
                  name="community_type"
                  defaultValue={community.community_type ?? ""}
                  className={inputCls}
                >
                  {COMMUNITY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="hidden sm:block" />

              <Field label="Date started" error={fieldErrors.date_started}>
                <input
                  type="date"
                  name="date_started"
                  defaultValue={community.date_started ?? ""}
                  className={inputCls}
                />
              </Field>

              <Field label="Date completed" error={fieldErrors.date_completed}>
                <input
                  type="date"
                  name="date_completed"
                  defaultValue={community.date_completed ?? ""}
                  className={inputCls}
                />
              </Field>

              <Field
                label="Number of homes"
                error={fieldErrors.num_homes}
                hint="Total homes built in this community."
              >
                <input
                  type="number"
                  name="num_homes"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={community.num_homes ?? ""}
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Address
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Street address"
                error={fieldErrors.line1}
                hint="Start typing to search — pick a result to fill the rest."
              >
                <AddressAutocomplete
                  name="line1"
                  required
                  value={line1}
                  onChange={setLine1}
                  onAutofill={(f) => {
                    setLine1(f.line1);
                    if (f.city) setCity(f.city);
                    if (f.state) setStateField(f.state);
                    if (f.postal_code) setPostalCode(f.postal_code);
                    if (f.country) setCountry(f.country);
                    if (f.latitude) setLatitude(f.latitude);
                    if (f.longitude) setLongitude(f.longitude);
                  }}
                  country={country || "us"}
                  className={inputCls}
                />
              </Field>

              <Field label="Apt, suite, etc." error={fieldErrors.line2}>
                <input
                  name="line2"
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="City" error={fieldErrors.city}>
                <input
                  name="city"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="State" error={fieldErrors.state}>
                <input
                  name="state"
                  required
                  value={stateField}
                  onChange={(e) => setStateField(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Postal code" error={fieldErrors.postal_code}>
                <input
                  name="postal_code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field label="Country" error={fieldErrors.country}>
                <input
                  name="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field
                label="Latitude"
                hint="-90 to 90"
                error={fieldErrors.latitude}
              >
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field
                label="Longitude"
                hint="-180 to 180"
                error={fieldErrors.longitude}
              >
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          {state.status === "error" && !state.fieldErrors && (
            <p
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {state.message}
            </p>
          )}

          <footer className="sticky bottom-0 -mx-6 mt-auto flex items-center justify-end gap-3 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <SubmitButton disabled={uploading || sitePlanUploading} />
          </footer>
        </form>
      </aside>
    </>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
