# ZADD Hotel Management — MVP Screen Inventory

Reference document for interface design and Google Stitch / Claude Design prototyping. Revised for MVP scope: 29 screens total across 4 operational modules + admin + shared.

**What counts as a "screen":** a logical screen/workspace, not a route. One screen may span several routes or modes — e.g. FO Reservation Form / Detail (FO-04) covers reservation create, edit, and view. Pure redirect routes (`/app/hk` role landing, `/app/hk/list` → Supervisor Rooms, `/app/acc/night-report` → latest report) and role-redirect targets are infrastructure, not separate screens, so they are not counted. The total stays at 29 under this rule.

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
│  Login → module-specific dashboard (role-based)        │
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

### 3.1 Front Office (7 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| FO-01 | FO Dashboard | Page | Today: arrivals, departures, in-house count, occupancy % |
| FO-02 | **Kalender (Tape Chart)** | Page | Default FO landing: room-type-grouped room × date grid with unified status colors, unallocated-reservation lanes, checkout marker, click-empty-cell booking, and in-house guest selection. |
| FO-03 | Reservation List | Page | Date-grouped reservations with date/status filters; the whole row opens the reservation detail. |
| FO-04 | Reservation Form / Detail | Page | Create / edit / view reservation. Detail view uses `Details` and `Folio` tabs; the Folio tab embeds the guest folio after check-in. |
| FO-05 | Check-in | Page | Assign room, fill GRC inline, capture the required on-screen digital signature, set deposit, create folio |
| FO-06 | Guest Folio | Page | Line items, add manual charge, record payment, view balance |
| FO-07 | Check-out | Page | Zero-balance check, final payment, PDF bill download |

**Cut from original**: separate Reservation Detail (merged into FO-04), In-House Guest List (use Kalender), Master Bill, Guest Database.

### 3.2 Housekeeping (5 screens, role-aware)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| HK-01 | My Rooms / Kamar Saya | Mobile-first | `/app/hk/clean`: housekeeper worklist grouped by room need, with reservation context and links to room detail. |
| HK-02 | Shared Room Detail | Mobile-first | `/app/hk/rooms/[id]`: role-aware detail. Housekeepers start/finish cleaning, add status notes, log found items, and see the live timer. Supervisors inspect VCU rooms, view history, and review status context. |
| HK-03 | Supervisor Rooms | Page | `/app/hk/rooms`: merged status overview and daily worksheet with current room status, inline supervisor status override, reservation context, housekeeper, note, date navigation, and Daily List print. |
| HK-04 | Supervisor Dashboard | Page | `/app/hk/supervisor`: workload forecast, bulk assignment, VCU awaiting-inspection inbox, and live-status KPIs. |
| HK-05 | Lost & Found | Page | `/app/hk/lost-found`: text-only item logging by HK, search by FO/HK, and returned-item resolution. |

`/app/hk` is a role-based redirect, not a screen: HK members land on HK-01, and HK supervisors land on HK-04. `/app/hk/list` is retired and redirects to HK-03.

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
| AC-01 | Accounting Dashboard | Page | Today's NA status, revenue summary, un-flushed postings count |
| AC-02 | Night Audit | Page | Pre-check list → "Run Night Audit" button → progress → result |
| AC-03 | Night Report | Page | Consolidated report: revenue breakdown, occupancy, guest list, transactions. Export PDF. |

AC-03's canonical route is `/app/acc/reports/[auditId]`. `/app/acc/night-report` is the nav/empty-state entry point for AC-03: it redirects to the latest audit's report when one exists (or to `/app/acc/reports/[auditId]` when an `auditId` is passed), and renders the "no audit yet" empty state otherwise. It is a redirect/empty-state surface of AC-03, not a separate screen, so it is not counted in the 29.

**Cut from original**: Report Center, Revenue Distribution Report, Guest Segment Statistics, Guest List Report (all consolidated into AC-03), Manual Bill + List (use Folio line items), standalone Folio Payment page (handled in FO-06).

### 3.5 Admin (6 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| AD-01 | User Management | Page | CRUD users, assign role (single role per user in MVP) |
| AD-02 | Rooms & Room Types | Page | Combined: CRUD room types (with base rate inline) and rooms |
| AD-03 | Articles | Page | CRUD charge codes |
| AD-04 | F&B Menu | Page | CRUD menu items (single outlet) |
| AD-05 | F&B Tables | Page | `/app/admin/tables`: CRUD restaurant table master data + Layout tab for drag-to-arrange floor positions per location |
| AD-06 | Hotel Settings | Page | Hotel info, tax %, service charge %, night-audit cutoff time |

**Cut from original**: Admin Dashboard (admins land directly on User Management), Role Management (5 roles hardcoded in seed), Rate Plans (rate inlined into RoomType), Outlets (single outlet hardcoded), Guest Segments.

