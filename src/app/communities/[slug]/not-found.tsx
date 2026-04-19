import Link from "next/link";

export default function CommunityNotFound() {
  return (
    <main className="flex-1 bg-background px-6 py-24">
      <div className="mx-auto w-full max-w-xl text-center">
        <p className="text-xs uppercase tracking-[4px] text-muted">404</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold">
          Community not found
        </h1>
        <p className="mt-4 text-muted">
          We couldn&apos;t find the community you were looking for. It may have
          been moved or renamed.
        </p>
        <Link
          href="/communities"
          className="mt-8 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Browse all communities
        </Link>
      </div>
    </main>
  );
}
