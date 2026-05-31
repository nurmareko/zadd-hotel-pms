# Business Processes (MVP)

End-to-end business processes that the Hotel PMS supports. Each diagram is rendered with Mermaid — view inline on GitHub or paste into [mermaid.live](https://mermaid.live).

This document complements [use_case_narrative_mvp.md](./use_case_narrative_mvp.md) (what actors do) and [feature_list_mvp.md](./feature_list_mvp.md) (what the system implements). Where the use case narrative answers *who does what*, this document answers *in what order, with what decisions, across which modules*.

---

## 1. Guest Lifecycle (Main Process)

The spine of the entire system. Every guest moves through this sequence; every other process either feeds into or branches from it.

```mermaid
flowchart LR
    A([Guest inquiry]) --> B[Create Reservation]
    B --> C{Arrival day?}
    C -->|No| D[Reservation held]
    D --> C
    C -->|Yes| E[Check-in]
    E --> F[Stay in-house]
    F --> G{Departure day?}
    G -->|No| F
    G -->|Yes| H[Check-out]
    H --> I([Guest departs])

    style A fill:#ecfdf5
    style I fill:#fef2f2
    style F fill:#eff6ff
```

The process spans days. Reservation can be created days, weeks, or months before arrival. Stay duration is the planned departure minus arrival date. Check-out happens on the departure date or earlier (early check-out).

---

## 2. Reservation Process

How a new reservation enters the system. Initiated by Front Office staff.

```mermaid
flowchart TD
    A([Guest inquiry]) --> B[Receptionist opens<br/>Reservation Form]
    B --> C[Enter guest details]
    C --> D[Select stay dates,<br/>room type, arrangement]
    D --> E{Room available<br/>for dates?}
    E -->|No| F[Suggest alternative<br/>dates / room type]
    F --> D
    E -->|Yes| G[Set rate amount,<br/>deposit, reservation type]
    G --> H[Generate reservation_no<br/>e.g. RSV-DDMM-NNNN]
    H --> I[Create Guest row]
    I --> J[Create Reservation row<br/>status: CONFIRMED]
    J --> K[Reservation appears<br/>on Tape Chart]
    K --> L([End])

    style A fill:#ecfdf5
    style E fill:#fffbeb
    style J fill:#eff6ff
    style L fill:#f1f5f9
```

**Decision point:** room availability check is the gating condition. The system prevents double-booking by checking active reservations (CONFIRMED or CHECKED_IN) overlapping the requested date range.

**Atomic transaction:** Guest + Reservation creation happens in a single Prisma transaction. If reservation_no generation conflicts (race condition), the transaction rolls back and a new number is generated.

---

## 3. Check-in Process

How a CONFIRMED reservation becomes a CHECKED_IN active stay. Creates the folio that will accumulate charges throughout the stay.

```mermaid
flowchart TD
    A([Guest arrives]) --> B[Receptionist finds<br/>reservation in system]
    B --> C[Optional: Print GRC<br/>for guest signature]
    C --> D[Confirm/update<br/>guest details]
    D --> E{Room pre-assigned<br/>during reservation?}
    E -->|Yes| F[Confirm or change<br/>assigned room]
    E -->|No| G[Pick available room<br/>of booked type]
    F --> H[Fill GRC inline:<br/>purpose of visit]
    G --> H
    H --> I[Optional:<br/>Record deposit]
    I --> J[Receptionist confirms<br/>check-in checklist]
    J --> K[Atomic transaction:<br/>flip statuses + create folio]
    K --> L[Reservation: CHECKED_IN<br/>Room: OC<br/>Folio: OPEN<br/>Payment: created if deposit]
    L --> M([Folio screen opens])

    style A fill:#ecfdf5
    style K fill:#eff6ff
    style L fill:#eff6ff
    style M fill:#f1f5f9
```

**Why atomic:** the four state changes must succeed together or roll back together. A reservation that's CHECKED_IN without a folio is data corruption; a room that's OC without a guest assigned is data corruption.

**Defensive overlap re-check:** even though availability was checked when the form opened, it re-checks inside the transaction. The window between form-open and form-submit could allow another receptionist to book the same room. The transaction's overlap check catches this.

---

## 4. Stay Process

What happens during the guest's in-house period. Charges accumulate, housekeeping cycles run, F&B orders flow into the folio.

```mermaid
flowchart TD
    A([Guest checked in]) --> B[Folio is OPEN]
    B --> C{Daily Activities}

    C --> D[Housekeeping:<br/>Clean room each day]
    C --> E[Food & Beverage:<br/>Guest orders restaurant items]
    C --> F[Front Office:<br/>Manual charges<br/>e.g. laundry, minibar]
    C --> G[Accounting:<br/>Night audit posts<br/>room charge per night]

    D --> H[Room status:<br/>OC → OD → OC]
    E --> I{Payment method?}
    I -->|Cash| J[F&B order: paid directly]
    I -->|Charge to Room| K[Line item posted<br/>to guest folio]
    F --> L[Manual line item<br/>posted to folio]
    G --> M[Room charge line item<br/>posted to folio per night]

    H --> N{Departure day?}
    K --> N
    L --> N
    M --> N
    J --> N

    N -->|No| C
    N -->|Yes| O([Begin Check-out])

    style A fill:#ecfdf5
    style B fill:#eff6ff
    style K fill:#eff6ff
    style L fill:#eff6ff
    style M fill:#eff6ff
    style O fill:#fffbeb
```

**Three sources of folio line items:** night audit (room), F&B (charge-to-room), and Front Office (manual charges). All three append rows to the same `folio_line_item` table — the folio's running balance reflects all of them together.

**Arrangement-driven auto-posting:** during night audit, the system reads each in-house reservation's `arrangementType` and posts the corresponding articles:
- RO → ROOM-CHARGE only
- RB → ROOM-CHARGE + BREAKFAST
- FBM → ROOM-CHARGE + BREAKFAST + COFFEE-BREAK + LUNCH + DINNER

The receptionist doesn't manually trigger any of this; it happens automatically each business day.

---

## 5. Check-out Process

How a CHECKED_IN stay becomes a CHECKED_OUT historical record. Includes the zero-balance verification that prevents guests from leaving with unpaid bills.

```mermaid
flowchart TD
    A([Departure day]) --> B[Receptionist opens<br/>guest folio]
    B --> C[Click Check Out]
    C --> D[System computes<br/>folio totals]
    D --> E{Balance?}

    E -->|Positive<br/>Owes money| F[Show Final Payment<br/>form]
    E -->|Zero<br/>Settled| H[Show Confirm<br/>checkbox]
    E -->|Negative<br/>Credit| H

    F --> G[Receptionist records<br/>final payment]
    G --> H

    H --> I[Receptionist ticks:<br/>guest has left, room verified]
    I --> J[Atomic transaction:<br/>close folio, complete stay]
    J --> K[Folio: CLOSED<br/>Reservation: CHECKED_OUT<br/>Room: VD]
    K --> L[Generate PDF bill]
    L --> M([Guest leaves])
    M --> N[Housekeeping notified<br/>via Tape Chart]
    N --> O([Room cleaning cycle])

    style A fill:#ecfdf5
    style E fill:#fffbeb
    style J fill:#eff6ff
    style K fill:#eff6ff
    style O fill:#ecfdf5
```

**Zero-balance gate:** the Confirm Check-Out button is disabled until the balance is zero or credit. Receptionist cannot finalize check-out with money still owed — the system enforces this constraint, not policy.

**Why credit is acceptable:** if the guest overpaid (rare but happens with deposit + low actual usage), the credit is recorded but doesn't block check-out. A small overpayment isn't worth holding the guest at the desk; the credit becomes a known accounting item resolved later.

**MVP simplification:** room charges are posted by Night Audit, not by Check-out. If a guest checks out before Night Audit has posted the room charge, the folio can show a credit balance from the deposit. The Check-out screen labels that state as a refund due and allows checkout; it does not post room charges itself.

---

## 6. Housekeeping Process

Room cleaning lifecycle. Operates independently from FO transactions but feeds room status back to the Tape Chart.

```mermaid
flowchart TD
    A([Guest checks out<br/>or stay continues]) --> B{Room status<br/>at start of day?}

    B -->|VD<br/>Vacant Dirty| C[HK staff cleans room]
    B -->|OD<br/>Occupied Dirty| C
    B -->|VC<br/>Vacant Clean| D[Room ready,<br/>no action]
    B -->|OC<br/>Occupied Clean| D
    B -->|OOO<br/>Out of Order| E[Maintenance only<br/>no cleaning cycle]

    C --> F[HK staff starts<br/>cleaning timer]
    F --> G[Cleaning in progress]
    G --> H{Occupied stay?}
    H -->|Yes| P[Room flips to OC]
    H -->|No| I[Room status:<br/>Vacant Clean Unchecked]
    I --> J[Supervisor inspects]
    J --> K{Pass<br/>inspection?}
    K -->|Yes| L[Room flips to VC]
    K -->|No| M[Returns to VD<br/>for re-cleaning]
    M --> C

    P --> Q([Room remains occupied])
    L --> N([Available for booking])
    D --> N
    E --> O([Closed for maintenance])

    style A fill:#ecfdf5
    style I fill:#fffbeb
    style L fill:#ecfdf5
    style M fill:#fef2f2
    style O fill:#f1f5f9
```

**Mobile-first:** HK staff operates from phones or tablets while walking the corridors. Every status update syncs immediately to the FO Tape Chart so receptionists see the live picture.

**Inspection step:** for vacant rooms, the VCU intermediate state separates "I cleaned this" from "I verified this is ready." Occupied rooms return from OD to OC after mid-stay cleaning because they remain assigned to the in-house guest.

**Audit trail:** every status change creates a `housekeeping_log` row capturing who, when, and the from→to transition. Useful for accountability and turnover analysis.

---

## 7. Food & Beverage Process

Point-of-sale flow for the hotel restaurant. The order can be paid directly or charged to a guest's folio.

```mermaid
flowchart TD
    A([Guest sits at table]) --> B[Waiter opens<br/>Captain Order]
    B --> C[Add menu items,<br/>quantities, kitchen notes]
    C --> D[Submit order<br/>status: OPEN]
    D --> E[Kitchen prepares]
    E --> F[Guest finishes meal]
    F --> G[Waiter generates bill]
    G --> H[System computes:<br/>subtotal + SC + tax]
    H --> I{Payment method?}

    I -->|Cash| J[Receive cash,<br/>create Payment row<br/>fb_order_id set]
    I -->|Charge to Room| K[Identify in-house guest<br/>by room number]
    K --> L{Guest in-house?}
    L -->|Yes| M[Post line item to folio<br/>fb_order_id link preserved]
    L -->|No| N[Reject: must be<br/>in-house to charge]
    N --> I

    J --> O[Order status: CLOSED]
    M --> O
    O --> P[PDF receipt generated]
    P --> Q([Guest leaves])

    style A fill:#ecfdf5
    style I fill:#fffbeb
    style M fill:#eff6ff
    style Q fill:#f1f5f9
```

**Cross-module integration:** Charge-to-Room is the most important non-FO touchpoint. F&B writes a line item directly into a guest's folio, and the folio's running balance immediately reflects it. The receptionist at check-out sees F&B charges aggregated with all other charges — no manual reconciliation needed.

**Polymorphic Payment:** the `payment` table records both folio payments and F&B-direct payments. Exactly one of `folio_id` or `fb_order_id` is set per row; this is enforced at the database level.

---

## 8. Daily Close / Night Audit Process

End-of-business-day procedure run by Accounting. Locks the day's transactions, posts room charges, and generates the consolidated report.

```mermaid
flowchart TD
    A([End of business day<br/>e.g. 23:00 cutoff]) --> B[Accountant opens<br/>Night Audit screen]
    B --> C[System checks prerequisites]
    C --> D{All ready?}
    D -->|No| E[Show blocking issues<br/>e.g. open orders]
    E --> F[Accountant resolves]
    F --> C
    D -->|Yes| G[Click Run Night Audit]

    G --> H[Begin transaction]
    H --> I[For each CHECKED_IN<br/>reservation:]
    I --> J[Read arrangementType]
    J --> K[Auto-post corresponding<br/>articles to folio]
    K --> L[Accumulate revenue<br/>by article type]
    L --> M[Compute occupancy<br/>and other metrics]
    M --> N[Create NightAudit row<br/>status: COMPLETED]
    N --> O[Business date advances]
    O --> P([Night Report ready])
    P --> Q[Accountant exports<br/>PDF report]

    style A fill:#ecfdf5
    style G fill:#fffbeb
    style H fill:#eff6ff
    style P fill:#eff6ff
    style Q fill:#f1f5f9
```

**Atomic across all in-house guests:** if night audit fails midway, the whole transaction rolls back. Half-audited days are worse than no audit at all.

**The "business date" concept:** real hotels operate on a business date that differs from the calendar date for a few hours each night. A check-in at 02:00 might still belong to yesterday's business date if night audit hasn't run yet. For MVP simplicity, we treat business date as the current calendar date — but the architecture supports the proper concept if needed later.

---

## 9. Cross-Module Integration: Charge-to-Room

Detailed view of how F&B and Front Office data converge through the folio. This is the single most important integration seam in the system.

```mermaid
flowchart LR
    subgraph FB[Food & Beverage Module]
        A[FB Order opened] --> B[Items added]
        B --> C[Bill generated]
        C --> D{Payment method?}
        D -->|Charge to Room| E[Capture room number]
    end

    subgraph FOLIO[Shared: Folio Module]
        F[Lookup in-house<br/>reservation by room] --> G[Verify folio<br/>is OPEN]
        G --> H[Insert FolioLineItem<br/>with fb_order_id]
    end

    subgraph FO[Front Office Module]
        I[Folio screen reads<br/>all line items] --> J[F&B charges<br/>visible immediately]
        J --> K[Counted toward<br/>balance due]
    end

    E --> F
    H --> I

    style FB fill:#fef2f2
    style FOLIO fill:#fffbeb
    style FO fill:#eff6ff
```

**Why this matters:** without this integration, the receptionist at check-out would need to manually reconcile every F&B receipt against the guest's stay. With it, the F&B charge appears on the folio the moment it's posted — and the running balance updates automatically.

**The link preserved:** the FolioLineItem stores `fb_order_id`, creating a trace back to the originating F&B order. If a guest disputes a charge, the receptionist can navigate from the folio line directly to the F&B order detail and resolve the question without leaving the system.

---

## Notes on diagram conventions

- **Pill shapes** `([ ])` = start/end events
- **Rectangles** `[ ]` = activities or system actions
- **Diamonds** `{ }` = decision points with branching outcomes
- **Color coding:**
  - Green `#ecfdf5` — start states, success outcomes
  - Yellow `#fffbeb` — decision points or attention-needed states
  - Blue `#eff6ff` — system actions or active in-house states
  - Red `#fef2f2` — error states or terminal failures
  - Gray `#f1f5f9` — passive / waiting / closed states

These match the project's status color palette used throughout the UI, keeping the diagrams visually consistent with the application itself.
