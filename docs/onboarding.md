# Team Onboarding

Welcome! This doc gets you from "I just joined" to "I can work on a feature" in about 30–45 minutes. Read it once top-to-bottom, then use it as a reference.

---

## What we're building

A Hotel Property Management System for the hospitality praktikum. Four operational roles (Front Office, Housekeeping, F&B, Accounting) plus Admin. MVP is 29 screens across 5 modules.

**Before coding anything, skim these:**
- `docs/feature_list_mvp.md` — what we're building, per module
- `docs/screen_inventory_mvp.md` — all 29 screens and what each does

Those two are the source of truth. When in doubt about scope, check them first.

---

## The stack (learn in order, not all at once)

You're going to pick up most of this by working on it. Don't try to master the stack before writing code — you won't.

| Tech | What it does | How to learn |
|---|---|---|
| **Next.js 16** | Framework — routing, pages, server logic | Read 15-min intro (link below) |
| **TypeScript** | JavaScript with types | Learn as you go |
| **Tailwind CSS** | Styling via utility classes | Learn as you go |
| **shadcn/ui** | Pre-built components (Button, Form, Dialog) | Learn as you go |
| **signature_pad** | Canvas-based guest signature capture during FO check-in | Read its usage in the check-in form |
| **Prisma** | Database access from TypeScript | Read 15-min quickstart (link below) |
| **PostgreSQL (Neon)** | The actual database | No need to learn deeply — Prisma abstracts it |
| **NextAuth** | Login & sessions | Only relevant when we reach auth |
| **Vercel** | Hosting & deployment | No setup from you — auto-deploys on merge |

**Read-first links (~30 min total):**
- Next.js App Router: https://nextjs.org/learn
- Prisma quickstart: https://www.prisma.io/docs/getting-started
- Tailwind fundamentals: https://tailwindcss.com/docs/utility-first

Bookmark these. You'll come back.

---

## Prerequisites — install these first

1. **Node.js 20 LTS or newer** — https://nodejs.org
2. **Git** — https://git-scm.com (Windows: select "Git Bash" during install)
3. **VS Code** — https://code.visualstudio.com (recommended, any editor works)
4. **GitHub account** — create one if you don't have it
5. **AI coding tool** — pick one and stick with it:
   - **Claude Code** (what most of us use) — https://claude.com/claude-code
   - **Cursor** / **Codex CLI** — also fine

Ask the team lead to add you as a collaborator on the GitHub repo before continuing.

---

## Getting the project running locally

Takes ~10 minutes when things go smoothly. If something fails, jump to "Getting unstuck" at the bottom.

```bash
# 1. Clone the repo (use the URL from GitHub's green "Code" button)
git clone https://github.com/<org>/hotel-pms.git
cd hotel-pms

# 2. Install dependencies
npm install

# 3. Pull the linked Vercel project's env vars into the root .env file
#    Ask the team lead for Vercel project access first. DO NOT commit this file.
vercel env pull .env

# 4. Generate the Prisma client (reads prisma/schema.prisma)
npx prisma generate

# 5. Start the dev server
npm run dev
```

Open http://localhost:3000 — you should see the Console-themed login page with direct demo-account buttons.

### Seed accounts to know

| Username | Password | Role | Landing |
|---|---|---|---|
| hksup | hksup123 | HK supervisor (`isSupervisor`) | `/app/hk` → `/app/hk/supervisor` |
| hk1 | hk123 | HK housekeeper | `/app/hk` → `/app/hk/clean` |
| hk2 | hk2123 | HK housekeeper | `/app/hk` → `/app/hk/clean` |
| hk3 | hk3123 | HK housekeeper | `/app/hk` → `/app/hk/clean` |

### About the database

We all share one Neon dev database. This keeps setup simple but comes with rules:

- **Don't edit `prisma/schema.prisma`** on your branch. Schema changes go through the team lead — this prevents conflicting migrations that break everyone's environment.
- **Don't run destructive commands** without asking in the team chat first. That includes `npm run db:reset`, `prisma db push --force-reset`, or manually dropping tables.
- Reading data, inserting test data through the app, seeding your own test rows → all fine.
- If you accidentally trash data, ping the team — we can re-seed.

---

## Project map

