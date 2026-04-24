# Dev Guide

Cheat sheet for working on Hotel PMS. Keep this open in a tab.

If you're new to the project, read [ONBOARDING.md](./ONBOARDING.md) first. This file is for "I forgot how to do X" lookups.

---

## Login credentials (dev / seed users)

After running the seed, these accounts exist. Passwords are intentionally weak — this is a dev environment, not production.

| Username | Password | Role  | Lands on            |
|----------|----------|-------|---------------------|
| admin    | admin123 | ADMIN | `/app/admin/users`  |
| fo1      | fo123    | FO    | `/app/fo`           |
| hk1      | hk123    | HK    | `/app/hk`           |
| fb1      | fb123    | FB    | `/app/fb`           |
| acc1     | acc123   | ACC   | `/app/acc`          |

**One account = one role.** A user with role FO cannot access `/app/hk` — they get a 403. To test cross-module flows (e.g., F&B charge-to-room creating a folio entry), open two browsers (or one regular + one incognito) and log in as different users.

To reset all data and re-seed: `npx prisma migrate reset` (asks for confirmation, drops everything, re-runs migrations + seed).

---

## Daily commands

```bash
npm run dev               # start dev server at localhost:3000
npm run build             # production build (run before opening a PR)
npx prisma studio         # browse DB at localhost:5555
npx prisma migrate dev    # apply schema changes (lead-only)
npx prisma db seed        # re-run the seed
vercel env pull .env      # pull latest env vars from Vercel
```

---

## Laravel → Next.js translation

You're coming from Laravel + XAMPP. Here's how concepts map:

### Commands

| Laravel / XAMPP                  | Next.js / our stack                 |
|----------------------------------|-------------------------------------|
| `php artisan serve`              | `npm run dev`                       |
| `php artisan migrate`            | `npx prisma migrate dev`            |
| `php artisan migrate:fresh`      | `npx prisma migrate reset`          |
| `php artisan db:seed`            | `npx prisma db seed`                |
| `php artisan tinker`             | `npx prisma studio` (UI, not REPL)  |
| `php artisan make:migration`     | edit `prisma/schema.prisma`, then `migrate dev` |
| `php artisan route:list`         | look at `src/app/**/page.tsx`       |
| `composer install`               | `npm install`                       |
| `composer update`                | `npm update`                        |
| `.env`                           | `.env` (works the same)             |
| Start XAMPP / MySQL              | nothing — DB is on Neon, always on  |
| phpMyAdmin                       | `npx prisma studio`                 |

### Concepts

| Laravel                          | Next.js                             |
|----------------------------------|-------------------------------------|
| `routes/web.php`                 | folder structure under `src/app/`   |
| `app/Http/Controllers/X.php`     | server actions in same folder as page, or route handler at `route.ts` |
| Blade templates (`*.blade.php`)  | React components (`*.tsx`)          |
| `@yield` / layouts               | `layout.tsx` files (nested)         |
| Eloquent (`User::find(1)`)       | Prisma (`prisma.user.findUnique({ where: { id: 1 } })`) |
| `php artisan make:model`         | edit `schema.prisma`, then `migrate dev` |
| Form Request validation         | Zod schemas + react-hook-form       |
| `auth()->user()`                 | `await auth()` from `@/auth`        |
| `middleware('auth')`             | `proxy.ts` at project root          |
| `public/` folder                 | `public/` folder (same — static files only, NOT routing) |
| `php artisan storage:link`       | not needed — `/public` is auto-served |
| Service provider                 | usually a singleton in `src/lib/`   |
| Job queues                       | not used in this project            |

### Mental shifts

These are the genuinely different ones, not just renamed:

**No backend folder.** There's no `app/Http/Controllers/` separate from your views. A page (`src/app/foo/page.tsx`) and its server-side mutations (server actions, defined with `"use server"`) live next to each other. This feels weird at first but you stop noticing in a week.

**Server vs Client components.** Every component is a server component by default. They run on the server, can `await` the database directly, and ship zero JS to the browser. You only mark a component as `"use client"` (top of file) if it needs `useState`, `useEffect`, `usePathname`, event handlers like `onClick`, or browser APIs. Rule of thumb: start server, escalate to client only when forced.

**Forms don't post to a controller.** They call a server action — a regular async function in your codebase, marked `"use server"`. No URL, no controller, no JSON parsing. Looks like a function call, runs on the server.

**No XAMPP, no local DB.** Neon is the dev DB, shared across the team. Don't run a local Postgres. Don't `prisma migrate reset` without asking — it nukes the shared DB.

**`.env` is for everyone, secrets are in Vercel.** Local `.env` is for you. Production secrets live in Vercel's dashboard. Pull production env into local with `vercel env pull .env`.

**No artisan console.** Closest thing is `npx prisma studio` for browsing data, or writing a one-off `tsx scripts/whatever.ts` script and running it with `npx tsx scripts/whatever.ts`.

---

## File map cheat sheet

