# Activity Diagrams (MVP)

UML-style activity diagrams for the main use cases. Each diagram shows the step-by-step flow of a single operation including decision points, parallel paths, and which actor (or the system) performs each step.

This document complements [use_case_narrative_mvp.md](./use_case_narrative_mvp.md) (use case overview) and [business_process_mvp.md](./business_process_mvp.md) (cross-process workflows). Where business processes are wide and shallow, activity diagrams are narrow and deep — they describe one use case at a time with full internal logic.

Diagrams use Mermaid flowchart syntax with subgraphs representing actor lanes (an approximation of UML swim lanes). View inline on GitHub or paste into [mermaid.live](https://mermaid.live).

---

## 1. Process Reservation (Create)

**Use case:** UC-FO-01 Kelola Reservasi (Create)
**Actors:** Front Office staff (Receptionist), System
**Trigger:** Guest inquiry, walk-in, or Tape Chart empty-cell click

```mermaid
flowchart TD
    Start([Receptionist receives inquiry])

    subgraph R[Receptionist]
        R1[Open Reservation Form]
        R2[Enter guest information<br/>name, ID, phone, email]
        R3[Enter stay details<br/>dates, room type, arrangement]
        R4[Adjust rate amount if needed]
        R5[Set reservation type<br/>Individual/Company/etc.]
        R6[Submit form]
        R7[Inform guest of<br/>confirmation number]
    end

    subgraph S[System]
        S1[Validate input via Zod schema]
        S2{Validation pass?}
        S3[Check room availability<br/>for date range]
        S4{Any overlapping<br/>active reservation?}
        S5[Begin transaction]
        S6[Generate reservation_no<br/>RSV-DDMM-NNNN]
        S7[Create Guest record]
        S8[Create Reservation record<br/>status: CONFIRMED]
        S9[Commit transaction]
        S10[Revalidate Tape Chart<br/>and List views]
        S11[Show validation errors]
        S12[Show conflict error]
    end

    End([Reservation visible<br/>on Tape Chart])

    Start --> R1 --> R2 --> R3 --> R4 --> R5 --> R6 --> S1
    S1 --> S2
    S2 -->|No| S11 --> R3
    S2 -->|Yes| S3 --> S4
    S4 -->|Yes| S12 --> R3
    S4 -->|No| S5 --> S6 --> S7 --> S8 --> S9 --> S10 --> R7 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style S2 fill:#fffbeb
    style S4 fill:#fffbeb
    style S5 fill:#eff6ff
    style S9 fill:#eff6ff
    style S11 fill:#fef2f2
    style S12 fill:#fef2f2
```

**Key logic:**

- **Two validation gates:** Zod (form-level: required fields, formats) and overlap check (data-level: business rule). Both must pass before transaction begins.
- **Atomic creation:** Guest and Reservation are created in a single Prisma transaction. Reservation cannot exist without an associated Guest, so partial writes are prevented at the DB level.
- **Reservation number generation:** the `RSV-DDMM-NNNN` format uses today's date plus a sequential counter for the day. Counter is computed inside the transaction to prevent race conditions if two reservations are created simultaneously.

---

## 2. Process Check-in

**Use case:** UC-FO-02 Proses Check-in
**Actors:** Front Office staff (Receptionist), Guest, System
**Trigger:** Guest arrives at the hotel on or after the reservation's arrival date
**Precondition:** Reservation status is CONFIRMED, arrival date ≤ today

```mermaid
flowchart TD
    Start([Guest arrives])

    subgraph G[Guest]
        G1[Present identification]
        G2[Sign printed GRC]
    end

    subgraph R[Receptionist]
        R1[Look up reservation]
        R2[Print GRC for signature]
        R3[Hand GRC to guest]
        R4[Confirm/update<br/>guest details on screen]
        R5{Room pre-assigned?}
        R6[Confirm or change<br/>assigned room]
        R7[Pick available room<br/>of booked type]
        R8[Set purpose of visit]
        R9[Optionally record deposit]
        R10[Tick confirmation checkbox]
        R11[Click Complete Check-In]
    end

    subgraph S[System]
        S1[Re-verify reservation<br/>is still CONFIRMED]
        S2{Status valid?}
        S3[Re-check room overlap<br/>defensive inside transaction]
        S4{Room still available?}
        S5[Begin transaction]
        S6[Update Guest record]
        S7[Update Reservation:<br/>status CHECKED_IN,<br/>roomId set, GRC filled]
        S8[Create Folio:<br/>status OPEN, folioNo generated]
        S9[Update Room: status OC]
        S10{Deposit recorded?}
        S11[Create Payment record<br/>linked to new folio]
        S12[Commit transaction]
        S13[Redirect to folio]
        S14[Show error:<br/>not in confirmable state]
        S15[Show error:<br/>room no longer available]
    end

    End([Folio screen open])

    Start --> G1 --> R1
    R1 --> R2 --> R3 --> G2 --> R4
    R4 --> R5
    R5 -->|Yes| R6 --> R8
    R5 -->|No| R7 --> R8
    R8 --> R9 --> R10 --> R11 --> S1
    S1 --> S2
    S2 -->|No| S14
    S2 -->|Yes| S3 --> S4
    S4 -->|No| S15
    S4 -->|Yes| S5 --> S6 --> S7 --> S8 --> S9 --> S10
    S10 -->|Yes| S11 --> S12
    S10 -->|No| S12
    S12 --> S13 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style R5 fill:#fffbeb
    style S2 fill:#fffbeb
    style S4 fill:#fffbeb
    style S10 fill:#fffbeb
    style S5 fill:#eff6ff
    style S12 fill:#eff6ff
    style S14 fill:#fef2f2
    style S15 fill:#fef2f2
```

**Key logic:**

- **GRC printed before check-in completion:** the receptionist prints the GRC first so the guest can physically sign. The form is then completed in the system based on what the guest filled in by hand.
- **Defensive re-verification:** the system re-checks status and room availability inside the transaction. The window between form-open and form-submit could let another receptionist book the same room, so the final check happens during commit.
- **Conditional payment creation:** the transaction creates a Payment record only if `depositAmount > 0`. The optional deposit doesn't fork the transaction structurally — it adds one more operation inside the same atomic block.
- **Four state changes in one commit:** Guest update, Reservation update, Folio creation, Room update (and optional Payment) all succeed together or roll back together. This is the strongest data integrity guarantee in the system.

---

## 3. Process F&B Order

**Use case:** UC-FB-01 Create Captain Order, UC-FB-02 Process F&B Bill, UC-FB-03 Proses Pembayaran F&B
**Actors:** F&B staff (Waiter), System
**Trigger:** Guest sits at a restaurant table or waiter opens a new order
**Precondition:** Table is AVAILABLE or an existing OPEN order is selected

```mermaid
flowchart TD
    Start([Guest ready to order])

    subgraph W[F&B Waiter]
        W1[Open F&B floor plan<br/>/app/fb]
        W2{Use existing order?}
        W3[Select occupied table<br/>or order from list]
        W4[Open Create Order<br/>/app/fb/orders/new]
        W5[Select available table<br/>and guest count]
        W6[Open order detail<br/>/app/fb/orders/orderId]
        W7[Add menu items<br/>Captain Order]
        W8[Adjust quantities<br/>and kitchen notes]
        W9[Open Bill screen]
        W10[Confirm bill]
        W11[Open Payment screen]
        W12{Payment method?}
        W13[Enter cash tendered]
        W14[Enter card reference]
        W15[Enter transfer reference]
        W16[Enter guest room number]
        W17[Submit payment]
        W18[Download/print receipt]
        W19[Serve guest / close table]
        W20[Show error to waiter]
    end

    subgraph S[System]
        S1[Load table grid<br/>and active orders]
        S2[Validate table availability<br/>and guest count]
        S3{Table available?}
        S4[Begin transaction]
        S5[Create FBOrder<br/>status OPEN]
        S6[Update RestaurantTable<br/>status OCCUPIED]
        S7[Commit transaction]
        S8[Load menu and order cart]
        S9[Create/update FBOrderItem rows]
        S10[Recompute item amounts]
        S11[Validate order has items]
        S12{Any items?}
        S13[Begin transaction]
        S14[Compute subtotal,<br/>service charge, tax, total]
        S15[Update FBOrder:<br/>status BILLED]
        S16[Commit transaction]
        S17[Show bill PDF/download]
        S18[Validate order status BILLED]
        S19{Status BILLED?}
        S32[Begin payment transaction]
        S33{Payment method?}
        S20[Create Payment row<br/>method CASH<br/>fb_order_id set]
        S21[Create Payment row<br/>method CARD<br/>reference saved]
        S22[Create Payment row<br/>method TRANSFER<br/>reference saved]
        S23[Lookup room and<br/>CHECKED_IN reservation]
        S24{Open folio found?}
        S25[Insert FolioLineItem<br/>articleId: F&B charge<br/>fb_order_id linked]
        S26[Update FBOrder:<br/>status CLOSED<br/>payment_method set]
        S27[Update RestaurantTable<br/>status AVAILABLE]
        S28[Commit transaction]
        S29[Generate F&B receipt PDF]
        S30[Show error:<br/>table/order/payment invalid]
        S31[Show error:<br/>room not found,<br/>no in-house guest,<br/>or folio closed]
    end

    End([Order CLOSED<br/>table AVAILABLE])

    Start --> W1 --> S1 --> W2
    W2 -->|Yes| W3 --> W6
    W2 -->|No| W4 --> W5 --> S2 --> S3
    S3 -->|No| S30 --> W20
    S3 -->|Yes| S4 --> S5 --> S6 --> S7 --> W6
    W6 --> S8 --> W7 --> W8 --> S9 --> S10 --> W9 --> W10 --> S11 --> S12
    S12 -->|No| S30 --> W20
    S12 -->|Yes| S13 --> S14 --> S15 --> S16 --> S17 --> W11 --> S18 --> S19
    S19 -->|No| S30 --> W20
    S19 -->|Yes| W12
    W12 -->|Cash| W13 --> W17
    W12 -->|Card| W14 --> W17
    W12 -->|Transfer| W15 --> W17
    W12 -->|Charge to Room| W16 --> W17
    W17 --> S32 --> S33
    S33 -->|Cash| S20
    S33 -->|Card| S21
    S33 -->|Transfer| S22
    S33 -->|Charge to Room| S23 --> S24
    S24 -->|No| S31 --> W20
    S24 -->|Yes| S25
    S20 --> S26
    S21 --> S26
    S22 --> S26
    S25 --> S26
    S26 --> S27 --> S28 --> S29 --> W18 --> W19 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style W2 fill:#fffbeb
    style W12 fill:#fffbeb
    style S3 fill:#fffbeb
    style S12 fill:#fffbeb
    style S19 fill:#fffbeb
    style S24 fill:#fffbeb
    style S33 fill:#fffbeb
    style S4 fill:#eff6ff
    style S7 fill:#eff6ff
    style S13 fill:#eff6ff
    style S16 fill:#eff6ff
    style S32 fill:#eff6ff
    style S28 fill:#eff6ff
    style S30 fill:#fef2f2
    style S31 fill:#fef2f2
```

**Key logic:**

- **Route coverage:** the shipped flow moves through `/app/fb`, `/app/fb/orders/new`, `/app/fb/orders/[orderId]`, `/app/fb/orders/[orderId]/bill`, and `/app/fb/orders/[orderId]/payment`.
- **Table locking at order creation:** the system validates the selected table and creates the OPEN FBOrder in one transaction, then marks the RestaurantTable OCCUPIED. This prevents two waiters from opening competing orders on the same table.
- **Captain Order before billing:** menu items are stored as FBOrderItem rows while the order is OPEN. The bill cannot be generated until at least one item exists.
- **Bill locks totals:** confirming the bill computes subtotal, service charge, tax, and total from hotel settings, then changes the order from OPEN to BILLED. Payment is only allowed from BILLED state.
- **Four payment paths:** cash, card, and transfer create Payment rows linked to the FBOrder. Charge-to-room validates an in-house guest and OPEN folio, then creates a FolioLineItem with `fb_order_id` linked to the originating order.
- **Close and free table:** successful payment updates FBOrder to CLOSED and frees the RestaurantTable back to AVAILABLE. Receipt PDF generation happens after the transactional state change.

---

## 4. Process Check-out (with «include» Verify Zero-Balance)

**Use case:** UC-FO-04 Proses Check-out with «include» Verifikasi Zero-Balance
**Actors:** Front Office staff (Receptionist), Guest, System
**Trigger:** Guest is ready to leave, or departure date is reached
**Precondition:** Reservation status is CHECKED_IN, folio status is OPEN

```mermaid
flowchart TD
    Start([Guest ready to check out])

    subgraph R[Receptionist]
        R1[Open guest folio]
        R2[Click Check Out]
        R3[Review final bill with guest]
        R4{Balance positive?}
        R5[Collect final payment]
        R6[Record payment in system]
        R7[Tick confirmation:<br/>guest left, room verified]
        R8[Click Complete Check-Out]
        R9[Download PDF bill]
        R10[Hand bill to guest]
    end

    subgraph G[Guest]
        G1[Pay outstanding amount]
        G2[Receive bill, depart]
    end

    subgraph S[System]
        S1[Compute folio totals<br/>INCLUDE: Verify Zero-Balance]
        S2[Insert Payment record]
        S3[Recompute folio totals]
        S4{Balance now ≤ 0?}
        S5[Re-verify folio status<br/>and reservation status]
        S6{Statuses valid?}
        S7[Begin transaction]
        S8[Update Folio:<br/>status CLOSED<br/>closedAt: now]
        S9[Update Reservation:<br/>status CHECKED_OUT]
        S10[Update Room: status VD]
        S11[Commit transaction]
        S12[Render PDF bill]
        S13[Show error:<br/>balance still positive]
        S14[Show error:<br/>state changed elsewhere]
    end

    End([Reservation CHECKED_OUT<br/>Room available for HK])

    Start --> R1 --> R2 --> S1 --> R3
    R3 --> R4
    R4 -->|Yes| R5 --> G1 --> R6 --> S2 --> S3 --> S4
    S4 -->|No| R5
    S4 -->|Yes| R7
    R4 -->|No| R7
    R7 --> R8 --> S5 --> S6
    S6 -->|No| S14
    S6 -->|Yes| S7 --> S8 --> S9 --> S10 --> S11 --> S12 --> R9 --> R10 --> G2 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style R4 fill:#fffbeb
    style S4 fill:#fffbeb
    style S6 fill:#fffbeb
    style S7 fill:#eff6ff
    style S11 fill:#eff6ff
    style S13 fill:#fef2f2
    style S14 fill:#fef2f2
```

**Key logic:**

- **«include» Verify Zero-Balance:** the verification runs whenever check-out is attempted. It's not an optional step — every check-out triggers it. The diagram shows this as the first system action after Click Check Out.
- **Payment iteration loop:** if balance is positive after first payment, the system computes again and may require another payment. This handles the case where multiple payment methods are needed (e.g., partial cash + partial card).
- **Three state changes in commit:** Folio close, Reservation flip, Room flip. The PDF generation happens AFTER commit — it's a side effect, not part of the transactional state change.
- **Acceptable credit balance:** if balance is negative (overpayment), check-out proceeds without further payment. The credit is recorded as a known accounting state — it doesn't block the guest leaving.

---

## 5. Update Room Status

**Use case:** UC-HK-02 Update Status Kamar with VCU inspection workflow
**Actors:** Housekeeping staff, Housekeeping supervisor (same person in MVP, future role), System
**Trigger:** HK staff finishes cleaning a room, OR receives notification that room needs cleaning
**Note:** The VCU intermediate state described here is a forward-looking design. MVP shipping initially uses VD → VC directly; VCU inspection is added in a subsequent HK module update.

```mermaid
flowchart TD
    Start([Room needs cleaning<br/>status: VD or OD])

    subgraph HK[Housekeeping Staff]
        HK1[Open HK Dashboard<br/>on mobile]
        HK2[Tap the dirty room]
        HK3[Tap Update Status]
        HK4[Tap Start Cleaning timer]
        HK5[Clean the room]
        HK6[Tap Stop Cleaning timer]
        HK7[Tap Mark Vacant Clean Unchecked]
        HK8[Add optional note]
    end

    subgraph HS[HK Supervisor]
        HS1[See VCU rooms on dashboard]
        HS2[Walk to room and inspect]
        HS3{Inspection pass?}
        HS4[Tap Approve - VC]
        HS5[Tap Reject - back to VD]
    end

    subgraph S[System]
        S1[Record cleaning_started_at<br/>on new housekeeping_log row]
        S2[Record cleaning_completed_at<br/>on the log row]
        S3[Update Room status: VCU]
        S4[Sync Tape Chart for FO]
        S5[Update Room status: VC]
        S6[Update Room status: VD]
        S7[Append new housekeeping_log row<br/>for inspection event]
    end

    End1([Room available for booking])
    End2([Room needs re-cleaning])

    Start --> HK1 --> HK2 --> HK3 --> HK4 --> S1 --> HK5 --> HK6 --> S2 --> HK7 --> HK8 --> S3 --> S4 --> HS1
    HS1 --> HS2 --> HS3
    HS3 -->|Yes| HS4 --> S5 --> S7 --> End1
    HS3 -->|No| HS5 --> S6 --> S7 --> End2
    End2 -.->|Returns to cleaning queue| HK1

    style Start fill:#ecfdf5
    style End1 fill:#ecfdf5
    style End2 fill:#fffbeb
    style HS3 fill:#fffbeb
    style S3 fill:#eff6ff
    style S5 fill:#eff6ff
    style S6 fill:#fef2f2
```

**Key logic:**

- **Timer pair:** `cleaning_started_at` and `cleaning_completed_at` are stored on the same housekeeping_log row. Duration is derived (end - start), not stored separately. This allows for "in-progress" detection: rows with non-null start and null end mean cleaning is currently happening.
- **Single role enforcement in MVP:** the HK staff and HK supervisor are the same user role in MVP (any HK user can clean and inspect). In a future revision with proper role hierarchy, the inspect action would be gated to a supervisor sub-role.
- **Loop on rejection:** if inspection fails, the room returns to VD. The cleaning cycle repeats — same staff or different, depending on shift. The housekeeping_log row history captures every iteration for accountability.
- **Tape Chart sync:** every status change triggers Tape Chart re-render. The FO receptionist sees room status updates in near-real-time without manual refresh.

---

## 6. Run Night Audit

**Use case:** UC-AC-01 Jalankan Night Audit
**Actors:** Accounting staff (Night Auditor), System
**Trigger:** End of business day (per hotel_settings.night_audit_time, typically 23:00)
**Precondition:** All F&B orders for the day are closed, no pending operations
**Note:** This diagram represents the target workflow. Business-date advancement, cutoff enforcement, open-order blocking, and audit states beyond COMPLETED are in progress; arrangement-driven posting, snapshot capture, and duplicate-audit block are the currently-working parts.

```mermaid
flowchart TD
    Start([End of business day reached])

    subgraph A[Accountant]
        A1[Open Night Audit screen]
        A2[Review prerequisite checklist]
        A3{All checks pass?}
        A4[Resolve blocking issues<br/>e.g. close open F&B orders]
        A5[Click Run Night Audit]
        A6[Wait for completion]
        A7[Open Night Report]
        A8[Export report as PDF]
        A9[Archive PDF]
    end

    subgraph S[System]
        S1[Run prerequisite checks:<br/>any open F&B orders?<br/>any unresolved issues?]
        S2[Show blocking issues with<br/>links to resolve]
        S3[Begin transaction]
        S4[Loop: for each<br/>CHECKED_IN reservation]
        S5[Read arrangementType]
        S6{Arrangement type?}
        S7[Post ROOM-CHARGE line item]
        S8[Post ROOM-CHARGE + BREAKFAST<br/>line items]
        S9[Post ROOM-CHARGE + BREAKFAST<br/>+ COFFEE-BREAK + LUNCH + DINNER<br/>line items]
        S10[Aggregate revenue by article type]
        S11[Compute occupancy rate<br/>OC rooms / non-OOO rooms]
        S12[Compute occupancy and revenue metrics]
        S13[Create NightAudit record<br/>status COMPLETED<br/>snapshot fields:<br/>room_revenue, fb_revenue,<br/>occupancy, counts, totals]
        S14[Advance business date]
        S15[Commit transaction]
        S16[Render Night Report]
        S17[Render report as PDF]
    end

    End([Day closed,<br/>report archived])

    Start --> A1 --> A2 --> S1 --> A3
    A3 -->|No| S2 --> A4 --> A2
    A3 -->|Yes| A5 --> S3 --> S4 --> S5 --> S6
    S6 -->|RO| S7 --> S4
    S6 -->|RB| S8 --> S4
    S6 -->|FBM| S9 --> S4
    S4 -.->|All processed| S10 --> S11 --> S12 --> S13 --> S14 --> S15 --> A6 --> A7 --> S16 --> A8 --> S17 --> A9 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style A3 fill:#fffbeb
    style S6 fill:#fffbeb
    style S3 fill:#eff6ff
    style S15 fill:#eff6ff
    style S2 fill:#fef2f2
```

**Key logic:**

- **Atomic across all in-house guests:** every CHECKED_IN reservation's auto-posting happens in one transaction. If posting fails for any guest midway, the entire night audit rolls back. This prevents partial-audit states where some guests were charged and others weren't.
- **Arrangement-driven posting:** the system reads each reservation's `arrangementType` and posts the corresponding articles. The article prices come from each article's `defaultPrice`. The room rate comes from the reservation's `rateAmount` (snapshot at booking).
- **Idempotency consideration:** running night audit twice for the same business date would post duplicate charges. The system prevents this by checking the NightAudit record before running — if today's business date already has a COMPLETED audit, the operation is rejected. (Implementation detail handled in AC-02.)
- **Report snapshot:** the NightAudit record stores explicit snapshot fields (`room_revenue`, `fb_revenue`, occupancy, counts, totals). This freezes the report at the moment of audit completion. Even if reservations are later edited or folios modified, the night report shows the state as it was at audit time. This is important for accounting compliance.

---

## Diagram conventions

Mermaid flowchart syntax with the following conventions:

- **Pill shapes** `([ ])` = start and end events of the use case
- **Rectangles** `[ ]` = activities performed by actors or the system
- **Diamonds** `{ }` = decision points with branching outcomes
- **Subgraphs** = actor lanes (an approximation of UML swim lanes; mermaid doesn't have native swim-lane primitives)
- **Solid arrows** = next-step transitions
- **Dotted arrows** = loop-back transitions or asynchronous returns
- **Color coding:**
  - Green `#ecfdf5` — start states and successful end states
  - Yellow `#fffbeb` — decision points or attention-required states
  - Blue `#eff6ff` — system transactional actions (begin/commit)
  - Red `#fef2f2` — error states or terminal failures

Colors match the project's status palette used throughout the application UI for visual consistency.

---

## Coverage notes

This document covers the use cases with non-trivial decision logic or multi-actor coordination. Trivial use cases are intentionally omitted from activity diagrams:

| Use Case | Reason for omission |
|---|---|
| UC-HK-01 View Room Status | Read-only display; no decision logic |
| UC-AC-02 Generate Night Report | Read-only render of NightAudit snapshot fields |
| UC-AD-01 Manage Master Data | CRUD operations; covered by use case narrative |
| UC-AD-02 Manage Users & Roles | CRUD operations; covered by use case narrative |

The six diagrams above capture the operationally-interesting flows. Read in sequence with the business process document for a complete picture of how the system behaves.
