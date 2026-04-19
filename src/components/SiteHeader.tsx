import Link from "next/link";

type SiteHeaderProps = {
  /**
   * When `true`, the header renders with a light wordmark / muted links so it
   * reads well sitting on top of a dark photograph (e.g. the home hero). The
   * default is a solid, light-background header suitable for interior pages.
   */
  transparent?: boolean;
  /**
   * When `true`, the textual wordmark is replaced by the SVG logo. On
   * transparent headers we use the white variant; otherwise the primary-blue
   * variant so it reads on the light background.
   */
  logo?: boolean;
};

/**
 * Site-wide top navigation.
 *
 * Renders the wordmark on the left and a compact nav on the right. Auth
 * controls (Sign in / Sign out / Admin) live in the footer instead — see
 * `SiteFooter` — since they're only used by the site owner.
 */
export function SiteHeader({
  transparent = false,
  logo = false,
}: SiteHeaderProps) {
  const wrapperClass = transparent
    ? "absolute inset-x-0 top-0 z-30 bg-transparent"
    : "sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70";

  const wordmarkClass = transparent
    ? "font-serif text-[13px] font-semibold uppercase tracking-[4px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
    : "font-serif text-[13px] font-semibold uppercase tracking-[4px] text-foreground";

  const linkBase =
    "text-[11px] uppercase tracking-[3px] transition-colors duration-150";
  const linkClass = transparent
    ? `${linkBase} text-white/85 hover:text-white`
    : `${linkBase} text-muted hover:text-foreground`;

  return (
    <header className={wrapperClass}>
      {/* Full-viewport row — we intentionally skip a max-width cap here so
          the logo hugs the left edge and the nav hugs the right edge on
          wide screens instead of floating in a narrow centered column. */}
      <div className="flex h-16 w-full items-center justify-between px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Classic Communities — Home"
          className={
            logo
              ? "inline-flex items-center"
              : wordmarkClass
          }
          style={logo ? undefined : { fontFamily: "var(--font-cinzel)" }}
        >
          {logo ? (
            /* Plain <img> — next/image blocks SVGs by default, and raster
               optimization offers nothing for a static vector wordmark.
               Explicit width/height (matching the source SVG's 776:88
               viewBox) give the browser an intrinsic aspect ratio so
               `w-auto` resolves correctly at render time. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={transparent ? "/logowhite.svg" : "/logoblue.svg"}
              alt="Classic Communities"
              width={776}
              height={88}
              className="h-[22px] w-auto"
            />
          ) : (
            "Classic Communities"
          )}
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/communities" className={linkClass}>
            Communities
          </Link>
          <Link href="/story" className={`${linkClass} hidden sm:inline`}>
            Story
          </Link>
          <Link href="/#about" className={`${linkClass} hidden sm:inline`}>
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
