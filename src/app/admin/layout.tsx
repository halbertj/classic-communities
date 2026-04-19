import Link from "next/link";

import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAdmin();

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/admin/communities" className="font-semibold tracking-wide">
            Classic Communities Admin
          </Link>
          <Link
            href="/admin/communities"
            className="text-muted hover:text-foreground"
          >
            Communities
          </Link>
        </nav>
        <form action="/sign-out" method="POST" className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">
            {profile.email}
          </span>
          <button
            type="submit"
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-background"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="flex-1 bg-background px-6 py-8">{children}</main>
    </div>
  );
}
