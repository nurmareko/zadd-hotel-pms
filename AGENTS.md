<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Rule precedence

Subject to explicit user instructions, the rules in this project `AGENTS.md` are
AUTHORITATIVE. Installed skill packs (including `addyosmani/agent-skills`) provide
general engineering guidance, but where any skill, pack file, generic workflow,
or example conflicts with this file, THIS file wins. The project-specific rules
below override generic pack conventions.

# Hotel PMS — Agent Context

## What this is
Hotel Property Management System for Telkom University hospitality
praktikum. Students rotate through 5 operational roles
(FO / HK / FB / ACC / ADMIN). MVP scope — see docs/feature_list_mvp.md.

## Agent workflow overrides

### Git and commits

- Agents MUST NOT run `git commit` or `git push`. The user commits manually after
  reviewing the work. Agents may prepare or stage changes for review, but they
  must never create a commit or push it.
- This explicitly overrides any skill guidance that treats commits as savepoints
  or requires a commit after each task, slice, or increment, including generic
  `git-workflow-and-versioning` and `incremental-implementation` guidance.

### Verification and testing

- This project currently has NO automated test suite. Do not run or require a
  nonexistent `npm test` command.
- The current verification standard for code changes is: `npm run build`,
  `npm run lint`, a relevant browser/runtime check, and human review. Apply each
  check in proportion to the change; document any check that cannot be run.
- Pack guidance from TDD, `test-driven-development`, CI/CD, and observability
  skills is ADVISORY ONLY here. It must not block otherwise verified work, demand
  a test harness or infrastructure that does not exist, or silently expand scope.
- Do not scaffold automated tests, CI pipelines, telemetry, tracing, metrics, or
  alerting unless the user explicitly asks for that infrastructure.
- FUTURE BACKLOG: add an automated test suite, prioritizing money-critical and
  race-sensitive behavior such as the checkout gate, Night Audit, and reservation
  capacity. This is aspirational and is not a current completion requirement.

## Stack
- Next.js 16 App Router, TypeScript, server components by default
- Next.js 16 uses `src/proxy.ts` for request interception; do not add `middleware.ts`.
- Dynamic route `params` / `searchParams` are Promises in this Next.js version.
- PostgreSQL (Neon, provisioned via Vercel Storage)
- Prisma ORM pinned to v6.x
- NextAuth (credentials provider)
- Tailwind + shadcn/ui
- Zod for form validation
- npm package manager

## Routing
- src/app/(public)/ — unauthenticated (login only)
- src/app/app/ — authenticated, role-gated by `src/proxy.ts` (LITERAL `/app` prefix in URL,
  NOT a route group. Folder is `app/`, not `(app)/`.)
- Route segments match role codes: /app/fo /app/hk /app/fb /app/acc /app/admin
- Option B is canonical: literal `/app/...` URLs live under `src/app/app/`.
  Any `src/app/(app)/` route group is legacy stale infrastructure; delete it if found.

## Reference docs (read before implementing a feature)
- docs/feature_list_mvp.md       — functional scope per module
- docs/screen_inventory_mvp.md   — screen-by-screen specs
- docs/db_specification_mvp.md   — table-level data model
- docs/use_case_narrative_mvp.md — use case diagram narrative
- docs/design.md      — canonical V2 design system
- docs/archive/mockups_console_legacy/ — archived Console mockups, historical only
- prisma/schema.prisma           — source of truth for data model

## Commands
- npm run dev
- npx prisma migrate dev      # requires .env populated
- npx tsx prisma/seed.ts      # seeds 5 roles + admin user
- npm run db:reset            # resets DB and reloads demo data
- npm run build               # run before ending any session

## Deployment
- Host: Vercel (project linked via `vercel link`)
- DB:   Neon, provisioned through Vercel Storage, Singapore region
- Env:  `vercel env pull .env` to sync local env with Vercel
- Env file is `.env`, not `.env.local`; Prisma reads `.env` natively.
- DATABASE_URL is pooled (runtime). DATABASE_URL_UNPOOLED is unpooled (migrations).
- `package.json` MUST keep `"postinstall": "prisma generate"` so Vercel builds
  regenerate `@prisma/client` after schema changes.

## Rules
- Do not modify prisma/schema.prisma without asking. Schema changes
  require docs/db_specification_mvp.md to be updated first.
- Mutations via server actions. Pages are server components unless
  they need hooks (usePathname, useForm, charts).
