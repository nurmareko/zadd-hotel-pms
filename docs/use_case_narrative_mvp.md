# Use Case Narrative (MVP)

Describes the interactions between actors and the system features listed in the [Feature List](./feature_list_mvp.md). The use case diagram lives in `use_case_diagram_mvp.svg` alongside this file.

## Actors

Five role actors interact with the system; HK also retains a supervisor attribute:

- **Front Office staff**, **Housekeeping staff**, **F&B staff**, and **Accounting staff (Night Auditor)** — each a role played by a praktikum student.
- **Housekeeping supervisor** — an HK user with `User.isSupervisor = true`, not a separate role code. Under #240 Phase 1, shared HK operations no longer require this attribute; supervisors are also assignable as cleaning operators.
- **Administrator** — the supervising lecturer, responsible for master data and user accounts, with access to the shared HK board, assignment, inspection, status override, Daily List print, and room history.

## Use cases by module

The system has 30 primary use cases and 5 supporting use cases, grouped into five modules:

- **Front Office** — guest lifecycle: reservation management, confirmed-reservation cancellation, required-deposit collection, check-in with required digital signature capture, mid-stay cleaning requests, guest folio management, and check-out. Every reservation's non-client-editable required deposit is the server-resolved first-night `ReservationNight.rateAmount`. On or after arrival, FO collects it before check-in through the canonical serializable, idempotent collection flow; a `PENDING` deposit blocks check-in with no override. Reservation creation can start from an empty Kalender cell with room/type/date context prefilled; physical-room allocation remains optional until check-in. Folio operations are reached from the reservation detail's `Folio` tab.
- **Housekeeping** — unified room operations implemented in #240 Phase 1. All HK users and ADMIN can use the Room Board, assign rooms individually or in bulk, inspect VCU rooms, override status, print the Daily List, and view room history. Only the assigned HK operator can start/finish cleaning; HK supervisors are eligible for assignment. The Room Board includes the inspection inbox and worksheet/bulk-assignment tabs. Unified navigation is Room Board, Laundry, and Lost & Found; Laundry is only a placeholder for #242, not a full workflow. FO and HK retain unchanged Lost & Found logging, search, and returned-item resolution; ADMIN access does not extend to Lost & Found. Vacant cleaning follows `VD → VCU → VC/VD`; occupied-room cleaning follows `OD → OC`. `CleaningSession` is the workflow source; `HousekeepingLog` is the room-status audit trail. `/app/hk` redirects to `/app/hk/rooms`; `/app/hk/supervisor` is a query-preserving HTTP 308 redirect there, and `/app/hk/list` remains a compatibility redirect. `/app/hk/mobile` redirects to the assigned-operator worklist at `/app/hk/clean`.
- **Food & Beverage** — captain orders, room-service order creation for in-house guests, floor actions for reserved/out-of-service tables, bill processing, and payment via cash, card, transfer, or charge-to-room.
- **Accounting** — night audit execution and consolidated night report generation from NightAudit snapshot fields.
- **Admin** — master data, restaurant table management and floor-layout arrangement (`/app/admin/tables`), and user/role management.

## Actor → Use Case mapping

| Actor | Use Cases |
|---|---|
| Front Office staff | Manage Reservations; Cancel Confirmed Reservation; Process Check-in; Request Mid-stay Cleaning; Log/Search/Return Lost & Found; Manage Guest Folio; Process Check-out |
| Housekeeping staff | View Room Board; View My Rooms; Assign Rooms; Bulk Assign Rooms; Clean Assigned Room with Timer (assigned operator only); Inspect VCU Room; Override Room Status; Print Daily List; View Room History; Log/Search/Return Lost & Found |
| Housekeeping supervisor | Same HK use cases as Housekeeping staff, including cleaning when assigned; supervisor status is not required for shared HK operations |
| F&B staff | Create Captain Order; Create Room Service Order; Seat Reserved Party; Release Table Reservation; Restore OOS Table; Process F&B Bill; Process F&B Payment |
| Accounting staff | Run Night Audit; Generate Night Report |
| Administrator | Manage Master Data; Manage Restaurant Tables (`/app/admin/tables`); Arrange Table Floor Layout; Manage Users & Roles; View Room Board; Assign Rooms; Bulk Assign Rooms; Inspect VCU Room; Override Room Status; Print Daily List; View Room History (no cleaning or Lost & Found access) |

## Use case relationships

Five relationships belong in the diagram:

- **Book from Kalender «extend» Manage Reservations** — clicking an empty Kalender cell opens reservation creation with room/type/date context prefilled; a reservation can remain unallocated.
- **Process Check-in «include» Verify Collected Deposit** — check-in requires a `CONFIRMED` reservation, `COLLECTED` deposit, existing folio, and matching `DEPOSIT`-purpose payment before the reservation is compare-and-set to `CHECKED_IN`; there is no override for `PENDING`.
- **Process Check-in «include» Capture Digital Signature** — the guest signs the GRC on screen; `signatureDataUrl` and `signedAt` are saved as part of check-in and the signature is embedded in the GRC PDF.
- **Process Check-out «include» Verify Checkout Balance** — the system computes the rounded whole-IDR folio balance whenever check-out is attempted. A positive balance blocks check-out; zero or credit may proceed. For credit, the system warns the receptionist to return the excess to the guest.
- **Charge to Room «extend» Process F&B Payment** — posting an F&B bill to a guest folio is invoked when the payment method is charge-to-room. Dine-in orders capture the room number during payment; room-service orders already carry the attached in-house folio from creation and default to that folio on the payment screen.

Room-service folio lookup is folded into **Create Room Service Order** rather than modeled as a separate supporting use case: the create action validates room → CHECKED_IN reservation → OPEN folio before the tableless order is opened.

> **Follow-up required:** `use_case_diagram_mvp.svg` still needs regeneration to reflect the added use cases and relationships. Update it from the diagram source rather than fabricating SVG edits by hand.