```
hotel-pms/
├── AGENTS.md                        ← Context for AI coding tools. READ THIS.
├── docs/
│   ├── feature_list_mvp.md          ← Features per module
│   ├── screen_inventory_mvp.md      ← All 29 screens
│   ├── db_specification_mvp.md      ← Data model in prose
│   ├── use_case_narrative_mvp.md    ← Use cases & actors
│   └── onboarding.md                ← This file
├── prisma/
│   └── schema.prisma                ← DB schema. Don't edit without approval.
├── src/app/                         ← Next.js App Router pages
│   ├── (public)/                    ← Unauthenticated (login)
│   ├── app/                         ← Authenticated app
│   │   ├── fo/                      ← Front Office
│   │   ├── hk/                      ← Housekeeping
│   │   ├── fb/                      ← Food & Beverage
│   │   ├── acc/                     ← Accounting
│   │   ├── admin/                   ← Admin
│   │   └── profile/                 ← Account metadata + password change
│   ├── api/
│   │   ├── auth/[...nextauth]/      ← NextAuth route handlers
│   │   └── nav-badges/              ← Current role's nav badges
│   └── layout.tsx
├── src/auth.config.ts               ← Edge-safe auth config used by proxy
├── src/auth.ts                      ← Credentials + Prisma auth config
├── src/lib/date-only.ts             ← WIB date helpers
├── src/lib/nav-badges.ts            ← ACC pending Night Audit badge
├── src/proxy.ts                     ← Auth + role gating for /app/*
└── package.json
```

If you're unsure what a screen should look like or do, check `docs/screen_inventory_mvp.md` before asking. Most answers are already there.

### Hotel-timezone convention

All operational "today" calculations use WIB (`Asia/Jakarta`), not the server's UTC date. For Prisma `@db.Date` queries, use `todayDateOnly()` or `dateOnlyBoundary()` from `src/lib/date-only.ts`. For timestamp-column filters, use `hotelTodayTimestampRange()`.

Navigation badges are intentionally small in scope: `GET /api/nav-badges` serves the single ACC pending Night Audit indicator from `src/lib/nav-badges.ts`.

Housekeeping routes are role-aware:

- `/app/hk` is a redirect, not a screen. HK members land on `/app/hk/clean`; HK supervisors and ADMIN land on `/app/hk/supervisor`.
- `/app/hk/clean` is My Rooms / Kamar Saya for assigned housekeeper work.
- `/app/hk/rooms/[id]` is the shared room detail. Housekeepers clean/log; supervisors inspect/history/status.
- `/app/hk/rooms` is the supervisor rooms worksheet and merged status board. `/app/hk/list` is retired and redirects here.
- `/app/hk/lost-found` is shared by HK, FO, and ADMIN for text-only item custody.

Housekeeping data has two separate responsibilities: `CleaningSession` is the source for assignment, timer, finish, and inspection; `HousekeepingLog` is the audit trail for room-status changes. Reservation comments are not duplicated for HK: `Reservation.notes` is the canonical note, editable by FO and read-only to HK.

---

## How we work — Git flow

One branch per feature or fix. No commits directly to `main`.

```bash
# Starting a new feature
git checkout main
git pull
git checkout -b feat/your-feature-name

# ...do the work, commit as you go...
git add .
git commit -m "feat: short description of what you did"

# When ready to share
git push -u origin feat/your-feature-name
# Then open a Pull Request on GitHub
```

**Branch names:**
- `feat/reservation-form` — new feature
- `fix/tape-chart-overlap` — bug fix
- `docs/update-readme` — docs only
- `chore/cleanup-imports` — maintenance

