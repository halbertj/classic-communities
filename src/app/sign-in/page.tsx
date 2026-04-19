import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/SiteFooter";
import { getSession } from "@/lib/auth";

import { SignInForm } from "./SignInForm";

export const metadata = {
  title: "Sign in — Classic Communities",
};

export default async function SignInPage() {
  // If you're already signed in, skip the form.
  const session = await getSession();
  if (session) {
    redirect(session.profile.role === "admin" ? "/admin/communities" : "/");
  }

  return (
    <>
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
          <p className="mb-6 text-sm text-muted">
            Admin access for Classic Communities.
          </p>
          <SignInForm />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