```
src/
├── app/                      ← Next.js App Router (routes = folders)
│   ├── (public)/login/       ← /login
│   ├── (app)/                ← authenticated area
│   │   ├── fo/               ← /app/fo/*  — Front Office
│   │   ├── hk/               ← /app/hk/*  — Housekeeping
│   │   ├── fb/               ← /app/fb/*  — F&B
│   │   ├── acc/              ← /app/acc/* — Accounting
│   │   ├── admin/            ← /app/admin/* — Admin
│   │   ├── profile/          ← /app/profile
│   │   ├── forbidden/        ← /app/forbidden (403)
│   │   └── layout.tsx        ← NavShell wrapping all (app) pages
│   ├── api/auth/[...nextauth]/  ← NextAuth handlers (don't touch)
│   ├── layout.tsx            ← root layout
│   ├── page.tsx              ← / (redirects based on session)
│   └── not-found.tsx         ← 404
├── auth.ts                   ← NextAuth config (don't touch unless lead)
├── lib/
│   └── prisma.ts             ← PrismaClient singleton — import from here
├── components/               ← shared components (lead-owned)
└── types/                    ← TypeScript declarations
prisma/
├── schema.prisma             ← DB schema (lead-only)
├── migrations/               ← migration history (don't edit by hand)
└── seed.ts                   ← seed script
proxy.ts                      ← role-gating (don't touch unless lead)
AGENTS.md                     ← AI tool context
.env                          ← local env vars (NEVER COMMIT)
```

---

## Common patterns (copy-paste templates)

### Server component reading from DB

```typescript
// src/app/(app)/fo/reservations/page.tsx
import { prisma } from "@/lib/prisma";

export default async function ReservationsPage() {
  const reservations = await prisma.reservation.findMany({
    include: { guest: true, roomType: true },
    orderBy: { arrivalDate: "desc" },
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Reservations</h1>
      {/* render reservations */}
    </main>
  );
}
```

### Server action (form submission)

```typescript
// src/app/(app)/fo/reservations/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const ReservationSchema = z.object({
  guestId: z.coerce.number().int().positive(),
  arrivalDate: z.coerce.date(),
  departureDate: z.coerce.date(),
  // ...
});

export async function createReservation(formData: FormData) {
  const parsed = ReservationSchema.parse(Object.fromEntries(formData));
  const created = await prisma.reservation.create({ data: parsed });
  revalidatePath("/app/fo/reservations");
  redirect(`/app/fo/reservations/${created.id}`);
}
```

### Client component with form

```typescript
// src/app/(app)/fo/reservations/new/ReservationForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createReservation } from "../actions";

const Schema = z.object({
  guestId: z.string().min(1),
  arrivalDate: z.string().min(1),
});

export function ReservationForm() {
  const form = useForm({ resolver: zodResolver(Schema) });

  return (
    <form action={createReservation} className="space-y-4">
      {/* fields */}
      <button type="submit">Save</button>
    </form>
  );
}
```

### Reading the current user

```typescript
// In any server component
import { auth } from "@/auth";

export default async function Page() {
  const session = await auth();
  // session.user.id, session.user.username, session.user.role
}
```

### Adding a new page

1. Decide its URL → `/app/fo/reservations/cancel/[id]` becomes folder structure
2. Create `src/app/(app)/fo/reservations/cancel/[id]/page.tsx`
3. Default export a function (server by default)
4. Visit `localhost:3000/app/fo/reservations/cancel/123` — it's live

That's it. No route file to edit. No controller to register.

---

## Common errors & fixes

| Error                                      | What it means                              | Fix |
|--------------------------------------------|--------------------------------------------|-----|
| `Environment variable not found: DATABASE_URL` | Prisma can't find `.env`               | `vercel env pull .env` |
| `Cannot find module '@prisma/client'`     | Prisma client not generated                | `npx prisma generate` |
| `Drift detected`                           | DB schema doesn't match migration history | Tell the lead. Don't run reset on shared DB without asking. |
| `params should be awaited`                | Next.js 16: dynamic params are Promises    | `const { id } = await params;` |
| `useState is not a function`              | Used a hook in a server component          | Add `"use client"` at top of file |
| `Cannot find name 'window'`               | Used browser API in server component       | Move that code to a client component |
| `Hydration mismatch`                      | Server and client rendered different HTML | Usually `Date.now()`, `Math.random()`, or browser-only state in a server component |
| Build passes locally, fails on Vercel     | Case-sensitive filesystem on Linux         | Check imports match filenames exactly |
| Login redirects in a loop                 | `AUTH_SECRET` missing or different on prod | Set `AUTH_SECRET` in Vercel env vars |

---

## Git workflow recap

```bash
# Start a feature
git checkout main
git pull
git checkout -b feat/your-feature-name

# Work, commit as you go
git add .
git commit -m "feat: short description"

# Before opening a PR
npm run build              # must pass
git pull origin main       # merge latest main
git push -u origin feat/your-feature-name

# Open PR on GitHub, wait for review, merge
# After merge:
git checkout main
git pull
git branch -d feat/your-feature-name
```

Branch prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`.

Commit message prefixes: same.

Branch lifespan: 1–3 days. If your branch is older than a week, you're doing too much in one go — split it.

---

## When stuck

In order:

1. Read the error carefully — usually it tells you exactly what's wrong
2. Check this cheat sheet's "Common errors" table
3. Paste the error into your AI tool with relevant file context
4. Ask in team chat with: what you tried, the exact error, what you expected

Don't burn 30 minutes silently. Ask after 10.
