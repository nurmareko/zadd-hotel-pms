# ZADD Hotel Management

**New to the project?** Start with [docs/onboarding.md](docs/onboarding.md).

**Stuck on something?** Check [docs/dev_guide.md](docs/dev_guide.md).

## Quick reference

- [Onboarding guide](docs/onboarding.md) — setup, Git flow, module ownership
- [Feature list](docs/feature_list_mvp.md) — what we're building, per module
- [Screen inventory](docs/screen_inventory_mvp.md) — all 27 screens
- [Database spec](docs/db_specification_mvp.md) — data model in prose
- [Use case narrative](docs/use_case_narrative_mvp.md) — actors and use cases
- [Automated testing](docs/testing.md) — pure and dedicated-database test setup
- [AGENTS.md](AGENTS.md) — context for AI coding tools

## Running locally

See [docs/onboarding.md](docs/onboarding.md) for full setup. Quick version:

```bash
npm install
# get .env from team lead
npx prisma generate
npm run dev
```

## Stack

Next.js 16 • TypeScript • Tailwind + shadcn/ui • Prisma • PostgreSQL (Neon) • NextAuth • Vercel
