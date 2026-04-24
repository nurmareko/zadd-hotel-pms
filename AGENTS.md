<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hotel PMS — Agent Context

## What this is
Hotel Property Management System for Telkom University hospitality
praktikum. Students rotate through 5 operational roles
(FO / HK / FB / ACC / ADMIN). MVP scope — see docs/feature_list_mvp.md.

## Stack
- Next.js 16 App Router, TypeScript, server components by default
- PostgreSQL (Neon, provisioned via Vercel Storage)
- Prisma ORM
- NextAuth (credentials provider)
- Tailwind + shadcn/ui
- Zod for form validation

## Routing
- src/app/(public)/ — unauthenticated (login only)
- src/app/(app)/   — authenticated, role-gated by middleware
- Route segments match role codes: /fo /hk /fb /acc /admin

## Reference docs (read before implementing a feature)
- docs/feature_list_mvp.md       — functional scope per module
- docs/screen_inventory_mvp.md   — screen-by-screen specs
- docs/db_specification_mvp.md   — table-level data model
- docs/use_case_narrative_mvp.md — use case diagram narrative
- docs/design.md                 — visual conventions (created later)
- prisma/schema.prisma           — source of truth for data model

## Commands
- npm run dev
- npx prisma migrate dev      # requires .env.local populated
- npx tsx prisma/seed.ts      # seeds 5 roles + admin user
- npm run build               # run before ending any session

## Deployment
- Host: Vercel (project linked via `vercel link`)
- DB:   Neon, provisioned through Vercel Storage, Singapore region
- Env:  `vercel env pull .env.local` to sync local env with Vercel
- DATABASE_URL is pooled (runtime). DIRECT_URL is unpooled (migrations).

## Rules
- Do not modify prisma/schema.prisma without asking. Schema changes
  require docs/db_specification_mvp.md to be updated first.
- Mutations via server actions. Pages are server components unless
  they need hooks (usePathname, useForm, charts).
- Status badge palette: VC green, VD yellow, OC blue, OD red, OOO gray.