**AD-05 Layout tab:** spatial editor for restaurant table positions by Indoor/Outdoor/Private location, with drag-to-arrange tiles and auto-arrange.

---

## 4. Screen Count Summary

| Module | Pages | Cut from original |
|---|---:|---:|
| Global | 3 | 1 (Module Switcher) |
| Front Office | 7 | 4 |
| Housekeeping | 5 | 1 |
| Food & Beverage | 5 | 3 |
| Accounting | 3 | 7 |
| Admin | 6 | 4 |
| **Total** | **29** | **20 cut** |

Modal dialogs stay focused: cancellation uses a confirmation dialog; destructive Admin deletes and compact CRUD forms also use dialogs where appropriate. There is no shipped void-folio confirmation UI. Print previews are replaced by PDF downloads. Room picker during check-in is inline in FO-05, not a separate modal.

---

## 5. Key User Flows

Five core business flows the app must support end-to-end:

**Flow 1 — Reservation to Check-in**
`FO-02 Kalender` → click empty cell → `FO-04 Reservation Form` with room/type/date context prefilled → submit → `FO-05 Check-in` (assign room + inline GRC + required digital signature) → folio created → `FO-04 Folio tab` / `FO-06 Guest Folio`.

**Flow 2 — Charge F&B to Room**
`FB-01 Table Picker` → `FB-01A New Order` → `FB-02 Captain Order` → `FB-03 Bill Detail` → Pay → `FB-04 Payment`, choose "Charge to Room" → enter room number → line item posted to `FO-06 Guest Folio`.

**Flow 3 — Check-out**
`FO-02 Kalender` (or `FO-04 Folio tab` / `FO-06 Guest Folio`) → Check-out → `FO-07 Check-out` → zero-balance verification → payment if needed → PDF receipt → room status auto-set to VD → visible in `HK-01`.

**Flow 4 — Night Audit**
`AC-01 Dashboard` → Night Audit button → `AC-02 Night Audit` → run → `AC-03 Night Report` → PDF export.

**Flow 5 — HK Cleaning + Inspection**
`HK-01 My Rooms` → tap room → `HK-02 Shared Room Detail` → start timer → finish cleaning → `VD → VCU` or `OD → OC` → supervisor opens `HK-04 Supervisor Dashboard` / `HK-03 Supervisor Rooms` → inspect `VCU → VC` or reject `VCU → VD` → syncs to `FO-02 Kalender`.

---

## 6. Shared UI Components

Build these seven before opening Stitch / Claude Design:

| Component | Used in | Notes |
|---|---|---|
| DataTable | FO-03, FB-01 history tab, AD-01..05 | Sort, filter, paginate (paginate disabled for MVP since data volumes are small) |
| FormShell | all forms | shadcn `Form` + `zod` |
| StatusBadge | Kalender, HK dashboard, reservation status | Locked room palette (see docs/design.md): VC green `#22C55E`, OC blue `#3B82F6`, VD amber `#F59E0B`, OD orange `#F97316`, VCU purple `#8B5CF6`, OOO red `#EF4444`, OOS gray `#64748B`. Reservation palette: confirmed amber `#F59E0B`, checked-in green `#22C55E`, checked-out gray `#64748B`; Kalender's unallocated lane is blue `#3B82F6`. |
| Dialog | cancellation, destructive Admin actions, compact CRUD forms | shadcn `Dialog` / `AlertDialog`, reused |
| PDFButton | bills, reports | Wrapper around a print-to-PDF route |
| NavShell | every authenticated page | Sidebar desktop + one bottom tab bar for all roles on mobile and coarse-pointer tablets |
| EmptyState | tables with no data | Plain text "Belum ada data." + CTA button |

---

## 7. 8-Week Solo Development Timeline

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Setup: Next.js + Prisma + NextAuth + Tailwind + shadcn. Seed. Deploy to Vercel. | Login works, DB migrated, deployed |
| 2 | Admin module (6 screens). Warm-up CRUD. | Master data manageable |
| 3 | FO: Kalender + Reservation List + Reservation Form | Can create reservations, grid renders |
| 4 | FO: Check-in + Folio creation + Folio Detail (charges + payments) | Full FO spine working |
| 5 | FO: Check-out + PDF bill. HK module (5 role-aware screens). | Guest lifecycle complete, HK syncs to Kalender |
| 6 | F&B: Table Picker + New Order + Captain Order + Bill Detail + Payment (cash + card + transfer + CTR) | F&B feeds folio |
| 7 | Accounting: Night Audit trigger + Night Report + PDF export | Day close works end-to-end |
| 8 | **Buffer: bug fixes, seed data for demo, integration testing, docs update** | Presentable, stable, defended |

Week 8 is sacred buffer. Do not add features during Week 8. Integration bugs always surface when all four modules run simultaneously against the same database.
