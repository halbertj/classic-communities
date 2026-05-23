"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Collapsible sidebar for the admin dashboard.
 *
 * - Open by default on desktop; collapsed state is persisted to
 *   localStorage so it survives reloads / navigation.
 * - When collapsed, only the icons remain — labels are hidden but still
 *   accessible via `aria-label` / `title` tooltips.
 * - Active route is highlighted by matching `pathname` against each
 *   item's `href` prefix (so `/admin/communities/new` keeps the
 *   "Communities" tab lit).
 */
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const STORAGE_KEY = "admin-sidebar-collapsed";

const NAV: NavItem[] = [
  {
    href: "/admin/communities",
    label: "Communities",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M3 9l7-5 7 5v8a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V9z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/entities",
    label: "Entities",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M3 17V7l5-3 5 3v10M13 17V11l4-2v8M3 17h14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M6 10h.01M6 13h.01M9 10h.01M9 13h.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M4 17c.7-3 3.2-5 6-5s5.3 2 6 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  // We default to *collapsed* on the server / first paint so the
  // dashboard opens with maximum content width and the admin can
  // expand the sidebar deliberately. The persisted preference flips
  // back to expanded in the effect below if the user has previously
  // opened the sidebar themselves.
  const [collapsed, setCollapsed] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "0") setCollapsed(false);
    } catch {
      // localStorage may be unavailable (e.g. Safari private mode).
      // Falling back to the default collapsed state is fine.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Same as above — silently ignore.
    }
  }, [collapsed, hydrated]);

  const toggle = () => setCollapsed((c) => !c);

  return (
    <aside
      aria-label="Admin navigation"
      // Sticky so the sidebar (and its bottom collapse button) stays
      // pinned to the viewport even when the main content scrolls past
      // it. `top-[65px]` matches the admin header height (py-4 + the
      // 32px sign-out button + 1px border) so the sidebar begins right
      // below the header, and the height fills the rest of the
      // viewport from there.
      className={`sticky top-[65px] flex h-[calc(100dvh-65px)] shrink-0 flex-col self-start border-r border-border bg-surface transition-[width] duration-200 ease-out ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <nav className="px-2 py-3">
        <ul className="flex flex-col gap-1">
          {NAV.map((item) => {
            // Active when the route is the exact path or a nested route
            // beneath it (e.g. `/admin/communities/new`).
            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`group flex h-9 items-center gap-3 rounded-md px-2 text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted hover:bg-background hover:text-foreground"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center ${
                      isActive ? "text-primary" : "text-muted group-hover:text-foreground"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="truncate font-medium">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom collapse zone.
          The entire strip is clickable so the user can hit anywhere in
          the empty bottom area to expand/collapse — not just the small
          chevron. `cursor-ew-resize` gives the double-arrow affordance
          on hover, signaling that the sidebar resizes from here. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`flex w-full flex-1 cursor-ew-resize items-end border-t border-border px-2 pb-2 pt-3 text-muted transition-colors hover:text-foreground ${
          collapsed ? "justify-center" : "justify-end"
        }`}
      >
        <span className="flex h-8 w-8 items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path
              d={collapsed ? "M6 4l4 4-4 4" : "M10 4L6 8l4 4"}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </span>
      </button>
    </aside>
  );
}
