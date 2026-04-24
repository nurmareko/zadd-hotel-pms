# Hotel PMS — MVP Screen Inventory

Reference document for interface design and Google Stitch / Claude Design prototyping. Revised for MVP scope: 25 screens total across 4 operational modules + admin + shared.

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
│  Persistent nav: sidebar (desktop) / bottom nav (HK)   │
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
| G-01 | Login | Page | Username + password. Routes to user's module dashboard. |
| G-02 | Profile / Change Password | Page | User info, logout. |
| G-03 | 404 / Forbidden | Page | Standard error page. |

---

## 3. Module Screens

### 3.1 Front Office (7 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| FO-01 | FO Dashboard | Page | Today: arrivals, departures, in-house count, occupancy % |
| FO-02 | **Tape Chart** | Page | Room × date grid with color-coded status. Entry point for new reservations and in-house guest selection. |
| FO-03 | Reservation List | Page | Table with date/status filters |
| FO-04 | Reservation Form | Page | Create / edit / view reservation (detail view is the same form in read mode) |
| FO-05 | Check-in | Page | Assign room, fill GRC inline, set deposit, create folio |
| FO-06 | Guest Folio | Page | Line items, add manual charge, record payment, view balance |
| FO-07 | Check-out | Page | Zero-balance check, final payment, PDF bill download |

**Cut from original**: separate Reservation Detail (merged into FO-04), In-House Guest List (use Tape Chart filter), Master Bill, Guest Database.

### 3.2 Housekeeping (3 screens, mobile-first)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| HK-01 | Room Status Dashboard | Mobile | Grid/list of rooms with color-coded status. Filter by floor / status. |
| HK-02 | Room Detail | Mobile | Status, guest (if OC), notes, last-updated timestamp |
| HK-03 | Update Status | Mobile | Large status buttons + optional note. One-tap confirm. |

**Cut from original**: Activity Log UI (audit trail data still captured in `housekeeping_log` table).

### 3.3 Food & Beverage (4 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| FB-01 | Table Picker + Daily Summary | Page | Grid of tables with status + today's revenue snapshot |
| FB-02 | Captain Order | Page | Fast menu entry: pick item, quantity, notes |
| FB-03 | Order / Bill Detail | Page | Line items, subtotal, auto-computed service charge + tax, "add item" button, "Pay" button |
| FB-04 | Payment | Page | Select method: cash or charge-to-room. For CTR, pick the in-house guest by room number. |

**Cut from original**: Dashboard (merged into FB-01), Order History (tab inside FB-01), Print Bill modal (PDF button on FB-03).

### 3.4 Accounting (3 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| AC-01 | Accounting Dashboard | Page | Today's NA status, revenue summary, un-flushed postings count |
| AC-02 | Night Audit | Page | Pre-check list → "Run Night Audit" button → progress → result |
| AC-03 | Night Report | Page | Consolidated report: revenue breakdown, occupancy, guest list, transactions. Export PDF. |

**Cut from original**: Report Center, Revenue Distribution Report, Guest Segment Statistics, Guest List Report (all consolidated into AC-03), Manual Bill + List (use Folio line items), standalone Folio Payment page (handled in FO-06).

### 3.5 Admin (5 screens)

| # | Screen | Layout | Primary function |
|---|---|---|---|
| AD-01 | User Management | Page | CRUD users, assign role (single role per user in MVP) |
| AD-02 | Rooms & Room Types | Page | Combined: CRUD room types (with base rate inline) and rooms |
| AD-03 | Articles | Page | CRUD charge codes |
| AD-04 | F&B Menu | Page | CRUD menu items (single outlet) |
| AD-05 | Hotel Settings | Page | Hotel info, tax %, service charge %, night-audit cutoff time |

**Cut from original**: Admin Dashboard (admins land directly on User Management), Role Management (5 roles hardcoded in seed), Rate Plans (rate inlined into RoomType), Outlets (single outlet hardcoded), Guest Segments.

---

## 4. Screen Count Summary

| Module | Pages | Cut from original |
|---|---:|---:|
| Global | 3 | 1 (Module Switcher) |
| Front Office | 7 | 4 |
| Housekeeping | 3 | 1 |
| Food & Beverage | 4 | 3 |
| Accounting | 3 | 7 |
| Admin | 5 | 4 |
| **Total** | **25** | **20 cut** |

Modal dialogs kept minimal: only 2 confirmation modals total (destructive actions: cancel reservation, void folio). Print previews are replaced by PDF downloads. Room picker during check-in is inline in FO-05, not a separate modal.

---

## 5. Key User Flows

Five core business flows the app must support end-to-end:

**Flow 1 — Reservation to Check-in**
`FO-02 Tape Chart` → click empty cell → `FO-04 Reservation Form` → submit → `FO-05 Check-in` (assign room + GRC) → folio created → `FO-06 Guest Folio`.

**Flow 2 — Charge F&B to Room**
`FB-01 Table Picker` → `FB-02 Captain Order` → `FB-03 Bill Detail` → Pay → `FB-04 Payment`, choose "Charge to Room" → enter room number → line item posted to `FO-06 Guest Folio`.

**Flow 3 — Check-out**
`FO-02 Tape Chart` (or `FO-06 Guest Folio`) → Check-out → `FO-07 Check-out` → zero-balance verification → payment if needed → PDF bill → room status auto-set to VD → visible in `HK-01`.

**Flow 4 — Night Audit**
`AC-01 Dashboard` → Night Audit button → `AC-02 Night Audit` → run → `AC-03 Night Report` → PDF export.

**Flow 5 — HK Status Update**
`HK-01 Dashboard` → tap room → `HK-02 Detail` → Update → `HK-03 Update Status` → pick status → confirm → syncs to `FO-02 Tape Chart`.

---

## 6. Shared UI Components

Build these seven before opening Stitch / Claude Design:

| Component | Used in | Notes |
|---|---|---|
| DataTable | FO-03, FB-01 history tab, AD-01..04 | Sort, filter, paginate (paginate disabled for MVP since data volumes are small) |
| FormShell | all forms | shadcn `Form` + `zod` |
| StatusBadge | Tape Chart, HK dashboard, reservation status | Fixed palette: VC green, OC blue, VD yellow, OD red, OOO gray |
| Dialog | cancel/void confirmations | shadcn `Dialog`, reused |
| PDFButton | bills, reports | Wrapper around a print-to-PDF route |
| NavShell | every authenticated page | Sidebar desktop + bottom nav mobile |
| EmptyState | tables with no data | Plain text "Belum ada data." + CTA button |

---

## 7. 8-Week Solo Development Timeline

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Setup: Next.js + Prisma + NextAuth + Tailwind + shadcn. Seed. Deploy to Vercel. | Login works, DB migrated, deployed |
| 2 | Admin module (5 screens). Warm-up CRUD. | Master data manageable |
| 3 | FO: Tape Chart + Reservation List + Reservation Form | Can create reservations, grid renders |
| 4 | FO: Check-in + Folio creation + Folio Detail (charges + payments) | Full FO spine working |
| 5 | FO: Check-out + PDF bill. HK module (3 mobile screens). | Guest lifecycle complete, HK syncs to Tape Chart |
| 6 | F&B: Table Picker + Captain Order + Bill Detail + Payment (cash + CTR) | F&B feeds folio |
| 7 | Accounting: Night Audit trigger + Night Report + PDF export | Day close works end-to-end |
| 8 | **Buffer: bug fixes, seed data for demo, integration testing, docs update** | Presentable, stable, defended |

Week 8 is sacred buffer. Do not add features during Week 8. Integration bugs always surface when all four modules run simultaneously against the same database.
