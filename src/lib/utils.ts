/**
 * Tiny `cn` helper for conditionally joining Tailwind class names.
 * Kept dependency-free so we don't pull in `clsx` / `tailwind-merge`
 * until we actually need them.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
