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
- **Check-in** — every reservation has a required, non-client-editable deposit equal to the server-resolved first-night `ReservationNight.rateAmount`. On or after arrival, FO collects it before check-in through the canonical serializable writer, which creates or reuses the reservation's folio, records exactly one `DEPOSIT`-purpose payment, and atomically transitions the deposit from `PENDING` to `COLLECTED`; retries are idempotent. `PENDING` blocks check-in with no override. Check-in requires a `CONFIRMED` reservation, `COLLECTED` deposit, existing folio, and matching `DEPOSIT` payment before assigning or confirming the physical room, completing and signing the GRC, and compare-and-set transitioning the reservation to `CHECKED_IN`.
- **Guest Folio** — line-item charges, manual charge posting by staff, payment recording (cash, transfer, card), and post-check-in GRC printing.
- **Inklusi dan fleksibilitas menginap** — meal plans use per-night snapshots, while optional early check-in and late check-out fees are flat Rp 100.000 per reservation. Booking-time selections remain PENDING until check-in; in-house selections post immediately to an OPEN folio. POSTED fees are immutable and PENDING removals retain CANCELLED history. Group summaries expose each room's pax, plan, meal total, fee/folio/reservation states, and eligibility; FO can preview and explicitly apply meal plans or stay-flexibility fees to all siblings or a selected subset. Every sibling still uses its own pax, snapshots, fee rows, folio, and canonical per-room transaction.
- **Unified reservation form/detail** — FO-03 uses the same form structure for create, read-only detail, and edit. The canonical detail route has Details and Folio tabs; group reservations also show sibling-room context and a link to the group summary.
- **Check-out** — posts any pending stay-charge shortfall the night audit has not posted yet and verifies the rounded whole-IDR folio balance (room, F&B charge-to-room, and misc). A positive balance blocks for settlement through the existing payment flow; zero or credit may proceed. Credit displays a warning requiring the excess to be returned to the guest. Completion auto-updates room status to Vacant Dirty.
- **Room cleaning request** — Front Office can mark an in-house room as `Occupied Dirty` (`OC → OD`) for mid-stay cleaning.
- **Bill printing** — guest bill is downloadable as PDF for archiving or physical printing.
- **Tipe Reservasi** — categorization for reporting: Individual, Company, Government, OTA, Walk-in.
- **Tipe Arrangement** — rate package stored on Reservation: Room Only, Room + Breakfast, Full Board Meeting. Night Audit auto-posts arrangement-driven daily room charges to guest folios.
- **Komentar Reservasi** — free-text notes field on reservations.
- **Cetak Guest Registration Card** — downloadable PDF GRC from reservation detail/pre-check-in, check-in, and folio/post-check-in.
- **Group booking operations** — `/app/fo/reservasi/grup/[groupBookingId]` rolls up linked rooms, statuses, Inklusi state, deposit state, and per-room folio balances. Bulk deposit collection invokes the canonical serializable writer independently for each eligible sibling. Batch check-in never collects a deposit: it skips `PENDING` siblings and processes only eligible `COLLECTED` siblings through the same check-in prerequisites and transition as individual check-in. FO can also bulk-apply previewed meal plans and stay-flexibility fees to all or selected siblings, settle each positive OPEN folio through the canonical payment flow, and check out eligible settled rooms. Partial outcomes are reported per room. Aggregate amounts are display-only: every room retains its own pax, reservation, folio, signature, settlement, and check-in/check-out lifecycle; there is no shared/master folio.
- **Kinerja Petugas** — `/app/fo/staff-performance` compares active FO staff using `ActivityLog` counts for reservations created, check-ins, check-outs, payments, and manual folio charges over preset or custom WIB date ranges. Rows open per-user summary metrics and paginated activity history. This is an operational activity report, not payroll, quality scoring, or revenue attribution.

## Housekeeping

Unified HK operations implemented in #240 Phase 1 are retained. #241 Phase 2 extends the Room Board with prioritized tasks, filtering/sorting, inline assignment, task notes, and CSV export.

