# Feature List (MVP)

What we're building in the MVP, grouped by module. Recently completed and deferred features are listed at the end with their current status or rationale.

Last updated: 2026-07-30.

---

## Front Office

Supports the guest lifecycle from booking to final payment.

- **Reservation management** — one unified flow creates a single-room reservation or a multi-room booking of 1–20 rooms with shared guest/contact data and stay details. Each room row has its own room type, optional physical-room allocation, adult/child occupancy, reservation number, reservation, folio, and nightly schedule; multi-room submissions are linked by a shared `groupBookingId`. Confirmed reservations can be edited or cancelled individually (`CONFIRMED → CANCELLED`), releasing room-type inventory capacity and disappearing from the active list and Kalender.
- **Dynamic per-night pricing** — room-type base rates plus non-stacking weekday/date-range rules resolve an immutable `ReservationNight` schedule. Quotes, reservation totals, detail/check-in/GRC displays, Night Audit and checkout posting all use the nightly snapshots; pricing-relevant edits requote eligible confirmed stays while non-pricing edits preserve locked prices.
- **Kalender (Tape Chart)** — default Front Office landing page: occupancy visualization as a room × date grid with unified status colors, room-type groups, unallocated-reservation lanes, and a checkout marker. Clicking an empty cell opens the reservation form with Kalender context prefilled.
- **Overbooking prevention** — reservation create/edit checks room-type inventory capacity (the number of registered physical rooms for that type) across the stay, including unallocated reservations.
- **Check-in** — assign a physical room to an arriving guest, fill the Guest Registration Card inline, capture the guest's required digital signature on screen, save `signatureDataUrl` and `signedAt`, embed the signature in the GRC PDF, and auto-open the folio.
- **Guest Folio** — line-item charges, manual charge posting by staff, payment recording (cash, transfer, card), and post-check-in GRC printing.
- **Inklusi dan fleksibilitas menginap** — meal plans use per-night snapshots, while optional early check-in and late check-out fees are flat Rp 100.000 per reservation. Booking-time selections remain PENDING until check-in; in-house selections post immediately to an OPEN folio. POSTED fees are immutable, PENDING removals retain CANCELLED history, and multi-room bulk application remains deferred.
- **Unified reservation form/detail** — FO-03 uses the same form structure for create, read-only detail, and edit. The canonical detail route has Details and Folio tabs; group reservations also show sibling-room context and a link to the group summary.
- **Check-out** — posts any pending stay-charge shortfall the night audit has not posted yet and verifies the rounded whole-IDR folio balance (room, F&B charge-to-room, and misc). A positive balance blocks for settlement through the existing payment flow; zero or credit may proceed. Credit displays a warning requiring the excess to be returned to the guest. Completion auto-updates room status to Vacant Dirty.
- **Room cleaning request** — Front Office can mark an in-house room as `Occupied Dirty` (`OC → OD`) for mid-stay cleaning.
- **Bill printing** — guest bill is downloadable as PDF for archiving or physical printing.
- **Tipe Reservasi** — categorization for reporting: Individual, Company, Government, OTA, Walk-in.
- **Tipe Arrangement** — rate package stored on Reservation: Room Only, Room + Breakfast, Full Board Meeting. Night Audit auto-posts arrangement-driven daily room charges to guest folios.
- **Komentar Reservasi** — free-text notes field on reservations.
- **Cetak Guest Registration Card** — downloadable PDF GRC from reservation detail/pre-check-in, check-in, and folio/post-check-in.
- **Group booking operations** — `/app/fo/reservasi/grup/[groupBookingId]` rolls up linked rooms, statuses, and per-room folio balances. FO can orchestrate batch check-in for eligible assigned rooms, settle each positive OPEN folio through the canonical payment flow, and check out eligible settled rooms. The aggregate balance is display-only: every room retains its own reservation, folio, signature, settlement, and check-in/check-out lifecycle; there is no shared/master folio.
- **Kinerja Petugas** — `/app/fo/staff-performance` compares active FO staff using `ActivityLog` counts for reservations created, check-ins, check-outs, payments, and manual folio charges over preset or custom WIB date ranges. Rows open per-user summary metrics and paginated activity history. This is an operational activity report, not payroll, quality scoring, or revenue attribution.

## Housekeeping

Role-aware for mobile housekeepers and supervisor control.

