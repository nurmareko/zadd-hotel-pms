# ZADD Hotel PMS

**New to the project? Start with [docs/onboarding.md](docs/onboarding.md).**

## Quick reference

- [Onboarding guide](docs/ONBOARDING.md) — setup, Git flow, module ownership
- [Feature list](docs/feature_list_mvp.md) — what we're building, per module
- [Screen inventory](docs/screen_inventory_mvp.md) — all 25 screens
- [Database spec](docs/db_specification_mvp.md) — data model in prose
- [Use case narrative](docs/use_case_narrative_mvp.md) — actors and use cases
- [AGENTS.md](AGENTS.md) — context for AI coding tools

## Running locally

See [docs/onboarding.md](docs/onboarding.md) for full setup. Quick version:

```bash
npm install
# get .env.local from team lead
npx prisma generate
npm run dev
```

## Stack

Next.js 16 • TypeScript • Tailwind + shadcn/ui • Prisma • PostgreSQL (Neon) • NextAuth • Vercel