"use client";

import { useMemo, useState } from "react";

import { setUserRole, type UserRole } from "./actions";

export type UsersTableRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
};

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UsersTableRow[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = u.full_name ?? "";
      const email = u.email ?? "";
      return (
        name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, query]);

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
            placeholder="Search name, email, role…"
            aria-label="Search users"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {query && (
          <span className="text-xs text-muted tabular-nums">
            {visibleUsers.length} of {users.length}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <colgroup>
            <col />
            <col />
            <col style={{ width: 160 }} />
          </colgroup>
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-10 text-center text-sm text-muted"
                >
                  {query
                    ? `No users match “${query}”.`
                    : "No users yet."}
                </td>
              </tr>
            )}
            {visibleUsers.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 align-middle">
                  {u.full_name?.trim() || "—"}
                </td>
                <td className="px-4 py-3 align-middle">
                  {u.email?.trim() || "—"}
                </td>
                <td className="px-4 py-3 align-middle">
                  <RoleSelect
                    userId={u.id}
                    role={u.role}
                    disabled={u.id === currentUserId}
                    disabledReason="You can’t change your own role."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Inline role dropdown. Flips optimistically, calls the server action,
 * and reverts + surfaces the error (via `title`) if the mutation fails.
 *
 * Disabled for the current admin so they can't accidentally demote
 * themselves — the server action enforces the same rule, this is just
 * the UI affordance.
 */
function RoleSelect({
  userId,
  role,
  disabled,
  disabledReason,
}: {
  userId: string;
  role: UserRole;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [current, setCurrent] = useState<UserRole>(role);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: UserRole) {
    if (next === current) return;
    const prev = current;
    setError(null);
    setPending(true);
    setCurrent(next);
    try {
      const res = await setUserRole(userId, next);
      if (!res.ok) throw new Error(res.message);
    } catch (err) {
      setCurrent(prev);
      setError(err instanceof Error ? err.message : "Couldn’t update role.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        disabled={disabled || pending}
        onChange={(e) => void handleChange(e.target.value as UserRole)}
        aria-label="Change role"
        title={disabled ? disabledReason : error ?? undefined}
        className={`h-8 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        } ${pending ? "opacity-60" : ""}`}
      >
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      {error && (
        <span
          role="alert"
          className="text-xs text-red-600"
          title={error}
        >
          Error
        </span>
      )}
    </div>
  );
}
