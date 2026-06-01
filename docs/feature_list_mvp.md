# Feature List (MVP)

What we're building in the MVP, grouped by module. Features deferred to later releases are listed at the end with rationale.

Last updated: 2026-06-01.

---

## Front Office

Supports the guest lifecycle from booking to final payment.

- **Front Office dashboard** — KPI cards, arrivals, departures, in-house count, occupancy, and recent activity.
- **Reservation management** — create and edit reservations with guest data, stay dates, room type, optional physical-room allocation, and rate. Confirmed reservations can be cancelled (`CONFIRMED → CANCELLED`), releasing room-type inventory capacity and disappearing from the active list and Kalender.
- **Kalender (Tape Chart)** — default Front Office landing page: occupancy visualization as a room × date grid with unified status colors, room-type groups, unallocated-reservation lanes, and a checkout marker. Clicking an empty cell opens the reservation form with Kalender context prefilled.
- **Overbooking prevention** — reservation create/edit checks room-type inventory capacity (the number of registered physical rooms for that type) across the stay, including unallocated reservations.
- **Check-in** — assign a physical room to an arriving guest, fill the Guest Registration Card inline, capture the guest's required digital signature on screen, save `signatureDataUrl` and `signedAt`, embed the signature in the GRC PDF, and auto-open the folio.
- **Guest Folio** — line-item charges, manual charge posting by staff, payment recording (cash, transfer, card), and post-check-in GRC printing.
- **Reservation detail** — Details and Folio tabs keep reservation operations and folio access together.
- **Check-out** — zero-balance verification, final payment processing, and auto-update of room status to Vacant Dirty.
- **Room cleaning request** — Front Office can mark an in-house room as `Occupied Dirty` (`OC → OD`) for mid-stay cleaning.
- **Bill printing** — guest bill is downloadable as PDF for archiving or physical printing.
- **Tipe Reservasi** — categorization for reporting: Individual, Company, Government, OTA, Walk-in.
- **Tipe Arrangement** — rate package stored on Reservation: Room Only, Room + Breakfast, Full Board Meeting. Night Audit auto-posts arrangement-driven daily room charges to guest folios.
- **Komentar Reservasi** — free-text notes field on reservations.
- **Cetak Guest Registration Card** — downloadable PDF GRC from reservation detail/pre-check-in, check-in, and folio/post-check-in.

## Housekeeping

Mobile-first for staff moving through room corridors.

- **HK-01 Dashboard** — mobile-first workspace with two tabs: Pembersihan and Status Kamar.
- **Cleaning queue** — prioritized VD/OD/VCU rooms with filters and direct entry to room actions.
- **Room status dashboard** — floor-grouped overview of all rooms with color-coded status: VC, VD, OC, OD, VCU, OOO.
- **HK-02 Room Detail + Update** — current status, active cleaning state, action panel, and recent update history.
- **Cleaning timer** — Start/Stop cleaning session with live duration and stored start/completion timestamps.
- **VCU inspection workflow** — cleaned rooms move to Vacant Clean Unchecked before supervisor inspection.
- **Inspection result** — VCU passes to VC or fails back to VD; failed inspection requires a reason.
- **Operational capture** — optional linen and towel change flags plus cleaning notes on completed cleaning sessions.
- **Cleaning history** — duration, inspection result, notes, and linen/towel flags are displayed in room history.
- **FO sync** — HK actions revalidate the HK dashboard and Front Office room/tape-chart views.

## Food & Beverage

Shipped point-of-sale operations for the hotel restaurant.

