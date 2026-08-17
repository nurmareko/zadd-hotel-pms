# ZADD Hotel Management — MVP Screen Inventory

Authoritative inventory for shipped screen counts and IDs, and a reference for interface design and prototyping. The current MVP has **31 logical screens** across four operational modules, Admin, and shared/global access.

**What counts as a "screen":** a logical screen/workspace, not a route. One screen may span several routes or modes: FO-03 covers reservation create, edit, read-only detail, and embedded folio modes; FO-08 spans staff comparison and per-user history routes. Pure redirect routes (`/app/hk` role landing, the temporary `/app/hk/list` compatibility redirect to canonical Supervisor Rooms, the retired FO summary route → Reservasi, `/app/acc/night-report` → latest report) and role-redirect targets are infrastructure, not separate screens. The `/app/hk/list` shim may be retired and must not be used as the worksheet destination. Under this rule, **31 is the authoritative total**.

---

## 1. Top-Level Architecture (MVP)

The application is built as a **single Next.js app** with four operational areas plus an admin area. MVP simplifications from the original plan:

- **One account = one role.** If a student rotates between roles, they get a new account. The Module Switcher screen is removed entirely.
- **Admin does master data + users only.** No cross-module monitoring dashboard. Admins can create themselves an FO/HK/FB/ACC account if they need operational access.
- **Single outlet for F&B.** Hardcoded to "Hotel Restaurant" in the seed. No Outlet CRUD.

