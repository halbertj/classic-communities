# Classic Communities

A [Next.js 15](https://nextjs.org) + [Supabase](https://supabase.com) app for
managing and showcasing residential communities. Built with the App Router,
TypeScript, Tailwind CSS v4, and Supabase's cookie-based SSR auth.

The Supabase layer is wired up the modern way:

- **Browser client** — for Client Components (`src/lib/supabase/client.ts`)
- **Server client** — for Server Components, Route Handlers, and Server Actions (`src/lib/supabase/server.ts`)
- **Middleware helper** — refreshes the auth session on every request (`src/lib/supabase/middleware.ts` + `middleware.ts`)

## Prerequisites

- Node.js 20+ (the lockfile was generated with npm 10)
- A Supabase project — create one at <https://supabase.com/dashboard>

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.local.example .env.local
# then edit .env.local — see "Environment variables" below

# 3. Authenticate the Supabase CLI and link this project
npx supabase login
npx supabase link --project-ref <your-project-ref>

# 4. Push the schema to your Supabase project
npx supabase db push

# 5. Generate TypeScript types from the live schema
npm run types:generate

# 6. Run the app
npm run dev
```

Visit <http://localhost:3000>.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Where to find it | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → `Project URL` | App (browser + server) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → Project Settings → API Keys → `publishable` (or the legacy `anon` key) | App (browser + server) |
| `SUPABASE_PROJECT_ID` | The subdomain of `NEXT_PUBLIC_SUPABASE_URL` | `types:generate` script only |

`.env.local` is gitignored — never commit it. `.env.local.example` holds
placeholder values and **is** committed as a template.

## Database

Schema lives as versioned SQL migrations under `supabase/migrations/`. The
Supabase CLI (installed as a devDependency) applies them to your project with
`npx supabase db push`.

### Tables (as of the current migrations)

| Table | Purpose |
| --- | --- |
| `public.profiles` | One row per `auth.users` entry. Holds `role` (`'user'` or `'admin'`). Auto-created on signup via trigger. |
| `public.addresses` | Street components (`line1`, `line2`, `city`, `state`, `postal_code`, `country`, `formatted`) plus `latitude` and `longitude` for map display. |
| `public.communities` | `name`, unique `slug`, `date_started` / `date_completed`, `cover_photo_path`, `community_type` (enum), FK → `addresses`. |

### Enums

- `community_type`: `'single_family' \| 'townhome' \| 'mixed'`

### Row Level Security

- `addresses` and `communities`: **public read**, **admin-only write**.
- `profiles`: owners can read/update their own; admins can read/update all.
- Admin checks go through the `public.is_admin()` SECURITY DEFINER function
  (avoids the classic RLS-recursion footgun).

### Storage

A public bucket `community-photos` holds cover photos. Policies on
`storage.objects` mirror the table rules: anyone can read, only admins can
write.

### Becoming an admin

Signups default to `role = 'user'`, so **no one can create communities until
someone is manually promoted**. After you've created your first auth user, run
this in the Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

You only do this once, by hand. From then on, admins can promote other users.

### Adding a schema change

1. Create a new SQL file in `supabase/migrations/` named with a higher
   timestamp prefix than the previous file, e.g. `20260419000000_add_X.sql`.
2. Run `npx supabase db push` to apply it to your Supabase project.
3. Run `npm run types:generate` to refresh `src/types/database.types.ts`.

## Scripts

| Script                   | What it does                                                                 |
| ------------------------ | ---------------------------------------------------------------------------- |
| `npm run dev`            | Start the Next.js dev server.                                                |
| `npm run build`          | Production build.                                                            |
| `npm start`              | Run the production build.                                                    |
| `npm run lint`           | Lint with ESLint (flat config from `eslint-config-next`).                    |
| `npm run types:generate` | Regenerate `src/types/database.types.ts` from your Supabase schema via CLI.  |

`types:generate` reads `SUPABASE_PROJECT_ID` from your shell environment.
Either export it, `source .env.local`, or run the script inline:

```bash
SUPABASE_PROJECT_ID=your-project-ref npm run types:generate
```

## Project structure

```
.
├── middleware.ts                 # Runs updateSession() on every request
├── src/
│   ├── app/
│   │   ├── globals.css           # Tailwind v4 + light/dark CSS variables
│   │   ├── layout.tsx
│   │   └── page.tsx              # Hero landing page
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # createBrowserClient()
│   │   │   ├── server.ts         # createServerClient() + next/headers cookies
│   │   │   └── middleware.ts     # updateSession() session-refresh helper
│   │   └── utils.ts
│   └── types/
│       └── database.types.ts     # Auto-generated — do not edit by hand
├── supabase/
│   ├── migrations/               # SQL migrations, apply with `supabase db push`
│   └── config.toml               # Supabase CLI project config
├── public/                       # Static assets
├── .env.local.example            # Env-var template (committed)
├── .env.local                    # Your real env vars (gitignored)
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

## Using the Supabase clients in your code

### Server Component

```tsx
import { createClient } from "@/lib/supabase/server";

export default async function CommunitiesPage() {
  const supabase = await createClient();
  const { data: communities } = await supabase
    .from("communities")
    .select("id, name, slug, community_type")
    .order("name");

  return <pre>{JSON.stringify(communities, null, 2)}</pre>;
}
```

### Client Component

```tsx
"use client";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const supabase = createClient();
  return <button onClick={() => supabase.auth.signOut()}>Sign out</button>;
}
```

### Using the generated enum type

The `community_type` enum is exported both as a TypeScript union and as a
runtime array you can iterate to build dropdowns:

```tsx
import type { Database } from "@/types/database.types";
import { Constants } from "@/types/database.types";

type CommunityType = Database["public"]["Enums"]["community_type"];
//                  = "single_family" | "townhome" | "mixed"

const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  single_family: "Single family",
  townhome: "Townhome",
  mixed: "Mixed",
};

// Render a <select> with all valid values and friendly labels:
Constants.public.Enums.community_type.map((value) => (
  <option key={value} value={value}>{COMMUNITY_TYPE_LABELS[value]}</option>
));
```

## Learn more

- [Next.js docs](https://nextjs.org/docs)
- [Supabase + Next.js guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase CLI reference](https://supabase.com/docs/reference/cli)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
