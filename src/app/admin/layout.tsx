import Image from "next/image";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";

import { AdminSidebar } from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <Link
          href="/admin/communities"
          aria-label="Classic Communities admin home"
          className="flex items-center"
        >
          <Image
            src="/logoblue.svg"
            alt="Classic Communities"
            width={776}
            height={88}
            priority
            className="h-6 w-auto"
          />
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <form action="/sign-out" method="POST">
            <button
              type="submit"
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-background"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 bg-background px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
