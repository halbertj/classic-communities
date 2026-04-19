import Link from "next/link";

import { CommunityForm } from "./CommunityForm";

export const metadata = {
  title: "New community — Classic Communities Admin",
};

export default function NewCommunityPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <Link
          href="/admin/communities"
          className="text-sm text-muted hover:text-foreground"
        >
          ← Back to communities
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New community</h1>
        <p className="text-sm text-muted">
          Map pin location, cover photo, and edits come in a later slice.
        </p>
      </div>
      <CommunityForm />
    </div>
  );
}
