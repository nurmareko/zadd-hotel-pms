# Issue #296 — English UI standardization implementation report

## Summary

Standardized application-owned UI copy to International Hospitality English across Public, Front Office, Housekeeping, Food & Beverage, Accounting, Revenue, Admin, and shared components. Updated governance, navigation, authentication, forms, validation, errors, notifications, accessibility text, export headings, and descriptive dates. Retained IDR numeric formatting, route/query identifiers, enum values, persisted protocol values, and transaction/financial guards.

## Diff summary

Before this report: 360 tracked files changed, 4,741 insertions and 4,658 deletions; three new source/test files. Most edits are string translations and matching assertion updates. The new files provide disposal-reason display mapping and regression coverage for disposal labels and versioned signed GRCs. This report adds the fourth new file.

## Verification

Final integrated commands:

| Command | Actual result |
| --- | --- |
| `npm test` | Exit 0: `Test Files 89 passed (89)`, `Tests 2807 passed (2807)`; duration 21.92s. |
| `npm run lint` | Exit 0: `eslint`; no errors or warnings. |
| `npx tsc --noEmit` | Exit 0; no diagnostics. |
| `npm run build` | Exit 0; Next.js 16.2.4 production build, TypeScript, page-data collection and static generation passed; `Generating static pages ... (23/23)`. |
| `git diff --check` | Exit 0; no whitespace errors. |

Earlier integration checks caught and resolved translated check-in purpose values, unsupported historical GRC downloads, five JSX apostrophe lint errors, two stale proxy-message assertions, and saved disposal reasons displayed without English labels.

### Live browser verification

Used `agent-browser` against a bounded local production server. Confirmed English login labels and empty-submission errors (`Username is required`, `Password is required`), then signed in with the existing demo admin account. Read-only checks observed:

| URL | Observed copy |
| --- | --- |
| `/app/fo/reservasi/list` | Reservation List, Check-in, Check-out, Total (Rp), Balance (Rp) |
| `/app/hk/rooms` | Room Board, Housekeeping SOP Guide, Room Status, Staff, Notes & Actions |
| `/app/fb/tables` | Floor Plan & Tables, Capacity, Location, Status, Orders |
| `/app/acc/night-report` | Night Report, Business date, Occupancy %, ARR / ADR, Total Revenue |
| `/app/admin/users` | Users, Add User, All Roles, All Statuses |
| `/app/revenue/reports` | Revenue Report, Total Revenue, Occupancy, Calculation Basis, Revenue Summary, Daily Breakdown |
| `/app/profile` | Profile, Account, Change Password, Current password, New password, Confirm new password |

English navigation was observed across modules. Browser console and page-error checks returned no entries. One initial URL wait timed out after successful login; subsequent inspection and a second pathname-based run confirmed success. No financial or operational mutations were submitted. Browser sessions and the owned server were closed; port 3000 was confirmed free.

Focused GRC checks also rendered and extracted text from both PDF versions. Version 1 retains its original presentation; version 2 uses English.

## Deviations and compatibility

- Extended the pass to profile, forbidden/error pages, API permission messages, proxy responses, shared PDF/CSV generation, and accessibility copy because these are user-visible surfaces covered by the English-only requirement.
- Added English GRC template v2 and retained v1 support and presentation. Historical signed snapshots must not be retranslated. Strict authorization, snapshot parsing, signature integrity checks, and the prohibition on live-data fallback remain intact.
- Separated English labels from persisted purpose, housekeeping, laundry, and disposal values rather than translating their transport/storage representations.
- Added focused regression tests, not new test infrastructure, for versioned GRC compatibility and value-preserving disposal display.
- No commits, pushes, schema modifications, migrations, or environment-file changes.

## Open concerns

- DB-backed tests were not run because a dedicated `TEST_DATABASE_URL` is not configured. They must pass against a disposable PostgreSQL database before pushing, as required by project policy. Never substitute the development or production URL.
- Browser coverage was representative and read-only, not every dialog or mutation. Financial correctness and concurrency were not claimed from browser checks.
- Existing user-entered records, catalogue content, notes, protocol values, and historical signed GRCs may intentionally contain Indonesian. Application-owned display labels use English.
- Human review remains required, especially by the HK, FB, and ACC owners.

## Files changed

The following generated manifest lists each implementation file once with its change purpose. Paths are repository-relative.