- **Role-based HK landing** — `/app/hk` redirects HK members to My Rooms and HK supervisors to the supervisor dashboard.
- **Supervisor tier** — `User.isSupervisor` elevates an HK user for supervisor-only routes and actions; the role code remains HK. ADMIN does not access HK operational screens.
- **My Rooms / Kamar Saya** — `/app/hk/clean` is the housekeeper worklist, grouped by assigned room need and linked to shared room detail.
- **Shared room detail** — `/app/hk/rooms/[id]` adapts by role. Housekeepers start/finish cleaning, see the live timer, add a status note, and log found items. Supervisors inspect rooms, view status/history, and review cleaning context.
- **Supervisor Rooms** — `/app/hk/rooms` merges the former status board and daily list into one worksheet: current status, reservation context, assigned housekeeper, note, date navigation, inline status override, and Daily List print. `/app/hk/list` redirects here.
- **Supervisor dashboard** — `/app/hk/supervisor` shows workload forecast, bulk assignment, VCU awaiting-inspection inbox, and live-status KPIs.
- **Manual assignment** — supervisors assign rooms by date, including bulk assignment by floor/workload; auto-dispatch remains deferred.
- **Cleaning timer** — `CleaningSession` is the single workflow source for assignment-to-clean-to-inspect timing. Active cleaning is derived from a started-but-unfinished session.
- **VCU inspection workflow** — vacant cleaning follows `VD → VCU → VC` on pass or `VCU → VD` on rejection; occupied-room cleaning follows `OD → OC`.
- **Supervisor status override** — supervisors can manually change a room's current status from the Supervisor Rooms page; each override creates a status audit.
- **Reservation notes for HK** — `Reservation.notes` is the one reservation comment field. FO edits it; HK reads it as guest instruction/context.
- **Lost & Found** — `/app/hk/lost-found` lets both FO and HK search/filter, log text-only items with optional room context, and mark items returned with a resolution note.
- **FO sync** — HK actions revalidate HK screens and Front Office room/tape-chart views.

## Food & Beverage

Shipped point-of-sale operations for the hotel restaurant and in-house room service.

- **Floor plan + order list** — `/app/fb` shows a table-only per-location spatial floor plan with Indoor/Outdoor/Private tabs derived from `TableLocation`, positioned table tiles colored by status, active orders, daily order list, and entry points for dine-in and room-service orders. RESERVED and OUT_OF_SERVICE tables expose status actions from the floor (seat guests → order, release reservation, set available) and display their note. Room-service orders do not occupy a table and appear in the order list as `Room Service · Kamar X · Guest Y`.
- **New room-service order** — `/app/fb/orders/new?service=room-service` validates a room number against a CHECKED_IN reservation with an OPEN folio, rejects rooms without an in-house guest, then creates a tableless `ROOM_SERVICE` order with `chargedFolioId` attached.
- **Order detail / menu + cart** — `/app/fb/orders/[orderId]` supports menu selection, quantity, kitchen notes, and cart review for both dine-in and room-service orders.
- **Bill processing** — `/app/fb/orders/[orderId]/bill` calculates subtotal, service charge, and tax based on hotel settings.
- **Payment** — `/app/fb/orders/[orderId]/payment` supports cash, card, transfer, and charge-to-room. Dine-in charge-to-room looks up the target guest by room number; room-service payment defaults to the attached folio. Charge-to-room posts one linked F&B folio line item.
- **Receipt printing** — F&B receipt is downloadable as PDF.

## Accounting

Shipped daily-close workflow for the current WIB hotel date.

- **Accounting dashboard** — `/app/acc` shows the current WIB business date and Night Audit state; live occupancy, occupied-room, arrival, departure, running-revenue, and latest completed-day ARR KPIs; a selectable live ARR range with cutover/integrity state; completed-audit status; Night Audit history; and daily ARR history. Non-ARR history metrics come from stored Night Audit snapshots, while ARR is recomputed from authoritative posted per-night room-charge lines.
- **Night Audit** — `/app/acc/night-audit` runs for the current WIB (`Asia/Jakarta`) business date, blocks duplicate audits through the unique `business_date` lock, posts only stay-charge shortfalls per article so missed nights are backfilled without double-posting, treats open F&B orders as warnings, and stores the completed revenue/occupancy snapshot. There is no persisted business-date advancement step.
- **Night Report** — `/app/acc/reports/[auditId]` shows the consolidated report summarizing revenue, occupancy, and guest list in one document. Exportable as PDF.
- **ARR (Average Room Rate)** — accounting reporting computes weighted ARR from integrity-checked posted `ROOM-CHARGE` lines linked to paid service-night snapshots, excludes `COMP`, fails closed on malformed identity, and reports pre-cutover periods as unavailable rather than mixing legacy and authoritative revenue.

## Admin

Managed by the supervising lecturer. Master data only.