- **Shared access and navigation** — all HK users and ADMIN can use the Room Board, assignment, inspection, status override, Daily List print, and room history. `User.isSupervisor` remains an HK attribute, not an access gate for these operations. Unified HK navigation is Room Board, Laundry, and Lost & Found; Lost & Found retains its separate HK/FO access rules.
- **HK landing and compatibility routes** — `/app/hk` redirects to `/app/hk/rooms`. `/app/hk/supervisor` is a query-preserving HTTP 308 redirect to `/app/hk/rooms`, not a separate dashboard. `/app/hk/list` remains a compatibility redirect; new links use `/app/hk/rooms`.
- **My Rooms / phone workspace** — #244 Phase 3 makes `/app/hk/mobile` a dedicated phone-first page for HK and ADMIN. `/app/hk/clean` is now a legacy permanent HTTP 308 redirect to `/app/hk/mobile`, reversing the former redirect direction. See the Phase 3 contract below; shared room detail remains available.
- **Shared room detail** — `/app/hk/rooms/[id]` provides cleaning context, status/history, and inspection. Only the assigned HK operator can start/finish cleaning and use its timer; HK supervisors are also eligible for assignment. Shared operational access does not bypass the assigned-operator cleaning restriction.
- **Room Board** — `/app/hk/rooms` combines the status board, VCU inspection inbox, and worksheet/bulk-assignment tabs, with current status, reservation context, assigned housekeeper, note, date navigation, inline status override, and Daily List print.
- **Manual assignment** — all HK users and ADMIN can assign rooms by date, including bulk assignment by floor/workload; active HK users, including supervisors, are eligible assignees. Phase 2 adds inline assignment for the selected operating date. New Phase 2 assignment actions cannot displace an active-cleaning assignee; assigning the same assignee is a no-op. Auto-dispatch remains deferred.
- **Laundry placeholder** — the Laundry navigation destination is a placeholder for #242, not an implemented laundry workflow.
- **Cleaning timer** — `CleaningSession` is the single workflow source for assignment-to-clean-to-inspect timing. Active cleaning is derived from a started-but-unfinished session.
- **VCU inspection workflow** — vacant cleaning follows `VD → VCU → VC` on pass or `VCU → VD` on rejection; occupied-room cleaning follows `OD → OC`.
- **Status override** — all HK users and ADMIN can manually change a room's current status from the Room Board; each override creates a status audit.
- **Reservation notes for HK** — `Reservation.notes` is the one reservation comment field. FO edits it; HK reads it as guest instruction/context. Phase 2 task notes are separate immutable housekeeping logs and never append to this field.
- **Lost & Found** — `/app/hk/lost-found` lets both FO and HK search/filter, log text-only items with optional room context, and mark items returned with a resolution note.
- **FO sync** — HK actions revalidate HK screens and Front Office room/tape-chart views.

### #241 Phase 2 — Prioritized Room Board

- **Automatic priority per selected operating date** — apply P1–P5 in order, with the first matching rule winning. “Today” in the board rules refers to the selected operating date:
  1. **P1:** urgent `CONFIRMED` arrival on that date with an active early check-in fee, ETA before 14:00, or a VIP note, and room status not `VC`.
  2. **P2:** departure plus arrival on that date, and room status not `VC`.
  3. **P3:** departure on that date with reservation status `CHECKED_IN` or `CHECKED_OUT`, and room status not `VC`.
  4. **P4:** `OD` room with a staying guest on that date.
  5. **P5:** fallback for all other rooms.
- **Task codes and ordering** — board rows use `TSK-{roomNumber}`. Urgency sorting is global, with natural room-number ordering rather than lexical sorting. URL-backed `sortBy` supports `priority`, `room`, `floor`, `status`, and `assignee`; `sortOrder` supports `asc` and `desc`.
- **Search and filters** — multi-field `q` search combines with `status` and `priority` filters, persisted in the URL alongside sorting and the selected operating date.
- **Task dialog** — automatic priority is read-only. Each submission creates an immutable log for **actual today in WIB**, not the selected board date, with `oldStatus = newStatus` and a `[TUGAS: category]` note. Optional assignment is also for actual today and is available to HK/ADMIN with active HK assignees, including supervisors. The new actions cannot displace an active-cleaning assignee; same-assignee assignment is a no-op. Task creation does not change room status or append to `Reservation.notes`.
- **Task-note visibility and history** — the board shows the newest task note for the selected WIB day; all logs remain available in room history without overwriting earlier notes.
- **CSV export** — `/app/hk/rooms/export` returns identical board rows and ordering for the selected operating date, `q`, `status`, `priority`, `sortBy`, and `sortOrder`. It uses the shared safe CSV serializer with a UTF-8 BOM. Only HK and ADMIN are authorized; unauthenticated requests receive HTTP 401 and forbidden roles HTTP 403.
- **Notification schema compatibility** — use the existing `ASSIGNED` notification value, not `PENDING`; no schema changes are part of Phase 2.

