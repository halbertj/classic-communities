import Image from "next/image";

export default function HomePage() {
  return (
    <main className="relative flex min-h-[100dvh] w-full flex-1 items-center justify-center overflow-hidden">
      {/* Background photograph */}
      <Image
        src="/silver-creek.png"
        alt="Aerial view of a Classic Communities neighborhood"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      {/* Soft vignette so the white wordmark stays legible across the whole frame */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.18)_60%,rgba(0,0,0,0.35)_100%)]"
      />

      {/* Contrast overlay so the white text stays readable over bright areas of the photo */}
      <div aria-hidden className="absolute inset-0 bg-black/35" />

      {/* Hero content */}
      <div className="relative z-10 flex w-full max-w-[1100px] flex-col items-center px-6 text-center text-white">
        <p
          className="whitespace-nowrap font-serif text-[32px] font-semibold uppercase tracking-[4px] text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          The Legacy of
        </p>

        <div className="mt-6 w-full sm:mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logowhite.svg"
            alt="Classic Communities"
            width={776}
            height={88}
            className="mx-auto h-auto w-full max-w-[min(78vw,780px)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          />
        </div>
      </div>
    </main>
  );
}
