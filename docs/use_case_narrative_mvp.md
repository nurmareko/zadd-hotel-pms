# Use Case Narrative (MVP)

Describes the interactions between actors and the system features listed in the [Feature List](./feature_list_mvp.md). The use case diagram lives in `use_case_diagram_mvp.svg` alongside this file.

## Actors

Five role actors interact with the system. The HK supervisor tier is decommissioned; HK and ADMIN have uniform full HK operational access, subject to the same assignment and current-state workflow guards:

- **Front Office staff**, **Housekeeping staff**, **F&B staff**, and **Accounting staff (Night Auditor)** — each a role played by a praktikum student.
- **Administrator** — the supervising lecturer, responsible for master data and user accounts, with full HK operational access, including the phone workspace, cleaning when assigned, inspection, linen circulation, and Lost & Found.

## Use cases by module

The system has 30 primary use cases and 5 supporting use cases, grouped into five modules:

- **Front Office** — guest lifecycle: reservation management, confirmed-reservation cancellation, required-deposit collection, check-in with required digital signature capture, mid-stay cleaning requests, guest folio management, and check-out. Every reservation's non-client-editable required deposit is the server-resolved first-night `ReservationNight.rateAmount`. On or after arrival, FO collects it before check-in through the canonical serializable, idempotent collection flow; a `PENDING` deposit blocks check-in with no override. Reservation creation can start from an empty Kalender cell with room/type/date context prefilled; physical-room allocation remains optional until check-in. Folio operations are reached from the reservation detail's `Folio` tab.
- **Housekeeping** — unified room operations implemented in #240 Phase 1. All HK users and ADMIN can use the Room Board, assign rooms individually or in bulk, inspect VCU rooms, override status, print the Daily List, and view room history. Only the assigned operator can start/finish cleaning; there is no supervisor tier. The Room Board includes the inspection inbox and worksheet/bulk-assignment tabs. Unified navigation is Room Board, Laundry, and Lost & Found. #242 implements linen circulation at `/app/hk/laundry` for all HK users and ADMIN: view unit-based KPIs, search/filter dispatch records, dispatch linen as `SENT`, advance `SENT → WASHING`, and receive either `SENT` or `WASHING` once into terminal `CLEAN`. Receipt reconciles nonnegative integer clean/damaged quantities with `clean + damaged <= sent`, derives lost units as `sent - (clean + damaged)`, records operator/time audit data, and appends receipt notes. Serializable transactions with row locking, state rechecks, and retries protect transitions and prevent duplicate receipt. Clean received is cumulative receipt history, not available stock; no consumption workflow or full stock ledger is included. See the HK-04 contract in [Screen Inventory](./screen_inventory_mvp.md). HK, FO, and ADMIN share the full Lost & Found registry, including creation, search, claim, disposal/donation, and export under #243. Vacant cleaning follows `VD → VCU → VC/VD`; occupied-room cleaning follows `OD → OC`. `CleaningSession` is the workflow source; `HousekeepingLog` is the room-status audit trail. `/app/hk` redirects to `/app/hk/rooms`; `/app/hk/supervisor` is a permanent, query-preserving HTTP 308 compatibility shim there, and `/app/hk/list` remains a preserved compatibility redirect to the same board. Neither shim is slated for removal; new links use `/app/hk/rooms`. `/app/hk/mobile` is the HK/ADMIN phone workspace; `/app/hk/clean` permanently redirects to it (HTTP 308).
- **Food & Beverage** — captain orders, room-service order creation for in-house guests, floor actions for reserved/out-of-service tables, bill processing, and payment via cash, card, transfer, or charge-to-room.
- **Accounting** — night audit execution and consolidated night report generation from NightAudit snapshot fields.
- **Admin** — master data, restaurant table management and floor-layout arrangement (`/app/admin/tables`), and user/role management.

## Actor → Use Case mapping

| Actor | Use Cases |
|---|---|
| Front Office staff | Manage Reservations; Cancel Confirmed Reservation; Process Check-in; Request Mid-stay Cleaning; Manage Lost & Found (create, search, claim, dispose/donate, export); Manage Guest Folio; Process Check-out |
| Housekeeping staff | View Room Board; View My Rooms; Assign Rooms; Bulk Assign Rooms; Clean Assigned Room with Timer (assigned operator only); Inspect VCU Room; Override Room Status; Print Daily List; View Room History; Manage Linen Circulation (view KPIs, search/filter, dispatch, advance to washing, receive/reconcile once); Manage Lost & Found (create, search, claim, dispose/donate, export) |
| F&B staff | Create Captain Order; Create Room Service Order; Seat Reserved Party; Release Table Reservation; Restore OOS Table; Process F&B Bill; Process F&B Payment |
| Accounting staff | Run Night Audit; Generate Night Report |
| Administrator | Manage Master Data; Manage Restaurant Tables (`/app/admin/tables`); Arrange Table Floor Layout; Manage Users & Roles; all Housekeeping staff use cases, including cleaning when assigned and full Lost & Found registry access |

Preserve existing user identity links, cleaning sessions, inspection attribution, and status/activity logs when removing the tier. Historical records are evidence of earlier actions, not current access rules.

## Use case relationships

Five relationships belong in the diagram:

- **Book from Kalender «extend» Manage Reservations** — clicking an empty Kalender cell opens reservation creation with room/type/date context prefilled; a reservation can remain unallocated.
- **Process Check-in «include» Verify Collected Deposit** — check-in requires a `CONFIRMED` reservation, `COLLECTED` deposit, existing folio, and matching `DEPOSIT`-purpose payment before the reservation is compare-and-set to `CHECKED_IN`; there is no override for `PENDING`.
- **Process Check-in «include» Capture Digital Signature** — the guest signs the GRC on screen; `signatureDataUrl` and `signedAt` are saved as part of check-in and the signature is embedded in the GRC PDF.
- **Process Check-out «include» Verify Checkout Balance** — the system computes the rounded whole-IDR folio balance whenever check-out is attempted. A positive balance blocks check-out; zero or credit may proceed. For credit, the system warns the receptionist to return the excess to the guest.
- **Charge to Room «extend» Process F&B Payment** — posting an F&B bill to a guest folio is invoked when the payment method is charge-to-room. Dine-in orders capture the room number during payment; room-service orders already carry the attached in-house folio from creation and default to that folio on the payment screen.

Room-service folio lookup is folded into **Create Room Service Order** rather than modeled as a separate supporting use case: the create action validates room → CHECKED_IN reservation → OPEN folio before the tableless order is opened.

> **Follow-up required:** `use_case_diagram_mvp.svg` still needs regeneration to reflect the added use cases and relationships. Update it from the diagram source rather than fabricating SVG edits by hand.
