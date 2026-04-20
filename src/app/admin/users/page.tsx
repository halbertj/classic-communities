import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { UsersTable, type UsersTableRow } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true, nullsFirst: false });

  const users: UsersTableRow[] = (data ?? []).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role === "admin" ? "admin" : "user",
  }));

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted">
          {users.length} {users.length === 1 ? "user" : "users"} total ·{" "}
          {adminCount} {adminCount === 1 ? "admin" : "admins"}.
        </p>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error loading users: {error.message}
        </p>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm text-muted">No users found.</p>
        </div>
      ) : (
        <UsersTable users={users} currentUserId={session.user.id} />
      )}
    </div>
  );
}