- `AGENTS.md` — Mandate International Hospitality English and define the shared glossary and preservation rules.
- `docs/design.md` — Align design-language governance and examples with the English glossary.
- `docs/issue-296-implementation-report.md` — Record the per-file manifest, verification evidence, compatibility decisions, and limitations.
- `src/app/(public)/login/login-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/(public)/login/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/api/hk/daily-list/route.ts` — Translate user-visible API/access messages without changing access behavior.
- `src/app/api/hk/notifications/route.ts` — Translate user-visible API/access messages without changing access behavior.
- `src/app/api/reservations/[id]/grc/route.ts` — Translate download errors and accept supported signed GRC template versions.
- `src/app/app/acc/accounting-export/export/route.ts` — Translate generated document/export copy and descriptive dates.
- `src/app/app/acc/accounting-export/page.tsx` — Translate generated document/export copy and descriptive dates.
- `src/app/app/acc/arr-range-card.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/arr-result-summary.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/audit-history.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/audit-status-banner.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/folios/[folioId]/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/manager-flash-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/manager-flash-date-picker.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/manager-flash-view.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/night-audit/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/acc/night-audit/blocker-list.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/night-audit/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/night-audit/pre-run-summary.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/night-audit/result-panel.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/night-audit/run-button.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/reports/[auditId]/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/reports/[auditId]/report-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/reports/[auditId]/report-view.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/acc/today-snapshot.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/activity-log/activity-log-display.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/admin/activity-log/activity-log-display.ts` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/activity-log/activity-log-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/activity-log/loading.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/activity-log/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/articles/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/articles/article-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/articles/article-row-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/articles/article-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/articles/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/rooms/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/rooms/room-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/rooms/room-row-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/rooms/room-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/rooms/room-type-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/rooms/room-type-row-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/rooms/room-type-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/rooms/rooms-tabs.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/rooms/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/settings/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/settings/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/settings/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/settings/settings-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/tables/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/admin/tables/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/tables/restaurant-tables-tabs.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/tables/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/tables/table-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/tables/table-layout-editor.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/tables/table-list.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/tables/table-row-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/users/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/users/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/admin/users/user-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/users/user-row-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/admin/users/user-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/error.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fb/dashboard/fb-dashboard-cards.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/dashboard/fb-dashboard-view.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/dashboard/fb-date-picker.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/floor-plan.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/inventory/inventory-dialogs.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/inventory/inventory-view.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/kitchen/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fb/kitchen/kitchen-display.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fb/kitchen/kitchen-display.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/kitchen/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/menu/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fb/menu/category-labels.ts` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/menu/menu-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/menu/menu-item-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/menu/menu-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/menu/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fb/order-list.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fb/orders/[orderId]/bill/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fb/orders/[orderId]/bill/bill-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/bill/bill-view.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/bill/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/bill/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fb/orders/[orderId]/kitchen-items.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fb/orders/[orderId]/menu-browse.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/menu-item-card.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/order-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/order-cart.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/order-item-row.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/payment/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/payment/payment-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/[orderId]/schema.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fb/orders/[orderId]/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fb/orders/new/confirm-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/new/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/orders/new/room-service-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/pos/active-bills-strip.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/pos/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/pos/pos-cart-item.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/pos/pos-new-order-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/pos/pos-payment-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/pos/pos-state.ts` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/pos/restaurant-pos.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fb/pos/restaurant-pos.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/pos/running-tables-sidebar.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/table-card.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fb/table-status-popover.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/check-out/[folioId]/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/check-out/[folioId]/checkout-forms.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/check-out/[folioId]/errors.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/check-out/[folioId]/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/(views)/kalender/date-range-picker-popover.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/(views)/kalender/date-range-picker.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/reservasi/(views)/kalender/date-range-picker.ts` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/(views)/kalender/tape-chart-legend.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/(views)/kalender/tape-chart.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/reservasi/(views)/kalender/tape-chart.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/(views)/list/reservation-filters.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/(views)/list/reservation-pagination.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/(views)/list/reservation-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/(views)/reservations-view-header.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/[id]/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/reservasi/[id]/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fo/reservasi/[id]/cancel-reservation-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/[id]/check-in-detail-panel.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/[id]/extend-stay-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/[id]/inclusion-panel.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/[id]/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/[id]/request-cleaning-button.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/export/route.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/reservasi/export/route.ts` — Translate generated document/export copy and descriptive dates.
- `src/app/app/fo/reservasi/grup/[groupBookingId]/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/reservasi/grup/[groupBookingId]/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fo/reservasi/grup/[groupBookingId]/group-inclusion-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/grup/[groupBookingId]/group-settlement-actions.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/grup/[groupBookingId]/inclusion-actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/reservasi/grup/[groupBookingId]/inclusion-actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fo/reservasi/grup/[groupBookingId]/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/new/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/reservasi/new/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fo/reservasi/new/guest-lookup-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/new/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/new/reservation-errors.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/reservasi/new/reservation-errors.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fo/reservasi/new/reservation-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/reservasi/new/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/fo/room-blocks/block-dialogs.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/room-blocks/export/route.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/room-blocks/export/route.ts` — Translate generated document/export copy and descriptive dates.
- `src/app/app/fo/room-blocks/filters.ts` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/room-blocks/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/room-blocks/queries.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/staff-performance/[userId]/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/staff-performance/activity.ts` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/staff-performance/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/tamu/export/route.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/fo/tamu/export/route.ts` — Translate generated document/export copy and descriptive dates.
- `src/app/app/fo/tamu/guest-filters.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/tamu/guest-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/fo/tamu/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/forbidden/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/hk/laundry/batch-action-buttons.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/laundry/create-batch-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/laundry/guest-laundry-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/laundry/guest-laundry-view.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/laundry/laundry-filters.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/laundry/laundry-summary-cards.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/laundry/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/laundry/receive-batch-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/lost-found/disposal-reason-labels.test.ts` — Cover known reason labels, legacy delimiters, and unchanged arbitrary text.
- `src/app/app/hk/lost-found/disposal-reason-labels.ts` — Map known disposal reasons to English while preserving stored values and note content.
- `src/app/app/hk/lost-found/export/route.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/hk/lost-found/export/route.ts` — Translate generated document/export copy and descriptive dates.
- `src/app/app/hk/lost-found/lost-found-dialogs.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/lost-found/lost-found-filters.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/lost-found/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/mobile/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/hk/mobile/mobile-pool-card.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/mobile/mobile-presentation.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/mobile/mobile-task-card.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/mobile/mobile-view.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/mobile/quick-lost-found-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/mobile/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/hk/room-status-control.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/[roomId]/action-panel.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/[roomId]/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/hk/rooms/[roomId]/active-cleaning-panel.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/[roomId]/housekeeper-work-panel.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/[roomId]/inspection-panel.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/[roomId]/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/[roomId]/room-header.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/[roomId]/room-history.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/[roomId]/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/hk/rooms/[roomId]/status-info.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/hk/rooms/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/hk/rooms/bulk-actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/hk/rooms/bulk-actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/hk/rooms/bulk-assignment-panel.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/export/route.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/hk/rooms/export/route.ts` — Translate generated document/export copy and descriptive dates.
- `src/app/app/hk/rooms/inline-housekeeper-select.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/inspection-inbox.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/room-board-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/room-filter-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/room-task-note-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/supervisor-room-status-select.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/hk/rooms/task-note-schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/profile/account-card.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/profile/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/profile/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/profile/password-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/profile/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/revenue/meal-plans/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/revenue/meal-plans/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/revenue/meal-plans/export/route.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/revenue/meal-plans/export/route.ts` — Translate generated document/export copy and descriptive dates.
- `src/app/app/revenue/meal-plans/loading.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/meal-plans/meal-plan-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/meal-plans/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/meal-plans/schema.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/revenue/meal-plans/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/revenue/reports/loading.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/reports/page.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/reports/report-content.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/seasons/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/app/revenue/seasons/export/route.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/revenue/seasons/export/route.ts` — Translate generated document/export copy and descriptive dates.
- `src/app/app/revenue/seasons/loading.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/seasons/pricing-preview.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/seasons/pricing-rule-form.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/seasons/pricing-rule-table.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/app/revenue/seasons/schema.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/app/app/revenue/seasons/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/app/error.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/app/global-error.tsx` — Set English document language and translate application-owned copy.
- `src/app/layout.tsx` — Set English document language and translate application-owned copy.
- `src/app/not-found.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/check-in/signature-pad-field.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/country-combobox.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/folio/add-charge-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/folio/folio-charges.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/folio/folio-header.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/folio/folio-payments.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/folio/folio-summary.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/folio/folio-view.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/folio/record-payment-dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/hk/amenities-stepper.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/hk/hk-sop-accordion.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/housekeeping-notification-bell.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/nav-shell.tsx` — Translate desktop/mobile navigation and account actions while retaining navigation keys.
- `src/components/ui/dialog.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/components/ui/skeleton.tsx` — Translate UI labels, descriptions, controls, statuses, or accessibility copy.
- `src/lib/__tests__/accounting-export.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/__tests__/additional-money-helpers.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/__tests__/housekeeper-mobile-data.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/__tests__/housekeeping-log-description.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/__tests__/housekeeping-priority.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/__tests__/meal-plan-prices.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/__tests__/night-audit.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/__tests__/revenue-reports.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/__tests__/stay-charges.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/accounting-export.ts` — Translate generated document/export copy and descriptive dates.
- `src/lib/action-errors.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/action-errors.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/article-departments.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/article-departments.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/check-in/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/check-in/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/check-in/errors.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/check-in/errors.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/check-in/schema.ts` — Translate validation and expose English labels without changing persisted purpose values.
- `src/lib/check-out/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/check-out/errors.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/check-out/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/countries.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/fb-order-guest.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/fb-orders/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/fb-orders/pos-return.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/fb/dashboard-metrics.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/fb/dashboard-metrics.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/fb/inventory-actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/fb/inventory-actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/folio-balance-display.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/folio/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/folio/errors.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/folio/errors.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/folio/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/format.ts` — Use English descriptive dates while preserving IDR numeric formatting.
- `src/lib/grc-snapshot.test.ts` — Verify supported GRC versions, integrity, captured-data rendering, and rejection paths.
- `src/lib/grc-snapshot.ts` — Version new English GRC snapshots while accepting historical v1 snapshots.
- `src/lib/guest-id-type.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/guests/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/guests/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/housekeeper-clean-data.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/housekeeping-list-data.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/housekeeping-log-description.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/housekeeping-notifications.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/housekeeping-priority.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/housekeeping/__tests__/amenities-stepper.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/housekeeping/amenities.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/housekeeping/cleaning-actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/housekeeping/cleaning-operations.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/housekeeping/cleaning-operations.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/kitchen-stations.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/kitchen-stations.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/laundry/__tests__/guest-laundry.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/laundry/__tests__/laundry-data.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/laundry/__tests__/laundry-logic.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/laundry/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/laundry/data.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/laundry/guest-actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/laundry/guest-schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/laundry/logic.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/lost-found/__tests__/lost-found-actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/lost-found/__tests__/lost-found-logic.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/lost-found/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/lost-found/filters.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/lost-found/labels.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/lost-found/operations.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/lost-found/reference-code.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/lost-found/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/nav-badges.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/nav-badges.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/night-audit.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/pdf/bill.tsx` — Translate generated document/export copy and descriptive dates.
- `src/lib/pdf/fb-bill.tsx` — Translate generated document/export copy and descriptive dates.
- `src/lib/pdf/grc.tsx` — Render English v2 GRCs and preserve historical v1 presentation.
- `src/lib/pdf/hk-daily-list.tsx` — Translate generated document/export copy and descriptive dates.
- `src/lib/pdf/night-report.tsx` — Translate generated document/export copy and descriptive dates.
- `src/lib/pricing-resolver.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/reservation-capacity.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/reservation-inclusions/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/reservation-meal-plan-change.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/reservation-stay-fee-definitions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/reservation-stay-fees.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/reservations/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/revenue-reports.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/room-blocks/actions.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/lib/room-blocks/actions.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/room-blocks/operations.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/room-blocks/overlap.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/room-blocks/schema.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/lib/stay-charges.ts` — Translate shared display, validation, or operation messages without weakening guards.
- `src/proxy.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `src/proxy.ts` — Translate user-visible API/access messages without changing access behavior.
- `tests/db/check-in.db.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `tests/db/fb-orders.db.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `tests/db/housekeeping-notifications.db.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `tests/db/inventory.db.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `tests/db/night-audit.db.test.ts` — Update English message/display expectations while retaining behavioral assertions.
- `tests/db/payment-checkout.db.test.ts` — Update English message/display expectations while retaining behavioral assertions.
