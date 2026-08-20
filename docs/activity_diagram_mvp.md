# Activity Diagrams (MVP)

UML-style activity diagrams for the main use cases. Each diagram shows the step-by-step flow of a single operation including decision points, parallel paths, and which actor (or the system) performs each step.

This document complements [use_case_narrative_mvp.md](./use_case_narrative_mvp.md) (use case overview) and [business_process_mvp.md](./business_process_mvp.md) (cross-process workflows). Where business processes are wide and shallow, activity diagrams are narrow and deep — they describe one use case at a time with full internal logic.

Diagrams use Mermaid flowchart syntax with subgraphs representing actor lanes (an approximation of UML swim lanes). View inline on GitHub or paste into [mermaid.live](https://mermaid.live).

---

## 1. Process Reservation (Create)

**Use case:** UC-FO-01 Kelola Reservasi (Create)
**Actors:** Front Office staff (Receptionist), System
**Trigger:** Guest inquiry, walk-in, or Kalender empty-cell click

```mermaid
flowchart TD
    Start([Receptionist receives inquiry])

    subgraph R[Receptionist]
        R1{Opened from empty<br/>Kalender cell?}
        R2[Enter guest information<br/>name, ID, phone, email]
        R3[Enter stay details<br/>dates, room type, arrangement,<br/>optional physical room]
        R4[Adjust rate amount if needed]
        R5[Set reservation type<br/>Individual/Company/etc.]
        R6[Submit form]
        R7[Inform guest of<br/>confirmation number]
    end

    subgraph S[System]
        S0[Prefill room or room type<br/>and stay dates]
        S1[Validate input via Zod schema]
        S2{Validation pass?}
        S3[Begin Serializable transaction]
        S4{Guest count within<br/>RoomType.capacity?}
        S5[Check room-type inventory capacity<br/>for date range, including<br/>unallocated reservations]
        S6{Physical-room inventory<br/>still available?}
        S7{Physical room allocated?}
        S8[Check assigned-room overlap<br/>inside transaction]
        S9{Assigned room still free?}
        S10[Generate reservation_no<br/>RSV-yyMMdd-NNNN]
        S11[Create Guest record]
        S12[Create Reservation record<br/>status: CONFIRMED<br/>roomId may be NULL]
        S13[Commit transaction]
        S14[Revalidate Kalender<br/>and List views]
        S15[Show validation or<br/>capacity error]
        S16[Show availability conflict]
    end

    End([Reservation visible<br/>on Kalender])

    Start --> R1
    R1 -->|Yes| S0 --> R2
    R1 -->|No| R2
    R2 --> R3 --> R4 --> R5 --> R6 --> S1
    S1 --> S2
    S2 -->|No| S15 --> R3
    S2 -->|Yes| S3 --> S4
    S4 -->|No| S15
    S4 -->|Yes| S5 --> S6
    S6 -->|No| S16 --> R3
    S6 -->|Yes| S7
    S7 -->|No| S10
    S7 -->|Yes| S8 --> S9
    S9 -->|No| S16
    S9 -->|Yes| S10
    S10 --> S11 --> S12 --> S13 --> S14 --> R7 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style S2 fill:#fffbeb
    style S4 fill:#fffbeb
    style S6 fill:#fffbeb
    style S7 fill:#fffbeb
    style S9 fill:#fffbeb
    style S3 fill:#eff6ff
    style S13 fill:#eff6ff
    style S15 fill:#fef2f2
    style S16 fill:#fef2f2
```

**Key logic:**

- **Optional allocation:** a reservation may be saved with `roomId = NULL`. If creation starts from an empty Kalender cell, room or room-type and date inputs are prefilled; the receptionist can still leave the physical room unallocated.
- **Two capacity meanings:** `RoomType.capacity` limits guests per room. Overbooking prevention uses inventory capacity: the number of physical rooms registered for the selected room type. Active unallocated reservations consume that inventory too.
- **Defensive checks inside the transaction:** inventory capacity and any assigned-room overlap are checked again inside the Serializable transaction before Guest and Reservation rows are created.
- **Reservation number generation:** the `RSV-yyMMdd-NNNN` format uses the hotel date plus a sequential counter for the day. The counter is computed inside the transaction to prevent race conditions if two reservations are created simultaneously.

---

## 2. Cancel Confirmed Reservation

**Use case:** UC-FO-02 Batalkan Reservasi
**Actors:** Front Office staff (Receptionist), System
**Trigger:** Receptionist cancels a reservation from its detail screen
**Precondition:** Reservation status is CONFIRMED and no folio exists

```mermaid
flowchart TD
    Start([Receptionist opens<br/>reservation detail])

    subgraph R[Receptionist]
        R1[Click Cancel Reservation]
        R2[Review confirmation dialog]
        R3[Confirm cancellation]
    end

    subgraph S[System]
        S1[Begin transaction]
        S2[Re-verify status CONFIRMED<br/>and folio does not exist]
        S3{Still cancellable?}
        S4[Update Reservation:<br/>status CANCELLED]
        S5[Commit transaction]
        S6[Revalidate Kalender,<br/>active list, and detail]
        S7[Show cancellation error]
    end

    End([Inventory capacity released;<br/>reservation leaves active views])

    Start --> R1 --> R2 --> R3 --> S1 --> S2 --> S3
    S3 -->|No| S7
    S3 -->|Yes| S4 --> S5 --> S6 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style S3 fill:#fffbeb
    style S1 fill:#eff6ff
    style S5 fill:#eff6ff
    style S7 fill:#fef2f2
```

**Key logic:**

- **Restricted transition:** only `CONFIRMED → CANCELLED` is allowed. Checked-in and checked-out stays cannot use this flow.
- **Capacity release:** cancelled reservations no longer count toward room-type inventory capacity and are omitted from the default active Kalender and reservation-list views.
- **Transactional guard:** status and folio absence are re-checked inside the transaction to handle concurrent operations safely.

---

## 3. Process Check-in

**Use case:** UC-FO-03 Proses Check-in
**Actors:** Front Office staff (Receptionist), Guest, System
**Trigger:** Guest arrives at the hotel on or after the reservation's arrival date
**Precondition:** Arrival date ≤ today. At check-in commit, the reservation must still be `CONFIRMED`, its deposit must be `COLLECTED`, its folio must exist, and that folio must contain the matching `DEPOSIT`-purpose payment.

```mermaid
flowchart TD
    Start([Guest arrives])

    subgraph G[Guest]
        G1[Present identification]
        G2[Sign GRC on screen]
    end

    subgraph R[Receptionist]
        R1[Look up reservation]
        R2[Confirm/update<br/>guest details on screen]
        R3{Room pre-assigned?}
        R4[Confirm or change<br/>assigned room]
        R5[Pick available room<br/>of booked type]
        R6[Set purpose of visit]
        R7[Present signature pad]
        R8[Collect required deposit<br/>amount is not editable]
        R9[Tick confirmation checkbox]
        R10[Click Complete Check-In]
    end

    subgraph S[System]
        S0{Deposit status?}
        S16[Begin Serializable<br/>collection transaction]
        S17[Re-read reservation and<br/>first ReservationNight rate]
        S18[Create or reuse folio;<br/>record one DEPOSIT payment;<br/>CAS PENDING to COLLECTED]
        S19[Commit and return payment;<br/>retry returns existing payment]
        S1[Begin check-in transaction]
        S2[Re-verify CONFIRMED,<br/>COLLECTED, existing folio,<br/>and matching DEPOSIT payment]
        S3{Check-in gate valid?}
        S4[Re-check room overlap<br/>defensive inside transaction]
        S5{Room still available?}
        S6[Update Guest record]
        S7[Compare-and-set Reservation:<br/>CONFIRMED to CHECKED_IN;<br/>save room and signed GRC]
        S9[Update Room: status OC]
        S12[Commit transaction]
        S13[Redirect to existing folio]
        S14[Show error:<br/>check-in prerequisites failed]
        S15[Show error:<br/>room no longer available]
    end

    End([Folio screen open])

    Start --> G1 --> R1 --> S0
    S0 -->|PENDING| R8 --> S16 --> S17 --> S18 --> S19 --> R2
    S0 -->|COLLECTED| R2
    R2 --> R3
    R3 -->|Yes| R4 --> R6
    R3 -->|No| R5 --> R6
    R6 --> R7 --> G2 --> R9 --> R10 --> S1
    S1 --> S2 --> S3
    S3 -->|No| S14
    S3 -->|Yes| S4 --> S5
    S5 -->|No| S15
    S5 -->|Yes| S6 --> S7 --> S9 --> S12
    S12 --> S13 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style R3 fill:#fffbeb
    style S0 fill:#fffbeb
    style S3 fill:#fffbeb
    style S5 fill:#fffbeb
    style S16 fill:#eff6ff
    style S19 fill:#eff6ff
    style S1 fill:#eff6ff
    style S12 fill:#eff6ff
    style S14 fill:#fef2f2
    style S15 fill:#fef2f2
```

**Key logic:**

- **Required collection before check-in:** every reservation's deposit is the server-resolved first `ReservationNight.rateAmount`; the client cannot edit it. On or after arrival, Front Office must collect it before check-in. `PENDING` blocks check-in with no waiver or override.
- **Single idempotent collection writer:** the canonical serializable collection transaction creates or reuses the folio, records one matching `DEPOSIT`-purpose payment, and atomically compare-and-sets `PENDING → COLLECTED`. A retry returns the existing payment without creating a duplicate.
- **Required digital GRC signature:** the guest signs on screen before submission. The check-in transaction saves the signed GRC with the reservation update, and the GRC PDF embeds the captured signature.
- **Defensive re-verification:** check-in re-checks `CONFIRMED`, `COLLECTED`, the existing folio, its matching deposit payment, and room availability inside the transaction, then compare-and-sets `CONFIRMED → CHECKED_IN`.
- **Separate atomic responsibilities:** collection owns folio and deposit-payment creation. Check-in atomically updates Guest, Reservation, and Room state; it never collects the deposit or creates the folio.
- **Group behavior:** bulk collection invokes the same writer independently for each eligible sibling. Group batch check-in never collects deposits; it skips `PENDING` siblings and processes only eligible `COLLECTED` siblings.

---

## 4. Process F&B Order

**Use case:** UC-FB-01 Create Captain Order, UC-FB-02 Process F&B Bill, UC-FB-03 Proses Pembayaran F&B
**Actors:** F&B staff (Waiter), System
**Trigger:** Guest sits at a restaurant table, an in-house guest requests room service, or waiter opens an existing order
**Precondition:** Dine-in table is AVAILABLE/RESERVED, or room-service room has a CHECKED_IN reservation with an OPEN folio

```mermaid
flowchart TD
    Start([Guest ready to order])

    subgraph W[F&B Waiter]
        W1[Open F&B floor plan<br/>/app/fb]
        W2{Use existing order?}
        W3[Select occupied table<br/>or order from list]
        W4[Open Create Order<br/>/app/fb/orders/new]
        W21{Service type?}
        W5[Select available/reserved table<br/>and guest count]
        W22[Choose Room Service<br/>and enter room number + guest count]
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
        W16[Enter guest room number<br/>or use attached folio]
        W17[Submit payment]
        W18[Download/print receipt]
        W19[Serve guest / close table if dine-in]
        W20[Show error to waiter]
    end

    subgraph S[System]
        S1[Load table-only floor plan<br/>and active orders]
        S2[Validate table availability<br/>and guest count]
        S3{Table available?}
        S4[Begin transaction]
        S5[Create DINE_IN FBOrder<br/>status OPEN]
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
        S23[Resolve charge-to-room folio:<br/>room lookup or attached folio]
        S24{Open folio found?}
        S25[Insert one FolioLineItem<br/>articleId: F&B charge<br/>fb_order_id linked]
        S26[Update FBOrder:<br/>status CLOSED<br/>payment_method set]
        S27[Update RestaurantTable<br/>status AVAILABLE if table exists]
        S28[Commit transaction]
        S29[Generate F&B receipt PDF]
        S30[Show error:<br/>table/order/payment invalid]
        S31[Show error:<br/>room not found,<br/>no in-house guest,<br/>or folio closed]
        S34[Lookup room,<br/>CHECKED_IN reservation,<br/>and OPEN folio]
        S35{Room service<br/>folio valid?}
        S36[Create tableless FBOrder:<br/>serviceType ROOM_SERVICE<br/>chargedFolioId set]
    end

    End([Order CLOSED<br/>table freed if dine-in])

    Start --> W1 --> S1 --> W2
    W2 -->|Yes| W3 --> W6
    W2 -->|No| W4 --> W21
    W21 -->|Dine-in| W5 --> S2 --> S3
    W21 -->|Room Service| W22 --> S4 --> S34 --> S35
    S35 -->|No| S31 --> W20
    S35 -->|Yes| S36 --> S7 --> W6
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
    style W21 fill:#fffbeb
    style W12 fill:#fffbeb
    style S3 fill:#fffbeb
    style S12 fill:#fffbeb
    style S19 fill:#fffbeb
    style S24 fill:#fffbeb
    style S33 fill:#fffbeb
    style S35 fill:#fffbeb
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
- **Dine-in table locking at order creation:** the system validates the selected table and creates the OPEN `DINE_IN` FBOrder in one transaction, then marks the RestaurantTable OCCUPIED. This prevents two waiters from opening competing orders on the same table.
- **Room-service order creation:** `/app/fb/orders/new?service=room-service` validates room number → CHECKED_IN reservation → OPEN folio inside the create transaction, then creates an OPEN `ROOM_SERVICE` FBOrder with `tableId`/`tableNo` null and `chargedFolioId` set. Rooms without an in-house guest or open folio are rejected.
- **Captain Order before billing:** menu items are stored as FBOrderItem rows while the order is OPEN. The bill cannot be generated until at least one item exists.
- **Bill locks totals:** confirming the bill computes subtotal, service charge, tax, and total from hotel settings, then changes the order from OPEN to BILLED. Payment is only allowed from BILLED state.
- **Four payment paths:** cash, card, and transfer create Payment rows linked to the FBOrder. Charge-to-room validates an in-house guest and OPEN folio for dine-in, or uses the already-attached folio for room service, then creates one FolioLineItem with `fb_order_id` linked to the originating order.
- **Close and free table:** successful payment updates FBOrder to CLOSED and frees the RestaurantTable back to AVAILABLE only when the order has a table. Room-service orders are tableless and do not affect the floor plan. Receipt PDF generation happens after the transactional state change.

---

## 5. Process Check-out (with «include» Verify Checkout Balance)

**Use case:** UC-FO-04 Proses Check-out with «include» Verifikasi Saldo Check-out
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
        R4{Rounded whole-IDR<br/>balance?}
        R5[Collect final payment]
        R6[Record payment in system]
        R7[Tick confirmation:<br/>guest left, room verified]
        R8[Click Complete Check-Out]
        R9[Download PDF bill]
        R10[Hand bill to guest]
        R11[Show credit warning;<br/>return excess to guest]
    end

    subgraph G[Guest]
        G1[Pay outstanding amount]
        G2[Receive bill, depart]
        G3[Receive returned excess]
    end

    subgraph S[System]
        S1[Post pending stay-charge<br/>catch-up shortfall]
        S2[Compute rounded whole-IDR totals<br/>INCLUDE: Verify Checkout Balance]
        S3[Post catch-up idempotently;<br/>insert Payment record]
        S4[Recompute folio totals]
        S5{Rounded balance<br/>positive?}
        S6[Post catch-up again<br/>idempotently]
        S7[Recompute folio totals]
        S8{Rounded balance<br/>positive?}
        S9[Re-verify folio status<br/>and reservation status]
        S10{Statuses valid?}
        S11[Begin transaction]
        S12[Update Folio:<br/>status CLOSED<br/>closedAt: now]
        S13[Update Reservation:<br/>status CHECKED_OUT]
        S14[Update Room: status VD]
        S15[Commit transaction]
        S16[Render PDF bill]
        S17[Show error:<br/>rounded whole-IDR balance still positive]
        S18[Show error:<br/>state changed elsewhere]
    end

    End([Reservation CHECKED_OUT<br/>Room available for HK])

    Start --> R1 --> R2 --> S1 --> S2 --> R3
    R3 --> R4
    R4 -->|Positive| R5 --> G1 --> R6 --> S3 --> S4 --> S5
    S5 -->|Yes| R5
    S5 -->|No: zero or credit| R7
    R4 -->|Zero| R7
    R4 -->|Credit| R11 --> G3 --> R7
    R7 --> R8 --> S6 --> S7 --> S8
    S8 -->|Yes| S17 --> R5
    S8 -->|No: zero or credit| S9 --> S10
    S10 -->|No| S18
    S10 -->|Yes| S11 --> S12 --> S13 --> S14 --> S15 --> S16 --> R9 --> R10 --> G2 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style R4 fill:#fffbeb
    style S5 fill:#fffbeb
    style S8 fill:#fffbeb
    style S10 fill:#fffbeb
    style S11 fill:#eff6ff
    style S15 fill:#eff6ff
    style S17 fill:#fef2f2
    style S18 fill:#fef2f2
```

**Key logic:**

- **«include» Verify Checkout Balance:** the verification runs whenever check-out is attempted. Before judging the balance, the server posts any pending stay-charge shortfall the night audit has not posted yet and computes the folio in rounded whole IDR. A positive balance blocks check-out; zero or credit may proceed. Charges posted before a blocked attempt remain visible as the true outstanding balance.
- **Payment iteration loop:** if the rounded whole-IDR balance remains positive after a payment, the system recomputes the folio and requires another payment. This supports multiple payment methods, such as partial cash followed by partial card.
- **Three state changes in commit:** Folio close, Reservation flip, Room flip. The PDF generation happens AFTER commit — it's a side effect, not part of the transactional state change.
- **Credit balance handling:** if the rounded whole-IDR balance is negative, check-out proceeds without further payment. The system shows a credit warning and instructs the receptionist to return the excess to the guest; the MVP does not post an automated refund transaction.

---

## 6. Update Room Status

**Use case:** UC-HK-02 Clean Assigned Room with timer and VCU inspection workflow
**Actors:** Front Office staff, Housekeeping staff, Housekeeping supervisor, System
**Trigger:** HK sees an assigned vacant dirty room after check-out, or FO requests cleaning for an in-house room

```mermaid
flowchart TD
    Start([Room needs cleaning])

    subgraph FO[Front Office Staff]
        FO1{In-house guest<br/>requests cleaning?}
        FO2[Open reservation detail<br/>and request cleaning]
    end

    subgraph SUP1[HK Supervisor]
        SP1[Open Supervisor Dashboard<br/>or Supervisor Rooms]
        SP2[Assign room for date]
        SP3[Optional bulk assignment<br/>by floor/workload]
    end

    subgraph HK[Housekeeping Staff]
        HK1[Open My Rooms<br/>Kamar Saya]
        HK2[Open shared room detail]
        HK3[Tap Start Cleaning timer]
        HK4[Clean the room]
        HK5[Tap Finish Cleaning]
        HK6[Add optional status note]
    end

    subgraph HS[HK Supervisor Inspection]
        HS1[See VCU rooms in<br/>inspection inbox or rooms page]
        HS2[Walk to room and inspect]
        HS3{Inspection pass?}
        HS4[Tap Approve - VC]
        HS5[Tap Reject - back to VD]
        HS6[Optional manual override<br/>from Supervisor Rooms]
    end

    subgraph S[System]
        S0[Update Room status:<br/>OC → OD]
        S1[Create/update CleaningSession:<br/>started_at set]
        S2[Update CleaningSession:<br/>finished_at set]
        S3{Room occupied?}
        S4[Update Room status:<br/>OD → OC]
        S5[Update Room status:<br/>VD → VCU]
        S6[Sync Kalender and FO views]
        S7[Update Room status:<br/>VCU → VC]
        S8[Update Room status:<br/>VCU → VD]
        S9[Update CleaningSession:<br/>inspected_at / inspected_by_id]
        S10[Append housekeeping_log row<br/>for every status change]
    end

    End1([Room available for booking])
    End2([Room needs re-cleaning])
    End3([Occupied room clean;<br/>guest remains in-house])

    Start --> FO1
    FO1 -->|Yes| FO2 --> S0 --> SP1
    FO1 -->|No, vacant VD| SP1
    SP1 --> SP2
    SP1 --> SP3 --> SP2
    SP2 --> HK1
    HK1 --> HK2 --> HK3 --> S1 --> HK4 --> HK5 --> HK6 --> S2 --> S3
    S3 -->|Yes| S4 --> S10 --> S6 --> End3
    S3 -->|No| S5 --> S10 --> S6 --> HS1
    HS1 --> HS2 --> HS3
    HS3 -->|Yes| HS4 --> S7 --> S9 --> S10 --> End1
    HS3 -->|No| HS5 --> S8 --> S9 --> S10 --> End2
    HS6 --> S10 --> S6
    End2 -.->|Returns to cleaning queue| HK1

    style Start fill:#ecfdf5
    style End1 fill:#ecfdf5
    style End3 fill:#ecfdf5
    style End2 fill:#fffbeb
    style FO1 fill:#fffbeb
    style S3 fill:#fffbeb
    style HS3 fill:#fffbeb
    style S0 fill:#eff6ff
    style S4 fill:#eff6ff
    style S5 fill:#eff6ff
    style S7 fill:#eff6ff
    style S8 fill:#fef2f2
```

**Key logic:**

- **CleaningSession is the workflow source:** assignment, timer start, finish, and inspection are read from `cleaning_session`. Active cleaning is derived from `started_at IS NOT NULL AND finished_at IS NULL`; duration is derived from `finished_at - started_at`.
- **HousekeepingLog is the audit trail:** every room-status change appends a `housekeeping_log` row with old status, new status, actor, timestamp, and optional status note. It is not the source for active timer state.
- **Occupied-room loop:** FO can request cleaning from an in-house reservation detail, changing the room from `OC → OD`. When HK stops cleaning an occupied room, the room returns directly to `OC`.
- **Vacant-room inspection:** stopping cleaning for a vacant dirty room changes `VD → VCU`. Inspection then approves `VCU → VC` or rejects `VCU → VD`.
- **Supervisor tier:** inspection, assignment, bulk assignment, Daily List print, and manual override are gated to HK users with `User.isSupervisor = true`. ADMIN has no HK access. Housekeepers clean only their operational worklist.
- **Manual override:** supervisors can bypass the normal clean/inspect path from Supervisor Rooms when operations require it; the override still writes the status audit.
- **Loop on rejection:** if inspection fails, the room returns to VD. The cleaning cycle repeats — same staff or different, depending on shift. The housekeeping_log row history captures every iteration for accountability.
- **Kalender sync:** every status change revalidates Front Office reservation views. The FO receptionist sees room status updates in Kalender without maintaining a separate room-status dashboard widget.

---

## 7. Lost & Found

**Use case:** UC-HK-03 Log, search, and resolve Lost & Found
**Actors:** Housekeeping staff, Front Office staff, System
**Trigger:** HK or FO logs a found item, searches the custody list, or returns an item to a claimant

```mermaid
flowchart TD
    Start([Item found or guest asks])

    subgraph STAFF[FO or HK Staff]
        ST1[Open Lost & Found<br/>or HK room detail]
        ST2{Requested action?}
        ST3[Enter text description<br/>and optional room]
        ST4[Search by text,<br/>room, or status]
        ST5{Guest claims item?}
        ST6[Enter claimant or<br/>resolution note]
        ST7[Mark returned]
    end

    subgraph S[System]
        S1[Create LostFoundItem:<br/>UNCLAIMED]
        S2[Filter text-only records]
        S3[Update status:<br/>RETURNED]
        S4[Set returned_at<br/>and resolution]
    end

    End1([Item held for follow-up])
    End2([Item resolved])

    Start --> ST1 --> ST2
    ST2 -->|Log| ST3 --> S1 --> End1
    ST2 -->|Search / return| ST4 --> S2 --> ST5
    ST5 -->|No| End1
    ST5 -->|Yes| ST6 --> ST7 --> S3 --> S4 --> End2

    style Start fill:#ecfdf5
    style End1 fill:#fffbeb
    style End2 fill:#ecfdf5
    style ST2 fill:#fffbeb
    style ST5 fill:#fffbeb
    style S1 fill:#eff6ff
    style S3 fill:#eff6ff
    style S4 fill:#eff6ff
```

**Key logic:**

- **Text-only custody log:** Lost & Found stores text description, optional room, found-by user, status, returned timestamp, and resolution. It does not store photos or create maintenance work.
- **Shared access:** both FO and HK can log and search items and mark an item returned with a resolution note; other roles are denied.
- **Operationally independent:** marking an item returned does not change room status, reservation status, or folio state.

---

## 8. Run Night Audit

**Use case:** UC-AC-01 Jalankan Night Audit
**Actors:** Accounting staff (Night Auditor), System
**Trigger:** Accounting runs the audit for the current WIB (`Asia/Jakarta`) hotel date
**Precondition:** Accounting user is authenticated; required posting articles and in-house folios are valid
**Note:** This diagram represents the shipped workflow. The app uses the live WIB business date, stores one completed audit per `business_date`, treats open F&B orders as warnings, and does not persist an "advance business date" step.

```mermaid
flowchart TD
    Start([Night audit for current<br/>WIB business date])

    subgraph A[Accountant]
        A1[Open Night Audit screen]
        A2[Review checklist,<br/>warnings, and preview]
        A3{Blocking errors?}
        A4[Resolve blocking errors]
        A5[Click Run Night Audit]
        A6[Wait for completion]
        A7[Open Night Report]
        A8[Export report as PDF]
        A9[Archive PDF]
    end

    subgraph S[System]
        S1[Resolve current WIB date<br/>and check existing audit]
        S2{Audit already exists?}
        S3[Show already audited;<br/>post nothing]
        S4[Build plan:<br/>validate articles/folios,<br/>count open F&B warnings]
        S5[Show blocking errors<br/>with warnings preserved]
        S6[Begin serializable transaction]
        S7[Loop: for each<br/>CHECKED_IN open folio]
        S8[Re-read folio line items<br/>inside transaction]
        S9[Compute stay-charge shortfall:<br/>expected nights − already posted<br/>per article]
        S10[Create only missing<br/>ROOM/arrangement lines]
        S11[Aggregate revenue snapshot<br/>from actual postings + day totals]
        S12[Create NightAudit record<br/>status COMPLETED<br/>unique business_date]
        S13[Commit transaction]
        S14[Render Night Report]
        S15[Render report as PDF]
    end

    End([Day closed,<br/>report archived])

    Start --> A1 --> S1 --> S2
    S2 -->|Yes| S3
    S2 -->|No| S4 --> A2 --> A3
    A3 -->|Yes| S5 --> A4 --> A2
    A3 -->|No| A5 --> S6 --> S7 --> S8 --> S9 --> S10 --> S7
    S7 -.->|All processed| S11 --> S12 --> S13 --> A6 --> A7 --> S14 --> A8 --> S15 --> A9 --> End

    style Start fill:#ecfdf5
    style End fill:#ecfdf5
    style A3 fill:#fffbeb
    style S2 fill:#fffbeb
    style S6 fill:#eff6ff
    style S13 fill:#eff6ff
    style S3 fill:#f1f5f9
    style S5 fill:#fef2f2
```

**Key logic:**

- **WIB business date:** the audit date and timestamp windows are derived from `Asia/Jakarta`, not the server-local calendar date. The app does not store or advance a separate business-date pointer.
- **Atomic across all in-house guests:** every CHECKED_IN reservation's auto-posting happens in one serializable transaction. Each open folio's line items are re-read inside that transaction before posting.
- **Shortfall-based arrangement posting:** the system reads each reservation's `arrangementType` and posts only the difference between expected nights and already-posted line items per article. If a prior night was missed, the next audit backfills the shortfall; if checkout already posted the catch-up, the audit posts nothing for that folio.
- **Duplicate-audit lock:** `night_audit.business_date` is unique. Running the same WIB business date again is blocked before posting, and a concurrent duplicate fails on the unique constraint and rolls back.
- **Open F&B order warnings:** open F&B orders appear in the audit warnings, but they do not block execution.
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
| UC-HK-01 View My Rooms / Supervisor Rooms | Read-only list/worksheet display; no decision logic |
| UC-AC-02 Generate Night Report | Read-only render of NightAudit snapshot fields |
| UC-AD-01 Manage Master Data | CRUD operations; covered by use case narrative |
| UC-AD-02 Manage Users & Roles | CRUD operations; covered by use case narrative |

The eight diagrams above capture the operationally-interesting flows. Read in sequence with the business process document for a complete picture of how the system behaves.
