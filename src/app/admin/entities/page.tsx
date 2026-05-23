import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { EntitiesTable } from "./EntitiesTable";
import type { EntityRow } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminEntitiesPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entities")
    .select("id, name, created_at, updated_at")
    .order("name", { ascending: true });

  const entities: EntityRow[] = data ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Entities</h1>
          <p className="text-sm text-muted">
            Legal entities tracked by Classic. {entities.length}{" "}
            {entities.length === 1 ? "entity" : "entities"} total.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error loading entities: {error.message}
        </p>
      ) : (
        <EntitiesTable initialEntities={entities} />
      )}
    </div>
  );
}