```
┌─ Public ──────────────┐
│  /login               │
└───────────────────────┘
┌─ /app (authenticated) ─────────────────────────────────┐
│  Login → module-specific workspace (role-based)        │
│  Persistent nav: sidebar (desktop) / bottom tabs       │
│  (all roles on mobile and coarse-pointer tablets)      │
│                                                        │
│  /app/fo/*    → Front Office                           │
│  /app/hk/*    → Housekeeping (mobile-first)            │
│  /app/fb/*    → Food & Beverage                        │
│  /app/acc/*   → Accounting                             │
│  /app/admin/* → Admin                                  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Global Screens

| # | Screen | Type | Purpose |
|---|---|---|---|
| G-01 | Login | Page | Username + password with direct demo-account buttons. Routes to user's module workspace. |
| G-02 | Profile / Change Password | Page | Account and role metadata, password change, logout. |
| G-03 | 404 / Forbidden | Page | Standard error page. |

---

## 3. Module Screens

### 3.1 Front Office (8 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| FO-01 | **Kalender (Tape Chart)** | Page | `/app/fo/reservasi/kalender`: room-type-grouped room × date grid with unified status colors, unallocated-reservation lanes, checkout marker, click-empty-cell booking, and in-house guest selection. `/app/fo/reservasi` redirects to the user's stored Kalender/List preference. |
| FO-02 | Reservation List | Page | `/app/fo/reservasi/list`: searchable/filterable arrival-window list with in-house carryover, folio balance, and group badges linking to FO-07; the whole row opens reservation detail. |
| FO-03 | Unified Reservation Form / Detail | Page | `/app/fo/reservasi/new` and `/app/fo/reservasi/[id]`: one form handles single- or multi-room creation with repeatable 1–20 room rows, shared stay/guest data, per-room occupancy and allocation, dynamic nightly quotes, atomic creation, and pinned form actions. Read-only detail/edit uses the same structure, with Detail, Inklusi, Pembayaran, and Tagihan tabs plus group sibling context. |
| FO-04 | Check-in | Embedded workflow | Embedded in reservation detail at `/app/fo/reservasi/[id]`: assign or confirm the room, fill the GRC inline, capture the required on-screen digital signature, set deposit, and create the folio. |
| FO-05 | Guest Folio | Embedded workspace | Embedded in FO-03 at `/app/fo/reservasi/[id]?tab=pembayaran` and `?tab=tagihan`: payments, line items, manual charges, and balance. The deprecated `/app/fo/folios/[id]` route is compatibility infrastructure that redirects to the reservation's Tagihan tab, not a standalone screen. |
| FO-06 | Check-out | Page | `/app/fo/check-out/[folioId]`: rounded whole-IDR balance gate—positive blocks; zero or credit proceeds; credit shows a warning and excess-return instruction. Includes final payment and PDF bill download. |
| FO-07 | Group Booking Summary / Actions | Page | `/app/fo/reservasi/grup/[groupBookingId]`: group-room roll-up with per-room pax, current meal plan and stay total, stay-flexibility fee state, reservation/folio status, action eligibility, and folio balance. Supports server-previewed all/selected meal-plan application, all/selected stay-flexibility fees, bulk collection of each pending room's own first-night deposit into its own folio, batch eligible check-in with per-room signatures, per-folio settlement, and eligible checkout. Every bulk mutation reports partial outcomes and delegates to independent canonical per-room transactions; aggregate amounts are display-only and there is no master/shared folio. |
| FO-08 | Kinerja Petugas | Page | `/app/fo/staff-performance` and `/app/fo/staff-performance/[userId]`: ActivityLog-based FO comparison, preset/custom date ranges, sorting, per-user metrics, and paginated activity history. Accessible to FO and ADMIN. |

The retired FO summary route is a compatibility redirect to Reservasi, not a screen. Its departures-due-today queue and occupancy KPI are deferred to a future FO Reports page.

**Still cut/deferred from original**: retired FO summary screen (future reports will replace its useful queue/KPI), separate Reservation Detail (merged into FO-03), In-House Guest List (use Kalender), Master Bill, and Guest Database.

### 3.2 Housekeeping (5 screens, role-aware)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| HK-01 | My Rooms / Kamar Saya | Mobile-first | `/app/hk/clean`: housekeeper worklist grouped by room need, with reservation context and links to room detail. |
| HK-02 | Shared Room Detail | Mobile-first | `/app/hk/rooms/[id]`: role-aware detail. Housekeepers start/finish cleaning, add status notes, log found items, and see the live timer. Supervisors inspect VCU rooms, view history, and review status context. |
| HK-03 | Supervisor Rooms | Page | `/app/hk/rooms`: merged status overview and daily worksheet with current room status, inline supervisor status override, reservation context, housekeeper, note, date navigation, and Daily List print. |
| HK-04 | Supervisor Dashboard | Page | `/app/hk/supervisor`: workload forecast, bulk assignment, VCU awaiting-inspection inbox, and live-status KPIs. |
| HK-05 | Lost & Found | Page | `/app/hk/lost-found`: FO and HK can search/filter, log text-only items with optional room context, and mark an item returned with a resolution note; other roles are denied. |

`/app/hk` is a role-based redirect, not a screen: HK members land on HK-01, and HK supervisors land on HK-04. HK-03 is reached canonically at `/app/hk/rooms`; `/app/hk/list` remains only as a temporary compatibility redirect and may be retired.

**Cut from original**: separate Activity Log screen (room-level history is available from room detail; `housekeeping_log` remains the audit table).

### 3.3 Food & Beverage (5 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| FB-01 | Table Picker + Daily Summary | Page | Per-location table-only spatial floor plan with status-colored table tiles + today's revenue snapshot; RESERVED/OOS tables open status-action popovers; order list includes dine-in and room-service orders |
| FB-01A | New Order | Page | `/app/fb/orders/new`: dine-in mode selects available/reserved table + guest count; `/app/fb/orders/new?service=room-service` validates room → in-house guest → OPEN folio and creates a tableless folio-attached order |
| FB-02 | Captain Order | Page | Fast menu entry: pick item, quantity, notes; header labels room-service orders with room and guest instead of table |
| FB-03 | Order / Bill Detail | Page | Line items, subtotal, auto-computed service charge + tax, "add item" button, "Pay" button |
| FB-04 | Payment | Page | Select method: cash, card, transfer, or charge-to-room. Dine-in CTR picks the in-house guest by room number; room-service CTR uses the attached folio by default while direct payment methods remain available. |

**Cut from original**: Dashboard (merged into FB-01), Order History (tab inside FB-01), Print Bill modal (PDF button on FB-03).

### 3.4 Accounting (3 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| AC-01 | Accounting Dashboard | Page | Current WIB business date and audit state; live occupancy, occupied-room, arrival, departure, running-revenue, and latest completed ARR KPIs; selectable range ARR with cutover/integrity state; completed-audit banner; Night Audit history and daily ARR history; live summary card. |
| AC-02 | Night Audit | Page | Pre-check list → "Run Night Audit" button → progress → result |
| AC-03 | Night Report | Page | Consolidated report: revenue breakdown, occupancy, guest list, transactions. Export PDF. |

AC-03's canonical route is `/app/acc/reports/[auditId]`. `/app/acc/night-report` is the nav/empty-state entry point for AC-03: it redirects to the latest audit's report when one exists (or to `/app/acc/reports/[auditId]` when an `auditId` is passed), and renders the "no audit yet" empty state otherwise. It is a redirect/empty-state surface of AC-03, not a separate screen, so it is not counted in the authoritative total of 31.

**Cut from original**: Report Center, Revenue Distribution Report, Guest Segment Statistics, Guest List Report (all consolidated into AC-03), Manual Bill + List (use Folio line items), standalone Folio Payment page (payment is handled in FO-05 and final settlement in FO-06).

### 3.5 Admin (7 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| AD-01 | User Management | Page | CRUD users, assign role (single role per user in MVP) |
| AD-02 | Rooms & Room Types | Page | Combined: CRUD room types (with base rate inline) and rooms |
| AD-03 | Articles | Page | CRUD charge codes |
| AD-04 | F&B Menu | Page | CRUD menu items (single outlet) |
| AD-05 | F&B Tables | Page | `/app/admin/tables`: CRUD restaurant table master data + Layout tab for drag-to-arrange floor positions per location |
| AD-06 | Hotel Settings | Page | Hotel info, tax %, service charge %, night-audit cutoff time |
| AD-07 | Pricing Rules | Page | `/app/admin/pricing-rules`: CRUD/toggle weekday or date-range room-type adjustments using amount or percentage deltas, with precedence/overlap validation and a resolved-price preview. |

**Cut from original**: Admin Dashboard (admins land directly on User Management), Role Management (5 roles hardcoded in seed), Rate Plans (rate inlined into RoomType), Outlets (single outlet hardcoded), Guest Segments.

**AD-05 Layout tab:** spatial editor for restaurant table positions by Indoor/Outdoor/Private location, with drag-to-arrange tiles and auto-arrange.

---

## 4. Screen Count Summary

| Module | Pages | Cut from original |
|---|---:|---:|
| Global | 3 | 1 (Module Switcher) |
| Front Office | 8 | 5 |
| Housekeeping | 5 | 1 |
| Food & Beverage | 5 | 3 |
| Accounting | 3 | 7 |
| Admin | 7 | 4 |
| **Total** | **31** | **21 cut** |

Modal dialogs stay focused: cancellation uses a confirmation dialog; destructive Admin deletes and compact CRUD forms also use dialogs where appropriate. There is no shipped void-folio confirmation UI. Print previews are replaced by PDF downloads. Room picker during check-in is inline in FO-04, not a separate modal.

---

## 5. Key User Flows

Six core business flows the app supports end-to-end:

**Flow 1 — Reservation to Check-in**
`FO-01 Kalender` → click empty cell → `FO-03 Unified Reservation Form` with room/type/date context prefilled → optionally add up to 20 room rows → submit atomically → per-room reservation/nightly schedule → `FO-04 Check-in` (assign room + inline GRC + required digital signature) → folio created → `FO-03 Folio tab` / `FO-05 Guest Folio`.

**Flow 2 — Charge F&B to Room**
`FB-01 Table Picker` → `FB-01A New Order` → `FB-02 Captain Order` → `FB-03 Bill Detail` → Pay → `FB-04 Payment`, choose "Charge to Room" → enter room number → line item posted to `FO-05 Guest Folio`.

**Flow 3 — Check-out**
`FO-01 Kalender` (or `FO-03 Folio tab` / `FO-05 Guest Folio`) → Check-out → `FO-06 Check-out` → rounded whole-IDR balance verification → positive balance requires payment; zero or credit proceeds → for credit, show warning and return excess to guest → PDF receipt → room status auto-set to VD → visible in `HK-01`.

**Flow 4 — Group Booking Operations**
`FO-03 Unified Reservation Form` → add 2–20 room rows → submit → linked per-room reservations → `FO-02 Reservation List` group badge or sibling context in detail → `FO-07 Group Booking Summary` → bulk per-room deposit collection → batch eligible check-in / per-folio settlement / eligible checkout.

**Flow 5 — Night Audit**
`AC-01 Dashboard` → Night Audit button → `AC-02 Night Audit` → run → `AC-03 Night Report` → PDF export.

**Flow 6 — HK Cleaning + Inspection**
`HK-01 My Rooms` → tap room → `HK-02 Shared Room Detail` → start timer → finish cleaning → `VD → VCU` or `OD → OC` → supervisor opens `HK-04 Supervisor Dashboard` / `HK-03 Supervisor Rooms` → inspect `VCU → VC` or reject `VCU → VD` → syncs to `FO-01 Kalender`.

---

## 6. Shared UI Components

Build these seven before opening Stitch / Claude Design:

| Component | Used in | Notes |
|---|---|---|
| DataTable | FO-02, FB-01 history tab, AD-01..07 | Sort, filter, paginate (paginate disabled for MVP since data volumes are small) |
| FormShell | all forms | shadcn `Form` + `zod` |
| StatusBadge | Kalender, HK dashboard, reservation status | Locked room palette (see docs/design.md): VC green `#22C55E`, OC blue `#3B82F6`, VD amber `#F59E0B`, OD orange `#F97316`, VCU purple `#8B5CF6`, OOO red `#EF4444`, OOS gray `#64748B`. Reservation palette: confirmed amber `#F59E0B`, checked-in green `#22C55E`, checked-out gray `#64748B`; Kalender's unallocated lane is blue `#3B82F6`. |
| Dialog | cancellation, destructive Admin actions, compact CRUD forms | shadcn `Dialog` / `AlertDialog`, reused |
| PDFButton | bills, reports | Wrapper around a print-to-PDF route |
| NavShell | every authenticated page | Sidebar desktop + one bottom tab bar for all roles on mobile and coarse-pointer tablets |
| EmptyState | tables with no data | Plain text "Belum ada data." + CTA button |

---

## 7. Historical 8-Week Solo Development Timeline

This table records the original delivery plan; the screen inventory above describes the shipped current state.

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Setup: Next.js + Prisma + NextAuth + Tailwind + shadcn. Seed. Deploy to Vercel. | Login works, DB migrated, deployed |
| 2 | Admin module (now 7 shipped screens). Warm-up CRUD. | Master data manageable |
| 3 | FO: Kalender + Reservation List + Reservation Form | Can create reservations, grid renders |
| 4 | FO: Check-in + Folio creation + Folio Detail (charges + payments) | Full FO spine working |
| 5 | FO: Check-out + PDF bill. HK module (5 role-aware screens). | Guest lifecycle complete, HK syncs to Kalender |
| 6 | F&B: Table Picker + New Order + Captain Order + Bill Detail + Payment (cash + card + transfer + CTR) | F&B feeds folio |
| 7 | Accounting: Night Audit trigger + Night Report + PDF export | Day close works end-to-end |
| 8 | **Buffer: bug fixes, seed data for demo, integration testing, docs update** | Presentable, stable, defended |

Week 8 is sacred buffer. Do not add features during Week 8. Integration bugs always surface when all four modules run simultaneously against the same database.
