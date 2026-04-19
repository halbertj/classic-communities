import Link from "next/link";

import { getSession } from "@/lib/auth";

/**
 * Site-wide footer.
 *
 * Hosts the auth controls (Sign in / Sign out / Admin) at the very bottom of
 * the page. These are effectively private — the public site is a memorial,
 * and only the owner needs to sign in — so we keep them out of the top nav
 * and tuck them here instead.
 */
export async function SiteFooter() {
  const session = await getSession();
  const isAdmin = session?.profile.role === "admin";

  // Shared typography for every control in the footer nav. Applied directly
  // to the <a>/<button> so the native <button> element inherits the same
  // font, size, and baseline as the <Link> (browsers don't always let
  // buttons inherit these from an ancestor) and the two stay visually
  // identical.
  const linkClass =
    "inline-flex items-center bg-transparent p-0 font-sans text-[11px] font-normal uppercase leading-none tracking-[3px] text-muted transition-colors duration-150 hover:text-foreground";

  return (
    <footer className="border-t border-border bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-[11px] uppercase leading-none tracking-[3px] text-muted">
          © {new Date().getFullYear()} Classic Communities
        </p>
        <nav className="flex items-center gap-6">
          {session ? (
            <>
              {isAdmin && (
                <Link href="/admin/communities" className={linkClass}>
                  Admin
                </Link>
              )}
              {/* `contents` removes the form from layout so the <button>
                  participates in the nav's flex row directly — otherwise the
                  form wrapper throws the button's baseline off from the
                  Admin link next to it. */}
              <form action="/sign-out" method="POST" className="contents">
                <button type="submit" className={linkClass}>
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/sign-in" className={linkClass}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </footer>
  );
}
