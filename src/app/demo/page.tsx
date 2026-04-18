import { TodoList } from "@/components/TodoList";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: todos, error } = await supabase
    .from("todos")
    .select("id, title, is_complete, inserted_at")
    .order("inserted_at", { ascending: false })
    .limit(20);

  const hasEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Classic Communities
        </h1>
        <p className="text-sm text-muted">
          Next.js 15 + Supabase starter. The list below is live data from
          your <code className="font-mono">public.todos</code> table.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Todos</h2>
          <ConnectionBadge ok={hasEnv && !error} />
        </div>

        {!hasEnv ? (
          <EmptyState
            title="Supabase env vars not set"
            body={
              <>
                Copy <code className="font-mono">.env.local.example</code>{" "}
                to <code className="font-mono">.env.local</code> and fill
                in <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
                and{" "}
                <code className="font-mono">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </code>
                .
              </>
            }
          />
        ) : error ? (
          <EmptyState
            title="Could not reach Supabase"
            body={
              <>
                <span className="block">{error.message}</span>
                <span className="mt-2 block text-xs">
                  If the table doesn&apos;t exist yet, run the SQL snippet
                  from the README in the Supabase SQL editor.
                </span>
              </>
            }
          />
        ) : (
          <TodoList todos={todos ?? []} />
        )}
      </section>
    </main>
  );
}

function ConnectionBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs " +
        (ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400")
      }
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " +
          (ok ? "bg-emerald-500" : "bg-amber-500")
        }
      />
      {ok ? "Connected to Supabase" : "Not connected"}
    </span>
  );
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 text-sm">
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-muted">{body}</div>
    </div>
  );
}