**Owner review:** the HK module owner remains the reviewer/domain expert for #241, including ordered priority rules, selected-date versus actual-today behavior, active-cleaning assignment protection, task history, and board/export parity. All Phase 1 features remain in scope. This documentation-only update changes no schema and runs no checks or Git operations.

### #244 Phase 3 — Phone-first HK workspace

Phase 3 retains the Phase 1 shared operations and Phase 2 Room Board contract above, while replacing the former mobile alias with a dedicated workspace.

- **Access and route** — `/app/hk/mobile` serves HK and ADMIN directly. The legacy `/app/hk/clean` route uses Next.js `permanentRedirect` (308 semantics; streamed responses may carry a redirect meta tag); mobile no longer redirects to clean.
- **My assigned rooms today** — show the current user's assignments for actual today in WIB across all room states, prioritized P1–P5 by reusing the existing Room Board priority engine rather than duplicating its rules.
- **Unassigned pool** — include rooms unassigned for today that are `VD`, `OD`, or `VCU`, or have an arrival/departure today. Exclude `OOO` rooms and rooms with active cleaning on any date, not just today.
- **Self-claim** — claim for the current user through a serializable transaction that rechecks current room eligibility, today's assignment, and active cleaning across all dates. Never steal another user's assignment; an existing assignment to the same user is a no-op.
- **Inline cleaning and inspection** — start cleaning, display its live timer, and finish without leaving the phone workspace. Cleaning remains restricted to the assigned operator. Turnover completion requires both linen and towels. Cleaning transitions are `VD → VCU` and `OD → OC`; inspection passes `VCU → VC` or fails `VCU → VD`, with a required reason for failure.
- **Shared transaction ownership** — `src/lib/housekeeping/cleaning-operations.ts` owns complete cleaning operations, including transaction boundaries, authoritative rechecks, and related writes. Desktop and mobile route actions reuse these operations; neither imports another route's actions or splits a complete transition into separately callable steps.
- **Phone Lost & Found reporting** — the found-item dialog supports public-area reports with optional room context and selection from all rooms, without requiring assignment. HK and ADMIN can floor-report through the phone page. The existing full `/app/hk/lost-found` module remains unchanged and HK/FO-only; ADMIN's reporting access is limited to the phone flow and does not grant full-module access.
- **Phone interaction** — provide at least 48px touch targets, sticky segments, explicit empty states, refresh, and an all-room found-item dialog independent of the assigned list or pool.

**Owner review and verification:** the HK module owner must review #244, particularly pool eligibility, all-date active-cleaning exclusion, self-claim/no-steal behavior, shared transaction ownership, turnover requirements, inspection failure reasons, and ADMIN's phone-only Lost & Found boundary. No schema changes are part of Phase 3. Pure data/action tests, lint, TypeScript, and production build passed. Live checks covered HK/ADMIN access, FO denial, pointer/keyboard/touch navigation, and zero horizontal overflow at 320/375/390px for empty tasks, populated pool, and dialogs. Operational writes and database-backed concurrency remain unverified; assigned cleaning/inspection controls require an owner walkthrough with suitable demo assignments.

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
| Cross-module admin monitoring dashboard | Admin | No cross-module monitoring dashboard is shipped. ADMIN has access to HK board, assignment, inspection, status override, Daily List print, and room history under #240 Phase 1; other operational roles still require separate per-role accounts. |

### Tracked Documentation Follow-ups — Tier 3

These documentation tasks are intentionally deferred from this current-state cleanup:

- Rewrite the user guide and capture new screenshots for the unified reservation form, group operations, Pricing Rules, ARR, pinned action footers, checkout credit/refund guidance, and corrected F&B/HK states.
- Update the reservation model in `activity_diagram_mvp.md` and `business_process_mvp.md` for multi-room creation, per-night snapshots, linked posting identity, ARR, and checkout refund handling beyond the Tier 1 wording corrected now.
- Replace legacy reservation examples/routes in `dev_guide.md` and add the pricing/group/ARR file map.
- Document the pinned-footer pattern in `design.md` and narrow its Console-retention language to intentional historical references only.
- Update `use_case_narrative_mvp.md` for the expanded shipped use cases and regenerate `use_case_diagram_mvp.svg` from its source.
- Add current-state annotations to stakeholder-meeting records without rewriting their historical content.