- **Floor plan + order list** — `/app/fb` shows a per-location spatial floor plan with Indoor/Outdoor/Private tabs derived from `TableLocation`, positioned table tiles colored by status, active orders, daily order list, and entry point for creating orders. RESERVED and OUT_OF_SERVICE tables expose status actions from the floor (seat guests → order, release reservation, set available) and display their note.
- **Order detail / menu + cart** — `/app/fb/orders/[orderId]` supports menu selection, quantity, kitchen notes, and cart review.
- **Bill processing** — `/app/fb/orders/[orderId]/bill` calculates subtotal, service charge, and tax based on hotel settings.
- **Payment** — `/app/fb/orders/[orderId]/payment` supports cash, card, transfer, and charge-to-room (posting the F&B total to the guest's folio), including target guest selection by room number.
- **Receipt printing** — F&B receipt is downloadable as PDF.

## Accounting

In progress — screens shipped, full workflow being completed. The spec below keeps the intended daily-close workflow; advanced behaviors are planned/in-progress where noted.

- **Accounting dashboard** — `/app/acc` shows today's night audit status, running revenue snapshot, and audit history. Unprocessed-posting indicator is planned/in-progress.
- **Night Audit** — `/app/acc/night-audit` includes prerequisite checklist, daily-close execution, and arrangement-driven posting to guest folios. Business-date advancement/locking, open-F&B-order handling, audit-time cutoff enforcement, and audit lifecycle states beyond COMPLETED remain planned/in-progress.
- **Night Report** — `/app/acc/reports/[auditId]` shows the consolidated report summarizing revenue, occupancy, and guest list in one document. Exportable as PDF.

## Admin

Managed by the supervising lecturer. Master data only.

- **User management** — create, edit, and deactivate user accounts; assign role.
- **Rooms & room types** — define room types (name, capacity, base rate) and register individual rooms.
- **Articles (charge codes)** — list of charge codes used for folio line-item posting.
- **F&B menu** — CRUD menu items and categories.
- **F&B tables** — `/app/admin/tables` CRUD for restaurant table master data plus a Layout tab for drag-to-arrange positioning per location, with auto-arrange.
- **Hotel settings** — hotel name, tax %, service charge %, night-audit cutoff time.

## Authentication & Profile

Shared access features used by all role workspaces.

- **Role-based login** — credentials login routes each user to the correct FO/HK/FB/ACC/Admin workspace.
- **Console-themed login** — login screen follows the Console theme and exposes direct demo-account buttons.
- **Self-service profile** — authenticated users can view account/role metadata and change their own password.
- **Responsive navigation** — desktop sidebar and one shared mobile bottom tab bar for all roles, including coarse-pointer tablets. The only navigation badge is ACC's pending Night Audit indicator.
- **Hotel-timezone dates** — all operational "today" calculations use WIB (`Asia/Jakarta`).

---

## Deferred Features

Identified during requirements gathering but deferred to later releases. The current scope prioritizes shipping the core operational flow — reservation → check-in → stay → charge → check-out → daily close — at production quality over a larger surface of partial features.

| Feature | Module | Why deferred |
|---|---|---|
| Master Bill + Dummy Bill | Front Office / Accounting | Requires group billing and bill routing beyond the single-reservation MVP flow. |
| Add reservation in same number | Front Office | Same group-booking need as Master Bill; MVP keeps one reservation number per reservation. |
| Add room to existing reservation | Front Office | Requires multi-room reservation workflow and billing allocation. |
| Multi-outlet F&B | F&B | One outlet (hotel restaurant) is enough for the early praktikum. |
| Waiter Mobile (tablet/HP) | F&B | Separate mobile ordering surface; MVP prioritizes the desktop POS workflow. |
| Room Service + Banquet | F&B | New order types beyond the restaurant POS; requires schema and workflow expansion. |
| Dynamic rate plans with date validity and segment | Front Office | MVP uses a fixed rate per room type. |
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
| Lost & Found tracking | Housekeeping / Front Office | Requires a separate item custody and guest follow-up workflow. |
| Purchase Request for HK supplies | Housekeeping / Admin | Procurement workflow is outside the room-turnover MVP. |
| Stock/inventory tracking for extra beds and cribs | Housekeeping / Admin | Requires inventory quantities, movement history, and availability checks. |
| Maid Station grouping | Housekeeping | Operational grouping by station/floor can be added after basic HK flow is stable. |
| Visual floor plan | Housekeeping / Front Office | MVP uses lists/grids; spatial floor-map UI is a later visualization layer. |
| Adult/child discrepancy report | Housekeeping / Front Office | HK person-count capture was removed; discrepancy reporting needs a dedicated workflow. |
| Cross-stay guest database | Front Office | Guest data is kept per reservation in the MVP. |
| Cross-module admin monitoring dashboard | Admin | Admins can access each module manually through a combined-role account. |
