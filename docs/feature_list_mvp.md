# Use Case Narrative (MVP)

Describes the interactions between actors and the system features listed in the [Feature List](./feature_list_mvp.md). The use case diagram lives in `use_case_diagram_mvp.svg` alongside this file.

## Actors

Five actors interact with the system:

- **Front Office staff**, **Housekeeping staff**, **F&B staff**, and **Accounting staff (Night Auditor)** — each a role played by a praktikum student.
- **Administrator** — the supervising lecturer, responsible for master data and user accounts.

## Use cases by module

The system has 13 primary use cases and 2 supporting use cases, grouped into five modules:

- **Front Office** — guest lifecycle: reservation management, check-in, guest folio management, and check-out.
- **Housekeeping** — mobile-first room status monitoring and updates.
- **Food & Beverage** — captain orders, bill processing, and payment via cash or charge-to-room.
- **Accounting** — night audit execution and consolidated night report generation.
- **Admin** — master data and user/role management.

## Actor → Use Case mapping

| Actor | Use Cases |
|---|---|
| Front Office staff | Manage Reservations; Process Check-in; Manage Guest Folio; Process Check-out |
| Housekeeping staff | View Room Status; Update Room Status |
| F&B staff | Create Captain Order; Process F&B Bill; Process F&B Payment |
| Accounting staff | Run Night Audit; Generate Night Report |
| Administrator | Manage Master Data; Manage Users & Roles |

## Use case relationships

Two relationships appear in the diagram:

- **Process Check-out «include» Verify Zero-Balance** — folio balance verification always runs as a mandatory part of check-out.
- **Charge to Room «extend» Process F&B Payment** — posting an F&B bill to a guest folio is optional behavior, invoked only when the payment method is charge-to-room.