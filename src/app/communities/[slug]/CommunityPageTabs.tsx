"use client";

import { useCallback, useEffect, useState } from "react";

export type CommunityPageTab = {
  id: string;
  label: string;
};

/**
 * Sticky in-page tab bar for the community detail page.
 *
 * Sits directly under the site header (which is itself sticky at top-0,
 * h-16 / 64px) and scrolls to the matching `<section id={id}>` anchor on
 * the page. The active tab is driven by IntersectionObserver so it
 * tracks the user's scroll position naturally — no hash-based routing
 * (which would re-trigger Next.js navigation and fight smooth scroll).
 *
 * Tabs are passed in from the server component so we only render the
 * ones whose underlying section actually exists for this community
 * (e.g. no "Site plan" tab when a community hasn't uploaded one).
 */
export function CommunityPageTabs({ tabs }: { tabs: CommunityPageTab[] }) {
  const [activeId, setActiveId] = useState<string | null>(
    tabs[0]?.id ?? null,
  );

  useEffect(() => {
    if (tabs.length === 0) return;

    const elements = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    // Bias the observation root upward by the combined sticky header
    // (64px) + tab bar (~52px) so a section is considered "in view" the
    // moment its heading clears the sticky chrome, not when it reaches
    // the literal top of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop,
          );
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-120px 0px -55% 0px",
        threshold: 0,
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [tabs]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      // Manual offset scroll so the section heading doesn't end up
      // tucked under the sticky header + tabs.
      const headerOffset = 64 + 52;
      const top =
        el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
      setActiveId(id);
    },
    [],
  );

  if (tabs.length === 0) return null;

  return (
    <div className="sticky top-16 z-30 mb-6 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 before:pointer-events-none before:absolute before:left-[calc(50%-50vw)] before:right-[calc(50%-50vw)] before:bottom-0 before:h-px before:bg-border before:content-['']">
      <nav
        aria-label="Community sections"
        className="cc-no-scrollbar flex h-[44px] gap-6 overflow-x-auto overflow-y-hidden"
      >
        {tabs.map((tab) => {
          const isActive = activeId === tab.id;
          return (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              onClick={(e) => handleClick(e, tab.id)}
              aria-current={isActive ? "true" : undefined}
              className={`relative whitespace-nowrap py-3 text-[11px] uppercase tracking-[3px] transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
              <span
                aria-hidden
                className={`absolute inset-x-0 -bottom-px h-px transition-colors ${
                  isActive ? "bg-foreground" : "bg-transparent"
                }`}
              />
            </a>
          );
        })}
      </nav>
    </div>
  );
}
