import Image from "next/image";
import Link from "next/link";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Story — Classic Communities",
  description:
    "The story of Classic Communities — a family-built home builder that has shaped neighborhoods across Central Pennsylvania.",
};

export default function StoryPage() {
  return (
    <>
      <SiteHeader logo />

      <main className="flex-1">
        {/* ---------------- Hero ---------------- */}
        <section className="relative border-b border-border bg-background px-6 pb-12 pt-10 sm:pt-16">
          <div className="mx-auto w-full max-w-5xl text-center">
            <p className="text-xs uppercase tracking-[4px] text-muted">
              The story
            </p>
            <h1 className="mt-3 font-serif text-4xl font-semibold sm:text-5xl">
              A family-built legacy
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
              For decades, Classic Communities built homes and neighborhoods
              across Central Pennsylvania — quietly, carefully, and as a
              family.
            </p>
          </div>

          <div className="mx-auto mt-10 w-full max-w-xs sm:max-w-sm">
            <a
              href="/story/builder-architect-2004.png"
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_80px_-28px_rgba(15,23,42,0.4)] ring-1 ring-black/5"
              aria-label="Open Builder/Architect, April 2004 cover in a new tab"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/story/builder-architect-2004.png"
                alt="Cover of Builder/Architect magazine, Central Pennsylvania Edition, April 2004, with James Halbert, Virginia Halbert, and Douglas Halbert standing in front of a stone-front Classic Communities home, headlined Classic Communities Building and Development — Style and Value in Great Locations"
                className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.01]"
              />
            </a>
            <p className="mt-4 text-center text-sm italic text-muted">
              Jim, Virginia, and Doug on the cover of{" "}
              <em>Builder/Architect</em>, April 2004.
            </p>
          </div>
        </section>

        {/* ---------------- Story ---------------- */}
        {/*
          The narrative column sits at max-w-3xl. Two editorial artifacts
          break the rhythm:
            • Jim's business card floats into "A second generation" so the
              artifact is directly adjacent to the paragraph it illustrates.
            • The Classic team photo bleeds out to max-w-5xl between the
              "second generation" and "thousands of homes" blocks, acting
              as the visual hinge from family to team.
        */}
        <section className="bg-surface px-6 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-3xl">
            <article className="space-y-10 text-[17px] leading-relaxed text-foreground/85">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
                  It started with Virginia
                </h2>
                <p className="mt-4">
                  Classic Communities began in the mid-1980s with Virginia
                  Halbert, who started out buying and renovating homes
                  around Lebanon, Pennsylvania. Over time that work grew
                  into new construction and whole neighborhoods, and
                  Classic Communities Corporation was born — built on a
                  simple philosophy: build homes the way you&apos;d want
                  to live in them, and treat every family like a neighbor.
                </p>
              </div>

              <div>
                <h2 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
                  A second generation
                </h2>
                {/* Float on sm+ so the card nestles into the paragraph;
                    on phones it stacks above, which reads better than a
                    narrow text column wrapping around a tiny image. */}
                <figure className="mx-auto mt-4 w-56 sm:float-right sm:ml-6 sm:mt-1 sm:w-64">
                  <div className="overflow-hidden rounded-md border border-border bg-background shadow-[0_12px_40px_-20px_rgba(15,23,42,0.35)] ring-1 ring-black/5">
                    <Image
                      src="/story/jim-business-card.png"
                      alt="Classic Communities business card for James A. Halbert, President, 103 Farmstead Circle, Lebanon, PA"
                      width={520}
                      height={860}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                  <figcaption className="mt-2 text-xs italic leading-snug text-muted">
                    Jim&apos;s business card — the original office, 103
                    Farmstead Circle, Lebanon.
                  </figcaption>
                </figure>
                <p className="mt-4">
                  Jim studied law at the University of Miami and
                  graduated in 1993. The next year, he came home to
                  Pennsylvania to work with his mom.
                </p>
                <p className="mt-4">
                  He started in 1994 in the field — framing houses,
                  building decks, hanging drywall. Two years on the job
                  site, doing the same work as the framers and masons
                  and finishers. That&apos;s where he learned how a
                  house actually goes together, and it&apos;s where he
                  earned the trust of the trades Classic kept working
                  with for the next twenty years.
                </p>
                <p className="mt-4">
                  In 1996 he moved into Director of Development, and in
                  2004 he became CEO. Doug joined around the same time
                  as President. Together the brothers pushed Classic
                  out of Lebanon
                  into the greater Harrisburg area, got into
                  multi-family, and acquired Fogarty Homes — without
                  losing the family feel of the place.
                </p>
                {/* Clear the float so subsequent blocks start below the
                    card, regardless of paragraph length. */}
                <div className="clear-both" />
              </div>
            </article>
          </div>

          {/* Jim and Doug — the two brothers themselves, sitting between
              the "second generation" paragraph and the wider team photo
              so the section moves: family card → the brothers → the
              team they grew. */}
          <div className="mx-auto mt-10 w-full max-w-2xl sm:mt-14">
            <figure className="space-y-3">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-background shadow-[0_20px_60px_-28px_rgba(15,23,42,0.4)] ring-1 ring-black/5">
                <Image
                  src="/story/jim-doug.png"
                  alt="Jim Halbert and Doug Halbert standing together at the foot of a curved staircase"
                  fill
                  sizes="(min-width: 1024px) 672px, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="text-center text-sm italic text-muted">
                Brothers Jim and Doug Halbert.
              </figcaption>
            </figure>
          </div>

          <div className="mx-auto mt-10 w-full max-w-2xl sm:mt-14">
            <figure className="space-y-3">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-background shadow-[0_20px_60px_-28px_rgba(15,23,42,0.4)] ring-1 ring-black/5">
                <Image
                  src="/story/founders.png"
                  alt="Jim Halbert, Virginia Halbert, and Doug Halbert standing together in front of a stone-and-siding Classic home"
                  fill
                  sizes="(min-width: 1024px) 672px, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="text-center text-sm italic text-muted">
                Jim, Virginia, and Doug — years on, in front of another
                Classic home.
              </figcaption>
            </figure>
          </div>

          <div className="mx-auto mt-12 w-full max-w-5xl sm:mt-16">
            <figure className="space-y-3">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-background shadow-[0_24px_80px_-32px_rgba(15,23,42,0.4)] ring-1 ring-black/5">
                <Image
                  src="/story/classic-team.png"
                  alt="The Classic Communities team assembled in front of a finished Classic home"
                  fill
                  sizes="(min-width: 1024px) 960px, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="text-center text-sm italic text-muted">
                The Classic Communities team.
              </figcaption>
            </figure>
          </div>

          <div className="mx-auto mt-12 w-full max-w-3xl sm:mt-16">
            <article className="space-y-10 text-[17px] leading-relaxed text-foreground/85">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
                  Thousands of homes, one at a time
                </h2>
              </div>
            </article>
          </div>

          <div className="mx-auto mt-8 w-full max-w-3xl sm:mt-10">
            <p className="text-[17px] leading-relaxed text-foreground/85">
              Over its three decades, Classic grew to a team of 57,
              developed over 70 communities across Central
              Pennsylvania, and built an in-house rental portfolio of
              over 300 units. Each community had its own character, but
              the approach never changed — careful craftsmanship, honest
              work, and a long-term commitment to the place it was in.
            </p>
          </div>

          <div className="mx-auto mt-8 w-full max-w-2xl sm:mt-10">
            <figure className="space-y-3">
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-background shadow-[0_16px_48px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/5">
                <Image
                  src="/story/habitat-team.png"
                  alt="Jim Halbert and three others on site in front of a Habitat for Humanity home, two in Classic Communities fleeces"
                  fill
                  sizes="(min-width: 1024px) 672px, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="text-center text-sm italic text-muted">
                On site with the Classic team.
              </figcaption>
            </figure>
          </div>

          <div className="mx-auto mt-10 w-full max-w-3xl sm:mt-12">
            <article className="space-y-10 text-[17px] leading-relaxed text-foreground/85">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
                  The end of a chapter
                </h2>
                <p className="mt-4">
                  Classic Communities wound down in 2015, after more
                  than twenty years of building across Central
                  Pennsylvania. What it left behind is the homes
                  themselves, the neighborhoods they sit in, and the
                  families still living in them — which was always the
                  point.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* ---------------- Creekside ---------------- */}
        <section className="border-t border-border bg-surface px-6 py-16 sm:py-24">
          <div className="mx-auto grid w-full max-w-5xl items-start gap-10 lg:grid-cols-[5fr_4fr] lg:gap-14">
            <div>
              <p className="text-xs uppercase tracking-[4px] text-muted">
                Where it started
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">
                The Villages of Creekside
              </h2>
              <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-foreground/85">
                <p>
                  Creekside, in Lebanon, was one of Virginia&apos;s first
                  communities — and the original Classic Communities office
                  sat right inside the neighborhood, steps from the homes
                  the team was building.
                </p>
                <p>
                  The Daily News covered the opening of the model home in
                  the early 1990s. A scan of the clipping is preserved here,
                  a small record of the start of a much longer story.
                </p>
                <p>
                  Jim laid out the neighborhood on the original site plan
                  himself — his handwriting still sits at the top of the
                  page: <em>Classic Communities Corp — Creekside — Lebanon,
                  Pa</em>.
                </p>
              </div>
              <Link
                href="/communities/creekside"
                className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Visit Creekside
                <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="space-y-8">
              <figure className="space-y-3">
                <a
                  href="/story/creekside-article.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-xl border border-border bg-background ring-1 ring-black/5"
                  aria-label="Open Creekside article scan in a new tab"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/story/creekside-article.png"
                    alt="Newspaper feature headlined “Villages of Creekside — Make-believe family dwells in model home,” by Pat Seaman, with photos by Earl Brightbill"
                    className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.02]"
                  />
                </a>
                <figcaption className="text-sm italic text-muted">
                  Daily News feature on the opening of The Villages of
                  Creekside model home.
                </figcaption>
              </figure>

              <figure className="space-y-3">
                <a
                  href="/story/creekside-site-plan.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-xl border border-border bg-background ring-1 ring-black/5"
                  aria-label="Open Creekside site plan in a new tab"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/story/creekside-site-plan.png"
                    alt="Original hand-annotated site plan for The Villages of Creekside in Lebanon, PA, labeled at the top in Jim Halbert's handwriting: Classic Communities Corp — Creekside — Lebanon, Pa"
                    className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.02]"
                  />
                </a>
                <figcaption className="text-sm italic text-muted">
                  The original Creekside site plan, labeled in Jim&apos;s
                  hand.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ---------------- Habitat for Humanity ---------------- */}
        <section className="border-y border-border bg-background px-6 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-5xl">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[4px] text-muted">
                Giving back
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">
                Habitat for Humanity
              </h2>
              <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-foreground/85">
                <p>
                  Building homes has always been more than a business for the
                  Halbert family. Over the years, Classic Communities has
                  partnered with Habitat for Humanity to help put families
                  into homes of their own — volunteering crews, donating
                  materials, and standing on the porch at dedication day
                  alongside the new homeowners.
                </p>
                <p>
                  In 2006, Classic joined the national Home Builders Blitz —
                  1,000 professional builders framing, finishing, and
                  handing over the keys to more than 400 Habitat homes in a
                  single week. It&apos;s one chapter in a long-running
                  commitment to the communities we build in.
                </p>
              </div>
            </div>

            {/* Two Habitat-era photos. On mobile they stack. On desktop
                they sit 2-up with a gentle zigzag — the right figure is
                pushed down for breathing room so the pair reads as an
                editorial spread rather than a rigid grid. */}
            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <figure className="space-y-3">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5">
                  <Image
                    src="/story/habitat-blitz-2006.png"
                    alt="Doug Halbert and his son in front of a Home Builders Blitz 2006 banner at a Habitat for Humanity build"
                    fill
                    sizes="(min-width: 1024px) 480px, 100vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="text-sm italic text-muted">
                  Home Builders Blitz, 2006 — 1,000 builders, 400+ homes in
                  one week.
                </figcaption>
              </figure>

              <figure className="space-y-3 lg:mt-12">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface ring-1 ring-black/5">
                  <Image
                    src="/story/habitat-ribbon-cutting.png"
                    alt="Ribbon cutting for a Habitat for Humanity home built with Classic Communities Corporation"
                    fill
                    sizes="(min-width: 1024px) 480px, 100vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="text-sm italic text-muted">
                  Ribbon-cutting day, handing the keys to a new Habitat
                  homeowner.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ---------------- Recognition ---------------- */}
        {/*
          Two dated entries — 2010 and 2014 — under one "Recognition"
          eyebrow. Each entry pairs a short prose block with its visual
          artifact (magazine cover, ranking page). The Pyramid Award is
          text-only, tucked under the 2014 ranking.
        */}
        <section className="border-t border-border bg-surface px-6 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-3xl text-center">
            <p className="text-xs uppercase tracking-[4px] text-muted">
              Recognition
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">
              In the trade
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted">
              A few of the years Classic and the family showed up in the
              industry record.
            </p>
          </div>

          {/* --- 2004 --- */}
          <div className="mx-auto mt-12 w-full max-w-3xl text-center sm:mt-16">
            <p className="font-serif text-xl font-semibold text-foreground/90">
              2004
            </p>
            <div className="mx-auto mt-3 max-w-2xl space-y-4 text-[17px] leading-relaxed text-foreground/85">
              <p>
                Classic was the cover story of the April 2004 Central
                Pennsylvania edition of <em>Builder/Architect</em>, with
                Jim, Virginia, and Doug photographed together in front of
                a Classic home.
              </p>
            </div>
          </div>

          {/* --- 2010 --- */}
          <div className="mx-auto mt-16 w-full max-w-3xl text-center sm:mt-20">
            <p className="font-serif text-xl font-semibold text-foreground/90">
              2010
            </p>
            <div className="mx-auto mt-3 max-w-2xl space-y-4 text-[17px] leading-relaxed text-foreground/85">
              <p>
                Jim appears on the cover of <em>The Home Builder</em>, the
                magazine of the Home Builders Association of Metropolitan
                Harrisburg, in the group photo from the association&apos;s
                Economic Impact Study — a study showing what home building
                contributes to the Harrisburg-area economy.
              </p>
            </div>
          </div>

          <figure className="mx-auto mt-8 w-full max-w-md space-y-3 sm:mt-10">
            <a
              href="/story/home-builder-2010.png"
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl border border-border bg-background shadow-[0_20px_60px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/5"
              aria-label="Open The Home Builder, March 2010 cover in a new tab"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/story/home-builder-2010.png"
                alt="Cover of The Home Builder magazine, Volume 19 Number 3, March 2010, published by the Home Builders Association of Metropolitan Harrisburg, with Jim Halbert pictured in the bottom group photo accompanying the Economic Impact Study"
                className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.02]"
              />
            </a>
            <figcaption className="text-center text-sm italic text-muted">
              <em>The Home Builder</em>, March 2010 — Jim is in the bottom
              group photo.
            </figcaption>
          </figure>

          {/* --- 2014 --- */}
          <div className="mx-auto mt-16 w-full max-w-3xl text-center sm:mt-20">
            <p className="font-serif text-xl font-semibold text-foreground/90">
              2014
            </p>
            <div className="mx-auto mt-3 max-w-2xl space-y-4 text-[17px] leading-relaxed text-foreground/85">
              <p>
                Classic Communities debuted on{" "}
                <em>Professional Builder</em>&apos;s annual Housing Giants
                list — an industry ranking of the largest home builders in
                the U.S. — at #171, on the strength of 252 closings and
                $60.9M in 2013 revenue.
              </p>
              <p>
                The same year, the Home Builders Association of Metropolitan
                Harrisburg recognized Classic with a Pyramid Award for Best
                Multi-Family Community in the $150,001–$300,000 category.
              </p>
            </div>
          </div>

          <figure className="mx-auto mt-8 w-full max-w-md space-y-3 sm:mt-10">
            <a
              href="/story/housing-giants-2014.png"
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl border border-border bg-background shadow-[0_20px_60px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/5"
              aria-label="Open Housing Giants 2014 ranking in a new tab"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/story/housing-giants-2014.png"
                alt="Professional Builder magazine's Housing Giants 2014 ranking, showing Classic Communities at rank 171 with $60,856,508 in 2013 housing revenue and 252 closings"
                className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.02]"
              />
            </a>
            <figcaption className="text-center text-sm italic text-muted">
              <em>Professional Builder</em>, Housing Giants 2014.
            </figcaption>
          </figure>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="bg-surface px-6 py-12">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/communities"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <span aria-hidden>→</span>
                Explore communities
              </Link>
              <Link
                href="/#about"
                className="text-sm text-muted hover:text-foreground"
              >
                About this project
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