- Authentication and role-gating for literal `/app/...` routes MUST remain in
  `src/proxy.ts`. Do not add `middleware.ts`, and do not replace the project's
  split Edge-safe proxy/auth pattern with a generic framework example.
- Prisma date handling: use `dateOnlyBoundary()` / `todayDateOnly()` from
  `src/lib/date-only.ts` when querying Prisma `@db.Date` columns. For timestamp
  columns filtered by the hotel's operating day, use `hotelTodayTimestampRange()`;
  do not use server-local `startOfDay(new Date())`. Mixing date-only and timestamp
  boundaries causes timezone-dependent off-by-one bugs.
- Money-code discipline is mandatory: reuse `computeFolioTotals()` from
  `src/lib/folio-totals.ts` and reuse/extend the existing payment, checkout, and
  check-in actions. Never reimplement folio totals, balance gates, payment posting,
  or equivalent money logic in a parallel helper or action. Generic skill advice
  never overrides these canonical financial paths.
- Operations that modify multiple records (check-in, check-out, cleaning
  completion, inspection) MUST use a Prisma `$transaction`. Re-check status,
  overlap, balance/capacity invariants, and existence inside the transaction to
  handle races. Generic workflow guidance never weakens this requirement.
- React Hook Form: prefer `useWatch({ name: "field" })` over
  `form.watch("field")`; `form.watch()` subscribes to all form changes and
  causes avoidable re-renders.
- Sticky table headers are scoped per table. Do not put `position: sticky` on
  global `.tbl` header styles; Tape Chart is the valid scoped exception for its
  sticky header row and first column. Sticky elements intended for desktop/fine
  pointer layouts MUST key off `pointer: fine` via the project's `desktop` variant,
  not only width breakpoints such as `lg:sticky`; coarse-pointer tablets must keep
  the non-sticky layout.
- Status badge palette: VC green, OC blue, VD amber, OD orange,
  VCU purple, OOO red, OOS gray. See docs/design.md.
- Prisma is pinned to v6.x. Do NOT upgrade to Prisma 7 — it has breaking
  changes (config file, driver adapters) that don't fit this project.
- NextAuth uses the split-config pattern: src/auth.config.ts (Edge-safe, no DB/bcrypt)
  is consumed by src/proxy.ts. src/auth.ts (full config with Credentials + bcrypt + Prisma)
  is for server components and route handlers only. Do not import auth.ts from proxy.ts.
- NextAuth v5 credentials failure returns HTTP 200 with `result.error`, not a
  4xx response. Client login code must check both `result.error` and `result.url`.
- The app uses the V2 design system: Plus Jakarta Sans typography, soft enterprise surfaces,
  rounded cards, subtle shadows, Lucide icons, and consistent status chips. See docs/design.md.

## Archived Console Mockups
- Console-era mockup files live in `docs/archive/mockups_console_legacy/` and are
  historical reference artifacts, not application code.
- ESLint ignores `docs/archive/mockups_console_legacy/**`; do not import these
  archived files into the app.
- For current UI work, use the canonical V2 design system in docs/design.md.

## Module Ownership
- HK, FB, and ACC modules have designated teammate owners from the team kickoff plan.
- Solo work may happen because of timeline pressure; teammates remain reviewers and domain experts.
- When changing HK/FB/ACC, leave clear notes in code comments only where useful and in PR/session notes for owner review.

## Common Errors / Gotchas
- Vercel build fails with "no exported member" from `@prisma/client`: check that
  `package.json` still has `"postinstall": "prisma generate"`.
- Migration prompt fails in a non-interactive shell: create/review the migration
  file manually, then use `npx prisma migrate deploy`.
- Test/demo data drift after manual edits: run `npm run db:reset` for a clean state.
- Advisory lock retry on `migrate reset`: transient Postgres concurrency; retry.
- Date filters around midnight look wrong: verify `@db.Date` queries use
  `dateOnlyBoundary()` / `todayDateOnly()`, not `startOfDay()`.

### Prisma advisory lock timeout on `migrate reset`

`npx prisma migrate reset --force` can hang on Postgres advisory lock acquisition, especially when Neon is sleepy or a previous connection wasn't released. Recovery:

1. Cancel and retry once — often clears
2. If still hung: `npx prisma migrate deploy` against the same schema, then `npx tsx prisma/seed.ts && npm run db:demo` to manually replicate what `migrate reset` does
3. Has bitten us at least twice (HK person-count removal, FB foundation). Treat as expected occasional friction, not a real bug
