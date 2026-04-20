import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminUser = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "admin")
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true, nullsFirst: false });

  const admins: AdminUser[] = (data ?? []).map((admin) => ({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted">
          {admins.length} {admins.length === 1 ? "admin" : "admins"} total.
        </p>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error loading admins: {error.message}
        </p>
      ) : admins.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm text-muted">No admin users found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-t border-border">
                  <td className="px-4 py-3 align-middle">
                    {admin.full_name?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {admin.email?.trim() || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
