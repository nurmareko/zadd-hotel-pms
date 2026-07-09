---
name: verify
description: Build, launch, and drive the ZADD Hotel PMS app to verify changes end-to-end in a real browser.
---

# Verifying ZADD Hotel PMS changes

## Launch

- `.env` is already populated (Neon DB, remote). No local DB needed.
- Dev server: `npm run dev -- --port 3456 > /path/to/scratch/dev.log 2>&1 &` — ready in ~1s.
- Login credentials (from `prisma/seed.ts`): `admin/admin123`, `fo1/fo123`, `hksup/hksup123`, `hk1/hk123`, `fb1/fb123`, `acc1/acc123`.
- Login form fields: `input#username` / `input#password` (or `[name=...]`), submit via `button[type=submit]`; NextAuth credentials — success navigates to `/`, which redirects into the role app.

## Browser automation

- No Playwright/Chromium on this machine. System Firefox at `/usr/bin/firefox` works with **puppeteer-core over WebDriver BiDi**:
  ```js
  puppeteer.launch({ browser: "firefox", executablePath: "/usr/bin/firefox", headless: true })
  ```
  Install `puppeteer-core` in the scratchpad dir, not the repo.
- Gotcha: `page.goto` intermittently throws `NS_BINDING_ABORTED` (BiDi navigation race). Wrap goto in a 2–3x retry with ~1.5s backoff.
- Gotcha: headless Firefox reports `pointer: coarse`, so the app renders **mobile chrome (top bar + bottom nav) even at 1440px width** — the `desktop` Tailwind variant (`min-width: 768px` + `pointer: fine`) never matches. Verify fine-pointer-only styling by inspecting compiled CSS rule order in `.next/dev/static/chunks/*globals*css*` instead.

## Drive

- FO reservation create form: `/app/fo/reservasi/new` (form is `#reservation-form`).
- Reservation detail: `/app/fo/reservasi/<id>?tab=details&mode=view|edit`; default tab is `folio` for CHECKED_IN.
- To find reservation ids without writing data, query read-only via tsx:
  `env NODE_PATH=$PWD/node_modules npx tsx <script>.ts` (script must wrap awaits in `async function main()` — tsx here compiles to CJS, no top-level await; scratchpad scripts need NODE_PATH to resolve `@prisma/client`).
- Avoid creating reservations/mutations against the shared Neon dev DB unless needed; `npm run db:reset` restores demo data if you must.
