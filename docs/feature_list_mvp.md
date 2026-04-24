# Feature List (MVP)

What we're building in the MVP, grouped by module. Features deferred to later releases are listed at the end with rationale.

---

## Front Office

Supports the guest lifecycle from booking to final payment.

- **Reservation management** — create, edit, and cancel reservations with guest data, stay dates, room type, and rate.
- **Tape Chart** — occupancy visualization as a room × date grid with color-coded status. Main workspace for front desk staff.
- **Check-in** — assign a physical room to an arriving guest, fill the Guest Registration Card inline, auto-open the folio.
- **Guest Folio** — line-item charges, manual charge posting by staff, and payment recording (cash, transfer, card) against the folio.
- **Check-out** — zero-balance verification, final payment processing, and auto-update of room status to Vacant Dirty.
- **Bill printing** — guest bill is downloadable as PDF for archiving or physical printing.

## Housekeeping

Mobile-first for staff moving through room corridors.

- **Room status dashboard** — overview of all rooms with color-coded status (Vacant Clean, Vacant Dirty, Occupied Clean, Occupied Dirty, Out of Order) and quick filter by floor.
- **Room detail** — current status, active guest (if any), and recent update history.
- **Status update** — single-tap action to change room status, with optional note. Syncs in real time to the Front Office Tape Chart.

## Food & Beverage

Point-of-sale operations for the hotel restaurant.

- **Table picker** — grid of tables with current status. Entry point for creating orders.
- **Captain Order** — quick entry form for the waiter: menu selection, quantity, kitchen notes.
- **Bill processing** — automatic calculation of subtotal, service charge, and tax based on hotel settings.
- **Payment** — supports cash and charge-to-room (posting the F&B total to the guest's folio), including target guest selection by room number.
- **Receipt printing** — F&B receipt is downloadable as PDF.

## Accounting

Daily close and reporting.

- **Accounting dashboard** — today's night audit status and unprocessed-posting indicator.
- **Night Audit** — prerequisite checklist, daily-close execution, business-date advancement.
- **Night Report** — consolidated report summarizing revenue, occupancy, and guest list in one document. Exportable as PDF.

## Admin

Managed by the supervising lecturer. Master data only.

- **User management** — create, edit, and deactivate user accounts; assign role.
- **Rooms & room types** — define room types (name, capacity, base rate) and register individual rooms.
- **Articles (charge codes)** — list of charge codes used for folio line-item posting.
- **F&B menu** — CRUD menu items and categories.
- **Hotel settings** — hotel name, tax %, service charge %, night-audit cutoff time.

---

## Deferred Features

Identified during requirements gathering but deferred to later releases. The current scope prioritizes shipping the core operational flow — reservation → check-in → stay → charge → check-out → daily close — at production quality over a larger surface of partial features.

| Feature | Module | Why deferred |
|---|---|---|
| Master Bill (group billing) | Front Office | Used for corporate group bookings; not essential for basic praktikum. |
| Multi-outlet F&B | F&B | One outlet (hotel restaurant) is enough for the early praktikum. |
| Dynamic rate plans with date validity and segment | Front Office | MVP uses a fixed rate per room type. |
| Multi-role per account | Auth | Each praktikum account is limited to one role to simplify access control. |
| Separate Revenue Distribution Report | Accounting | Covered by the consolidated Night Report. |
| Guest Segment Statistics | Accounting | Requires a Segment entity not yet needed. |
| Separate Guest List Report | Accounting | Covered by the consolidated Night Report. |
| Manual Bill as a separate document | Accounting | In the MVP, walk-in charges are recorded as folio line items. |
| Print by Article | Accounting | Depends on Manual Bill. |
| Housekeeping Activity Log (UI) | Housekeeping | Log data still stored for audit; no lookup interface in the MVP. |
| Cross-stay guest database | Front Office | Guest data is kept per reservation in the MVP. |
| Cross-module admin monitoring dashboard | Admin | Admins can access each module manually through a combined-role account. |