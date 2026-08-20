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

### Local PostgreSQL with Podman

Create the dedicated container once:

```bash
podman run --name zadd-pms-test-postgres \
  -e POSTGRES_USER=zadd_test \
  -e POSTGRES_PASSWORD=zadd_test \
  -e POSTGRES_DB=zadd_pms_test \
  -p 55432:5432 \
  -d docker.io/library/postgres:16-alpine
```

After a reboot or `podman stop`, restart the existing container instead of creating it again:

```bash
podman start zadd-pms-test-postgres
```

Check that PostgreSQL is ready:

```bash
podman exec zadd-pms-test-postgres pg_isready -U zadd_test -d zadd_pms_test
```

Export the dedicated connection string and run the suite:

```bash
export TEST_DATABASE_URL=postgresql://zadd_test:zadd_test@127.0.0.1:55432/zadd_pms_test
npm run test:db
```

A successful run currently reports **43 passed tests**. The command runs `prisma migrate deploy` against the test URL before Vitest. Fixtures create only the users, room types, rooms, guests, reservations, nightly snapshots, folios, articles, settings, lines, and payments required by each assertion; the demo seed is not used.

### Common local database failures

- `P1001`: Prisma cannot reach PostgreSQL. Start the container with `podman start zadd-pms-test-postgres`, then run the readiness check again.
- `P1000`: The credentials in `TEST_DATABASE_URL` do not match the container's PostgreSQL environment. Inspect the configured values with:

  ```bash
  podman inspect zadd-pms-test-postgres | grep POSTGRES
  ```
