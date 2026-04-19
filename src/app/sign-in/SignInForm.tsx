"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, type SignInState } from "./actions";

const INITIAL_STATE: SignInState = { status: "idle" };

export function SignInForm() {
  const [state, formAction] = useActionState(signIn, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="rounded border border-border bg-background px-3 py-2 outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="rounded border border-border bg-background px-3 py-2 outline-none focus:border-primary"
        />
      </label>

      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
