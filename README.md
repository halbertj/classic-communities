# Classic Communities

A minimal [Next.js 15](https://nextjs.org) + [Supabase](https://supabase.com)
starter using the App Router, TypeScript, and Tailwind CSS v4.

It wires up the three Supabase client patterns you need for modern Next.js:

- **Browser client** — for Client Components (`src/lib/supabase/client.ts`)
- **Server client** — for Server Components, Route Handlers, and Server Actions (`src/lib/supabase/server.ts`)
- **Middleware helper** — refreshes the auth session on every request (`src/lib/supabase/middleware.ts` + `middleware.ts`)

## Prerequisites

- Node.js 20+ (the lockfile was generated with npm 10)
- A Supabase project — create one at <https://supabase.com/dashboard>

## 1. Set up the Supabase project

1. In the Supabase Dashboard, create a new project.
2. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Note your **project ref** (the subdomain in the URL, e.g. `abcd1234...`).
   You'll use it as `SUPABASE_PROJECT_ID` for type generation.

### Create the example `todos` table

Open the **SQL Editor** in the Supabase Dashboard and run:

```sql
create table if not exists public.todos (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  is_complete  boolean not null default false,
  inserted_at  timestamptz not null default now()
);

alter table public.todos enable row level security;

-- Allow anyone (including anonymous visitors) to read todos.
-- Tighten this policy for real apps.
create policy "todos are readable by anyone"
  on public.todos
  for select
  using (true);

-- Seed a couple of rows so the home page isn't empty.
insert into public.todos (title, is_complete) values
  ('Wire up Supabase',       true),
  ('Ship the home page',     true),
  ('Replace this with your real schema', false);
```

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and paste in the values from step 1.

## 3. Run locally

```bash
npm install
npm run dev
```

Visit <http://localhost:3000>. You should see the seeded todos with a
green "Connected to Supabase" badge.

## Scripts

| Script                   | What it does                                                                 |
| ------------------------ | ---------------------------------------------------------------------------- |
| `npm run dev`            | Start the Next.js dev server.                                                |
| `npm run build`          | Production build.                                                            |
| `npm start`              | Run the production build.                                                    |
| `npm run lint`           | Lint with ESLint (flat config from `eslint-config-next`).                    |
| `npm run types:generate` | Regenerate `src/types/database.types.ts` from your Supabase schema via CLI.  |

`types:generate` uses the Supabase CLI via `npx`. It reads
`SUPABASE_PROJECT_ID` from your shell environment, so either export it or
run it like:

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
│   │   └── page.tsx              # Example page that queries `todos`
│   ├── components/
│   │   └── TodoList.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # createBrowserClient()
│   │   │   ├── server.ts         # createServerClient() + next/headers cookies
│   │   │   └── middleware.ts     # updateSession() session-refresh helper
│   │   └── utils.ts
│   └── types/
│       └── database.types.ts     # Placeholder — replace via `types:generate`
├── .env.local.example
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

## Using the clients in your code

```tsx
// Server Component
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from("todos").select("*");
  // ...
}
```

```tsx
// Client Component
"use client";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const supabase = createClient();
  return <button onClick={() => supabase.auth.signOut()}>Sign out</button>;
}
```

## Learn more

- [Next.js docs](https://nextjs.org/docs)
- [Supabase + Next.js guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