**Commit messages** use the same prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`. Keep them short and in imperative mood ("add reservation form", not "added reservation form").

**Before opening a PR:**
1. Run `npm run build` — it must succeed.
2. Visit your changed pages in the browser — they must render without errors.
3. `git pull origin main` and merge main into your branch if it's been a few days.

**PR description should include:** what you built, which screens it affects, anything unusual. Keep it brief. Team lead reviews and merges.

**Claiming work:** you own your module's screens by default — no need to claim individual screens within it. If you need to work on someone else's module (e.g., fixing a bug that blocks you), post in team chat first.

---

## Module ownership

Each person owns one operational module end-to-end:

| Owner | Module | Route prefix | Screens | Spec section |
|---|---|---|---|---|
| Person 1 | Front Office | `/app/fo/*` | 7 | `feature_list_mvp.md` §FO |
| Person 2 | Housekeeping | `/app/hk/*` | 5 | `feature_list_mvp.md` §HK |
| Person 3 | Food & Beverage | `/app/fb/*` | 5 | `feature_list_mvp.md` §FB |
| Person 4 | Accounting | `/app/acc/*` | 3 | `feature_list_mvp.md` §ACC |
| Team lead | Admin, shared code, integration | `/app/admin/*`, `src/lib`, `src/components` | 6 + shared | — |

**What "owning" a module means:**
- You build all screens in that route prefix
- You decide internal structure (component breakdown, server actions, state)
- You're the go-to person for questions about that module
- You review PRs that touch your module if another teammate needs to change it

**What it does NOT mean:**
- The schema is yours. `prisma/schema.prisma` is team-lead-owned. If you need a column added, ping the lead.
- Shared components are yours. Anything in `src/components/` (e.g., `NavShell`, `StatusBadge`, `DataTable`) is shared code — changes go through the team lead.
- You work alone. Ask for help, pair when stuck.

**Cross-module dependencies to watch for:**

The modules touch each other in a few specific places. These are the integration seams where coordination matters:

- **F&B → FO**: "Charge to Room" in F&B Payment (FB-04) writes a line item to the guest's folio from `src/app/app/fb/orders/[orderId]/actions.ts`.
- **FO → HK**: Check-out (FO-07) auto-sets room status to `VD`; an in-house cleaning request from reservation detail sets `OC → OD`.
- **HK → FO**: Kalender (FO-02) displays the status HK updates. Room-status changes revalidate cross-module views through `src/lib/revalidate-room-status.ts`.
- **HK ↔ FO**: Lost & Found lets HK log text-only items and FO search when guests ask. Returning an item is an HK supervisor/ADMIN resolution action.
- **Everything → ACC**: Night Audit (AC-02) reads across all modules. Accounting owner is the last to build, because they need the other three modules producing data.

When a cross-module seam comes up, don't design it on your own branch. Open a team chat discussion, team lead writes the shared code, all four modules consume it.

**Build order suggestion:** FO first (has the most screens and blocks everyone else because folios underpin F&B and ACC), HK and F&B in parallel once FO's folio lifecycle works, ACC last. Your timelines will shift — just keep the team lead informed when you're blocked on someone else's work.

---

## How we use AI (vibe-coding)

A few rules so we don't step on each other:

1. **Read AGENTS.md once.** Your AI tool loads it automatically on every session, but knowing what's in it helps you spot when the AI misses a convention.
2. **Point the AI at the spec.** Example prompt:
   > "Implement FO-04 Reservation Form per docs/screen_inventory_mvp.md. Use the Reservation model from prisma/schema.prisma. Zod validation, server action for submit."
3. **Review every line.** Don't commit code you can't explain. If a PR reviewer asks "why did you do X here?" and your answer is "the AI wrote it" — that's a reject.
4. **Small scopes work better.** Prompt for one screen or one feature at a time, not a whole module.
5. **Stuck debugging?** Paste the error + the relevant file into the AI and ask "why?" before asking the team. Saves everyone time.

---

## Getting unstuck

**`npm install` fails** → check Node version: `node --version`. Needs 20+.

**`npx prisma generate` fails** → `.env` is missing or has wrong values. Re-run `vercel env pull .env`; ask the team lead to confirm your Vercel project access if it still fails.

**Dev server runs but every page 500s** → database isn't reachable. Test with:
```bash
npx prisma db pull
```
If it fails, env vars are wrong or you're offline.

**Dev server runs but a specific page 500s** → share in team chat:
- The URL you were on
- The full terminal error
- What you last changed

**Git merge conflict** → don't resolve blindly. Ask the lead to walk you through your first one. After that, you're fine.

**AI generated code you don't understand** → don't commit it. Ask the AI to explain, ask a teammate, or rewrite it simpler.

**Build passes locally but fails on Vercel** → usually a case-sensitivity issue. Mac/Windows filesystems are case-insensitive; Vercel's Linux build is strict. Check imports: `import { X } from './file'` must match the actual filename exactly.

---

## Questions?

Ask in the team group chat. No question is too basic in the first 2 weeks — it's faster for everyone if you ask early.

When asking, include:
- What you were trying to do
- What command or action you ran
- The exact error message (paste it, don't paraphrase)

This one habit will get your questions answered 5x faster.