- **User management** — create, edit, and deactivate user accounts; assign role.
- **Rooms & room types** — define room types (name, capacity, base rate) and register individual rooms.
- **Articles (charge codes)** — list of charge codes used for folio line-item posting.
- **F&B menu** — CRUD menu items and categories.
- **F&B tables** — `/app/admin/tables` CRUD for restaurant table master data plus a Layout tab for drag-to-arrange positioning per location, with auto-arrange.
- **Hotel settings** — hotel name, tax %, service charge %, night-audit cutoff time.
- **Pricing Rules** — `/app/admin/pricing-rules` provides CRUD, active/inactive toggling, and resolved-price preview for room-type adjustments. Rules select either one weekday or a half-open date range and apply a signed fixed-amount or percentage delta. Date-range precedence, non-stacking resolution, selector shape, overlap/duplicate-weekday, and non-negative-rate validation are enforced by the shipped feature.

## Authentication & Profile

Shared access features used by all role workspaces.

- **Role-based login** — credentials login routes each user to the correct FO/HK/FB/ACC/Admin workspace.
- **V2 login** — login screen uses the V2 design system: light enterprise surfaces, Plus Jakarta Sans typography, soft shadows, branded "ZADD Hotel Management", and direct demo-account buttons.
- **Self-service profile** — authenticated users can view account/role metadata and change their own password.
- **Responsive navigation** — desktop sidebar and one shared mobile bottom tab bar for all roles, including coarse-pointer tablets. The only navigation badge is ACC's pending Night Audit indicator.
- **Hotel-timezone dates** — all operational "today" calculations use WIB (`Asia/Jakarta`).

## Shared Financial Convention

- **Whole-IDR money** — monetary inputs and settlement are whole rupiah. Dynamic-pricing calculations use `Decimal`, then each final nightly rate is rounded once, half-up, to whole IDR before it is persisted in `ReservationNight` and copied unchanged into automatic room-charge postings. ARR keeps `Decimal` precision for its weighted calculation and rounds only for display.

---

## Recently Completed

