"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createEntity,
  deleteEntity,
  renameEntity,
  type EntityRow,
} from "./actions";

/**
 * Inline-editable list of legal entities.
 *
 * - Add: name input + button at the top. Submit clears the field and
 *   prepends the new row.
 * - Rename: click the name cell to enter edit mode; Enter to save,
 *   Esc to cancel. Optimistic — reverts on server error.
 * - Delete: trash button with a click-once-to-confirm pattern (a
 *   second click within 3s actually performs the delete) so admins
 *   don't lose rows to stray clicks.
 *
 * Designed to grow: as we add columns (EIN, formation state, …) this
 * file gains cells, not a different component.
 */
export function EntitiesTable({
  initialEntities,
}: {
  initialEntities: EntityRow[];
}) {
  const [entities, setEntities] = useState<EntityRow[]>(initialEntities);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter((e) => e.name.toLowerCase().includes(q));
  }, [entities, query]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            placeholder="Search entities…"
            aria-label="Search entities"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {query && (
          <span className="text-xs text-muted tabular-nums">
            {visible.length} of {entities.length}
          </span>
        )}
      </div>

      <CreateEntityRow
        onCreated={(entity) =>
          setEntities((prev) => sortByName([entity, ...prev]))
        }
      />

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <colgroup>
            <col />
            <col style={{ width: 64 }} />
          </colgroup>
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-2 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-10 text-center text-sm text-muted"
                >
                  {query
                    ? `No entities match “${query}”.`
                    : "No entities yet. Add one above."}
                </td>
              </tr>
            )}
            {visible.map((e) => (
              <EntityRowView
                key={e.id}
                entity={e}
                onRename={(updated) =>
                  setEntities((prev) =>
                    sortByName(prev.map((x) => (x.id === updated.id ? updated : x))),
                  )
                }
                onDelete={(id) =>
                  setEntities((prev) => prev.filter((x) => x.id !== id))
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function sortByName(rows: EntityRow[]): EntityRow[] {
  return [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

function CreateEntityRow({
  onCreated,
}: {
  onCreated: (entity: EntityRow) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createEntity(trimmed);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onCreated(res.entity);
      setName("");
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-3 sm:flex-row sm:items-center">
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!pending) submit();
          }
        }}
        placeholder="Add a new entity…"
        aria-label="New entity name"
        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 sm:max-w-sm"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || !name.trim()}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add entity"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}

function EntityRowView({
  entity,
  onRename,
  onDelete,
}: {
  entity: EntityRow;
  onRename: (entity: EntityRow) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entity.name);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Two-click delete confirmation: the first click arms the button,
  // the second within ARM_WINDOW_MS actually performs the delete.
  const [armedToDelete, setArmedToDelete] = useState(false);

  function startEdit() {
    setDraft(entity.name);
    setEditing(true);
    setError(null);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(entity.name);
    setError(null);
  }

  function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    if (trimmed === entity.name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await renameEntity(entity.id, trimmed);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onRename(res.entity);
      setEditing(false);
    });
  }

  function handleDeleteClick() {
    if (!armedToDelete) {
      setArmedToDelete(true);
      window.setTimeout(() => setArmedToDelete(false), 3000);
      return;
    }
    startTransition(async () => {
      const res = await deleteEntity(entity.id);
      if (!res.ok) {
        setError(res.message);
        setArmedToDelete(false);
        return;
      }
      onDelete(entity.id);
    });
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2 align-middle">
        {editing ? (
          <div className="flex flex-col gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              onBlur={() => {
                // Save on blur unless the click was on the cancel/save
                // controls below (which intercept first).
                if (draft.trim() !== entity.name) saveEdit();
                else cancelEdit();
              }}
              disabled={pending}
              aria-label={`Rename ${entity.name}`}
              className="h-8 w-full max-w-md rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {error && (
              <span role="alert" className="text-xs text-red-600">
                {error}
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="block w-full max-w-md truncate rounded px-1 py-1 text-left text-sm font-medium transition-colors hover:bg-surface"
            title="Click to rename"
          >
            {entity.name}
          </button>
        )}
      </td>
      <td className="px-2 py-2 align-middle">
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={pending || editing}
          aria-label={
            armedToDelete
              ? `Click again to confirm deleting ${entity.name}`
              : `Delete ${entity.name}`
          }
          title={
            armedToDelete
              ? "Click again to confirm"
              : "Delete entity"
          }
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${
            armedToDelete
              ? "bg-red-100 text-red-700"
              : "text-muted hover:bg-surface hover:text-red-600"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path
              d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4l.7 8.5A1.5 1.5 0 0 0 7.2 14h1.6a1.5 1.5 0 0 0 1.5-1.5L11 4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
      </td>
    </tr>
  );
}
