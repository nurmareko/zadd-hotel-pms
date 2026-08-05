# Automated testing

The project has two intentionally separate Vitest paths.

## Pure unit tests

```bash
npm test
npm run test:watch
```

These tests live in `src/lib/__tests__/`, use `vitest.config.mts`, and never require PostgreSQL or a running application.

## PostgreSQL integration tests

Database-backed tests live in `tests/db/` and use `vitest.db.config.mts`. They run serially and truncate/rebuild explicit fixtures before each test because the production actions open their own serializable transactions; wrapping tests in an outer rollback transaction would not include those independent transactions.

### Safety requirement

Set `TEST_DATABASE_URL` to a dedicated disposable PostgreSQL database. The DB runner refuses to continue when:

- `TEST_DATABASE_URL` is missing;
- it is not a PostgreSQL URL; or
- it resolves to the same URL as `DATABASE_URL`.

After the guard passes, the runner assigns the test URL to Prisma's `DATABASE_URL` and `DATABASE_URL_UNPOOLED` only in the child test process. It then applies the existing migrations and runs the DB suite.

Never point `TEST_DATABASE_URL` at the development or Neon database. Test cleanup truncates every application table in the selected database.

### Local PostgreSQL example

Create an empty local database using your preferred PostgreSQL installation or container runtime. For example, with Podman:

```bash
podman run --name zadd-pms-test-postgres \
  -e POSTGRES_USER=zadd_test \
  -e POSTGRES_PASSWORD=zadd_test \
  -e POSTGRES_DB=zadd_pms_test \
  -p 55432:5432 \
  -d docker.io/library/postgres:16-alpine
```

Add the dedicated URL to the ignored local `.env` file:

```dotenv
TEST_DATABASE_URL=postgresql://zadd_test:zadd_test@127.0.0.1:55432/zadd_pms_test
```

Then run:

```bash
npm run test:db
```

The command runs `prisma migrate deploy` against the test URL before Vitest. Fixtures create only the users, room types, rooms, guests, reservations, nightly snapshots, folios, articles, settings, lines, and payments required by each assertion; the demo seed is not used.
