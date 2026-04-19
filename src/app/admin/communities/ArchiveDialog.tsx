"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Two-step confirmation dialog for archiving a community.
 *
 * Step 1 explains what archive does. Step 2 is the final "are you sure"
 * gate — you have to click through both to actually call `onConfirm`, and
 * ESC or the backdrop cancels at either step. We deliberately do NOT
 * use `window.confirm` so the copy is on-brand and the two clicks can't
 * be satisfied by accidental double-click / rapid-fire Enter.
 *
 * Restoring an archived community is a single click (no double-confirm);
 * this component is only for the archive direction.
 */
export function ArchiveDialog({
  communityName,
  onCancel,
  onConfirm,
}: {
  communityName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, pending]);

  // Focus the primary action when a step renders so keyboard users can
  // confirm / continue immediately.
  useEffect(() => {
    const btn = dialogRef.current?.querySelector<HTMLButtonElement>(
      "[data-primary]",
    );
    btn?.focus();
  }, [step]);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed.");
      setPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={() => {
          if (!pending) onCancel();
        }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl"
      >
        {step === 1 ? (
          <>
            <h2 id="archive-dialog-title" className="text-lg font-semibold">
              Archive {communityName}?
            </h2>
            <p className="mt-2 text-sm text-muted">
              Archiving hides {communityName} from the public site — the
              home map, the /communities list, and its detail page will
              all stop showing it. Nothing is deleted; you can restore the
              community from the admin table at any time.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded px-3 py-1.5 text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                data-primary
                onClick={() => setStep(2)}
                className="rounded bg-surface px-3 py-1.5 text-sm font-medium ring-1 ring-border hover:ring-foreground/40"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="archive-dialog-title" className="text-lg font-semibold">
              Archive {communityName}?
            </h2>
            <p className="mt-2 text-sm text-muted">
              Are you absolutely sure? {communityName} will disappear from
              the public site as soon as you click the button below.
            </p>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (pending) return;
                  setStep(1);
                  setError(null);
                }}
                className="rounded px-3 py-1.5 text-sm text-muted hover:text-foreground"
                disabled={pending}
              >
                Back
              </button>
              <button
                type="button"
                data-primary
                onClick={handleConfirm}
                disabled={pending}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? "Archiving…" : `Archive ${communityName}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
