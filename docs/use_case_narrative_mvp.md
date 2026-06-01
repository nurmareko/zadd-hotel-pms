# Use Case Narrative (MVP)

Describes the interactions between actors and the system features listed in the [Feature List](./feature_list_mvp.md). The use case diagram lives in `use_case_diagram_mvp.svg` alongside this file.

## Actors

Five actors interact with the system:

- **Front Office staff**, **Housekeeping staff**, **F&B staff**, and **Accounting staff (Night Auditor)** — each a role played by a praktikum student.
- **Administrator** — the supervising lecturer, responsible for master data and user accounts.

## Use cases by module

The system has 22 primary use cases and 4 supporting use cases, grouped into five modules:

- **Front Office** — guest lifecycle: reservation management, confirmed-reservation cancellation, check-in with required digital signature capture, mid-stay cleaning requests, guest folio management, and check-out. Reservation creation can start from an empty Kalender cell with room/type/date context prefilled; physical-room allocation remains optional until check-in. Folio operations are reached from the reservation detail's `Folio` tab.
- **Housekeeping** — mobile-first room status monitoring, timed cleaning, and VCU inspection. Vacant cleaning follows `VD → VCU → VC/VD`; occupied-room cleaning follows `OD → OC`.
- **Food & Beverage** — captain orders, floor actions for reserved/out-of-service tables, bill processing, and payment via cash, card, transfer, or charge-to-room.
- **Accounting** — night audit execution and consolidated night report generation from NightAudit snapshot fields.
- **Admin** — master data, restaurant table management and floor-layout arrangement (`/app/admin/tables`), and user/role management.

## Actor → Use Case mapping

| Actor | Use Cases |
|---|---|
| Front Office staff | Manage Reservations; Cancel Confirmed Reservation; Process Check-in; Request Mid-stay Cleaning; Manage Guest Folio; Process Check-out |
| Housekeeping staff | View Room Status; Update Room Status; Run Cleaning Timer; Inspect VCU Room |
| F&B staff | Create Captain Order; Seat Reserved Party; Release Table Reservation; Restore OOS Table; Process F&B Bill; Process F&B Payment |
| Accounting staff | Run Night Audit; Generate Night Report |
| Administrator | Manage Master Data; Manage Restaurant Tables (`/app/admin/tables`); Arrange Table Floor Layout; Manage Users & Roles |

## Use case relationships

Four relationships belong in the diagram:

- **Book from Kalender «extend» Manage Reservations** — clicking an empty Kalender cell opens reservation creation with room/type/date context prefilled; a reservation can remain unallocated.
- **Process Check-in «include» Capture Digital Signature** — the guest signs the GRC on screen; `signatureDataUrl` and `signedAt` are saved as part of check-in and the signature is embedded in the GRC PDF.
- **Process Check-out «include» Verify Zero-Balance** — folio balance verification always runs as a mandatory part of check-out.
- **Charge to Room «extend» Process F&B Payment** — posting an F&B bill to a guest folio is optional behavior, invoked only when the payment method is charge-to-room.

> **Follow-up required:** `use_case_diagram_mvp.svg` still needs regeneration to reflect the added use cases and relationships. Update it from the diagram source rather than fabricating SVG edits by hand.