| Feature | Module | Status / reference |
|---|---|---|
| Dynamic / adjustable room pricing | Front Office | **DONE.** Per-night rule resolution, immutable booking snapshots, pricing-relevant requotes, nightly totals/displays/GRC, and snapshot-linked automatic posting are delivered. See [`db_specification_mvp.md`](./db_specification_mvp.md#dynamic-pricing-per-night-model-contract). |
| ARR (Average Room Rate) | Accounting | **DONE.** Weighted paid-night ARR with linked-line integrity, COMP exclusion, and explicit cutover handling is delivered. See [`db_specification_mvp.md`](./db_specification_mvp.md#dynamic-pricing-per-night-model-contract). |
| Multi-room / group booking | Front Office | **DONE for light group operations.** One create flow supports 1–20 rooms linked by `groupBookingId`; group summary, batch eligible check-in, per-folio settlement, and eligible checkout are shipped. Master/shared billing and adding rooms after creation remain deferred. |
| Admin Pricing Rules | Admin / Front Office | **DONE.** CRUD, toggle, preview, validation, and canonical per-night rule resolution are shipped. |
| Kinerja Petugas | Front Office | **DONE.** ActivityLog-based staff comparison and per-user activity history are available to FO and ADMIN. |

---

## Deferred Features

Identified during requirements gathering but deferred to later releases. The current scope prioritizes shipping the core operational flow — reservation → check-in → stay → charge → check-out → daily close — at production quality over a larger surface of partial features.

| Feature | Module | Why deferred |
|---|---|---|
| Master Bill + Dummy Bill | Front Office / Accounting | Light group booking is shipped, but every room still owns an independent reservation and folio. Master/Dummy Bill requires a master billing entity or routing policy, consolidated-document semantics, settlement responsibility, and safe charge distribution or transfer between room folios. |
| Shared reservation number across group rooms | Front Office | Multi-room creation uses one shared `groupBookingId`, while each room intentionally retains a unique `reservationNo` and independent lifecycle. The group ID is the shipped common booking reference; same-number semantics remain deferred. |
| Add room to existing reservation/group | Front Office | Initial multi-room creation is shipped, but appending a room later is not. It requires atomic capacity and physical-room rechecks, creation of a new nightly snapshot schedule, explicit group-membership semantics, and handling for already-started check-in, folio, settlement, and cancellation states. |
| Checked-in stay extension UI | Front Office | The nightly model requires append-only future snapshots for in-house extensions without repricing posted history; the operational UI and confirmation flow remain deferred. |
| Admin correction / historical-record modification | Front Office / Accounting / Admin | Terminal reservations are locked in the standard edit flow. Legitimate corrections to completed historical or financial records belong to the same future RBAC-gated family as allowance/rebate adjustments and require manager-only permission, an explicit reason, and a durable audit log. |
| COMP operational workflow | Front Office / Accounting | `ReservationNight.revenueClass` and ARR exclusion are ready, but no user workflow currently creates or approves complimentary service nights. |
| Per-service-night room-status identity for mid-stay OOO ARR | Accounting / Housekeeping | ARR must not use current `Room.status`; historical exclusion of a charged night that was OOO requires a service-night status snapshot/model. |
| Manual folio charge/payment writer stale-status race hardening | Front Office / Accounting | Manual charge and payment writers must recheck folio status and relevant balance invariants atomically at insert time so concurrent checkout cannot accept a stale OPEN-state decision. |
| Multi-outlet F&B | F&B | One outlet (hotel restaurant) is enough for the early praktikum. |
| Waiter Mobile (tablet/HP) | F&B | Separate mobile ordering surface; MVP prioritizes the desktop POS workflow. |
| Banquet | F&B | Event/package ordering remains outside the restaurant and room-service POS workflow. |
| FO Reports: departures due today queue | Front Office | Rebuild the removed dashboard queue as a real departure-date view for checked-in reservations departing today, with folio balance and Check-out link. Current Reservation List filters `arrivalDate`, not `departureDate`, so this needs a dedicated report/query. |
| FO Reports: occupancy KPI | Front Office | Rebuild the removed dashboard KPI as `% of OC / non-OOO rooms` in a future Front Office Reports page. |
| Multi-role per account | Auth | Each praktikum account is limited to one role to simplify access control. |
| GM/Manager role hierarchy | Auth | Management hierarchy and cross-module oversight roles are outside the current role model. |
| FO ↔ HK messaging | Front Office / Housekeeping | Internal communication channel is useful but not required for the core room-status sync. |
| OTA integration | Front Office | MVP records OTA as a reservation type only; external channel/API integration is post-MVP. |
| Separate Revenue Distribution Report | Accounting | Covered by the consolidated Night Report. |
| Guest Segment Statistics | Accounting | Requires a Segment entity not yet needed. |
| Separate Guest List Report | Accounting | Covered by the consolidated Night Report. |
| Manual Bill as a separate document | Accounting | In the MVP, walk-in charges are recorded as folio line items. |
| Print by Article | Accounting | Depends on Manual Bill / Master Bill style reporting. |
| Housekeeping Activity Log UI | Housekeeping | Room-level history is shipped; a global searchable HK activity log is post-MVP. |
| Credit Points / weighted task allocation | Housekeeping | Requires task scoring rules for staff workload balancing. |
| Auto-assignment logic for cleaning staff | Housekeeping | MVP keeps assignment manual; automated dispatch needs scheduling rules. |
| Purchase Request for HK supplies | Housekeeping / Admin | Procurement workflow is outside the room-turnover MVP. |
| Stock/inventory tracking for extra beds and cribs | Housekeeping / Admin | Requires inventory quantities, movement history, and availability checks. |
| Maid Station grouping | Housekeeping | Operational grouping by station/floor can be added after basic HK flow is stable. |
| Visual floor plan | Housekeeping / Front Office | MVP uses lists/grids; spatial floor-map UI is a later visualization layer. |
| Adult/child discrepancy report | Housekeeping / Front Office | HK person-count capture was removed; discrepancy reporting needs a dedicated workflow. |
| Cross-stay guest database | Front Office | Guest data is kept per reservation in the MVP. |
| Cross-module admin monitoring dashboard | Admin | The app is single-role: ADMIN covers master data, users, and settings only and has no operational-module access. A lecturer who needs operational access uses a separate per-role account. |

### Tracked Documentation Follow-ups — Tier 3

These documentation tasks are intentionally deferred from this current-state cleanup:

- Rewrite the user guide and capture new screenshots for the unified reservation form, group operations, Pricing Rules, ARR, pinned action footers, checkout credit/refund guidance, and corrected F&B/HK states; remove the orphaned `fo-01-dashboard.png` during that rewrite.
- Update the reservation model in `activity_diagram_mvp.md` and `business_process_mvp.md` for multi-room creation, per-night snapshots, linked posting identity, ARR, and checkout refund handling beyond the Tier 1 wording corrected now.
- Replace legacy reservation examples/routes in `dev_guide.md` and add the pricing/group/ARR file map.
- Document the pinned-footer pattern in `design.md` and narrow its Console-retention language to intentional historical references only.
- Update `use_case_narrative_mvp.md` for the expanded shipped use cases and regenerate `use_case_diagram_mvp.svg` from its source.
- Add current-state annotations to stakeholder-meeting records without rewriting their historical content.
