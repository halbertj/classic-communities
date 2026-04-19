"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { slugify } from "@/lib/slugify";

import { createCommunity, type CreateCommunityState } from "./actions";

const INITIAL_STATE: CreateCommunityState = { status: "idle" };

const COMMUNITY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "— Select type —" },
  { value: "single_family", label: "Single family" },
  { value: "townhome", label: "Townhome" },
  { value: "mixed", label: "Mixed" },
];

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

const inputCls =
  "rounded border border-border bg-background px-3 py-2 outline-none focus:border-primary";

export function CommunityForm() {
  const [state, formAction] = useActionState(createCommunity, INITIAL_STATE);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const fieldErrors =
    state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" error={fieldErrors.name}>
          <input
            name="name"
            required
            value={name}
            onChange={(e) => {
              const next = e.target.value;
              setName(next);
              if (!slugTouched) setSlug(slugify(next));
            }}
            className={inputCls}
          />
        </Field>

        <Field
          label="Slug"
          error={fieldErrors.slug}
          hint="URL path, e.g. /communities/silver-creek"
        >
          <input
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className={inputCls}
          />
        </Field>

        <Field label="Type" error={fieldErrors.community_type}>
          <select name="community_type" defaultValue="" className={inputCls}>
            {COMMUNITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="hidden sm:block" />

        <Field label="Date started" error={fieldErrors.date_started}>
          <input type="date" name="date_started" className={inputCls} />
        </Field>

        <Field label="Date completed" error={fieldErrors.date_completed}>
          <input type="date" name="date_completed" className={inputCls} />
        </Field>

        <Field
          label="Number of homes"
          error={fieldErrors.num_homes}
          hint="Total homes built in this community."
        >
          <input
            name="num_homes"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className={inputCls}
          />
        </Field>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Address
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Street address" error={fieldErrors.line1}>
            <input name="line1" required className={inputCls} />
          </Field>

          <Field label="Apt, suite, etc." error={fieldErrors.line2}>
            <input name="line2" className={inputCls} />
          </Field>

          <Field label="City" error={fieldErrors.city}>
            <input name="city" required className={inputCls} />
          </Field>

          <Field label="State" error={fieldErrors.state}>
            <input name="state" required className={inputCls} />
          </Field>

          <Field label="Postal code" error={fieldErrors.postal_code}>
            <input name="postal_code" className={inputCls} />
          </Field>

          <Field label="Country" error={fieldErrors.country}>
            <input name="country" defaultValue="US" className={inputCls} />
          </Field>

          <Field
            label="Latitude"
            error={fieldErrors.latitude}
            hint="Optional — for the map pin. Between -90 and 90."
          >
            <input
              name="latitude"
              type="number"
              step="any"
              className={inputCls}
            />
          </Field>

          <Field
            label="Longitude"
            error={fieldErrors.longitude}
            hint="Optional — for the map pin. Between -180 and 180."
          >
            <input
              name="longitude"
              type="number"
              step="any"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {state.status === "error" && !state.fieldErrors && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton />
        <Link
          href="/admin/communities"
          className="text-sm text-muted hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {pending ? "Saving…" : "Create community"}
    </button>
  );
}
