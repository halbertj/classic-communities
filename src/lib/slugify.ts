/**
 * Turn a free-form string like "Silver Creek" into a URL-safe slug
 * like "silver-creek". Keeps only lowercase letters, digits, and
 * single hyphens — same format enforced by the DB check constraint
 * on communities.slug.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
