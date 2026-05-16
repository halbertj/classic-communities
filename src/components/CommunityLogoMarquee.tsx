import Image from "next/image";
import Link from "next/link";

export type LogoCommunity = {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
};

// A continuous, horizontally-scrolling band of community logos. The
// track is rendered twice back-to-back and translated by exactly -50%,
// which yields a seamless infinite loop. Animation pauses on hover and
// is disabled entirely for users who prefer reduced motion.
export function CommunityLogoMarquee({
  communities,
  speedSeconds = 180,
}: {
  communities: LogoCommunity[];
  speedSeconds?: number;
}) {
  if (communities.length === 0) return null;

  const items = [...communities, ...communities];

  return (
    <section
      aria-label="Classic Communities neighborhoods"
      // Asymmetric padding: tighter on top so the marquee reads as a
      // continuation of the map section above it, and roomier on the
      // bottom to give the next section (story / featured) a clean
      // visual break from the moving logos.
      className="border-b border-border bg-background pb-16 pt-6 sm:pb-20 sm:pt-8"
    >
      <div
        className="cc-marquee group relative overflow-hidden"
        style={
          {
            "--marquee-duration": `${speedSeconds}s`,
          } as React.CSSProperties
        }
      >
        {/* Edge fades so logos appear to enter/exit a soft window */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-24"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-24"
        />

        <ul className="cc-marquee__track flex w-max items-center gap-12 sm:gap-16">
          {items.map((c, i) => (
            <li
              key={`${c.id}-${i}`}
              className="shrink-0"
              aria-hidden={i >= communities.length ? true : undefined}
            >
              <Link
                href={`/communities/${c.slug}`}
                className="flex h-12 w-32 items-center justify-center sm:h-14 sm:w-36"
                aria-label={c.name}
                tabIndex={i >= communities.length ? -1 : 0}
              >
                <Image
                  src={c.logo_url}
                  alt={c.name}
                  width={240}
                  height={96}
                  className="h-full w-full object-contain"
                  sizes="(max-width: 640px) 160px, 192px"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
