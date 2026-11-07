# Stakeholder Meeting #3 — Pak Tito (Front Office) / Hospitality Lab

**Date:** 6 November 2026  
**Attendee:** Pak Tito (Front Office Stakeholder / Hospitality Lab Head)  
**Purpose:** Post-Demo Feedback, Front Office Ergonomics, and Operational Workflow Review  
**Prior meetings:**
- [stakeholder-meeting-1.md](./stakeholder-meeting-1.md) (8 May 2026)
- [stakeholder-meeting-2.md](./stakeholder-meeting-2.md) (21 May 2026)

---

## Executive Summary

Pak Tito provided detailed operational feedback focusing primarily on Front Office (FO) workflow ergonomics, reservation list customization, calendar density, and room configuration. Key themes include:
1. **Reservation Form Flexibility:** Support manual custom deposit amounts, mandatory guest phone numbers with optional ID document types, custom/manual arrangement rates, and room capacity/zero-availability guards.
2. **Screen Layout & Single-Page Density:** Minimize scrolling on the reservation detail page by consolidating it into balanced columns, and compact the Calendar / Tape Chart to fit comfortably on a single viewport.
3. **Reservation List Layout:** Explicit column ordering specified by Pak Tito, column-level filtering and sorting, and visible `Reservation Type`.
4. **Room Configuration:** Assign bed types (King, Queen, Twin, Single) per individual room.
5. **Billing & Folio Unification:** Unified guest folio for both charges and payments with article-driven payment categorization.
6. **Academic Attribution:** System footer / license attribution: *"by D3 RPLA Telkom University"*.

---

## Raw Notes (Verbatim)

```text
Hospitality 6 nov
-FO
deposit bisa custom ketik manual
layout diatur
phone number wajib, id type optional
harga arrangement manual aja
*misal full board package - meeting sekaligus kamarnya?
*bisa reservasi tanpa kamar?
tambahin notes sisa berapa, total berapa
fix tampilan OOO
klo udah 0 ada alert atau tidak bisa di input aja
tambahin minus per kamar
fix reservation details 
^ di jadiin satu halaman tidak terlalu banyak nge scroll
^ jadiin per satu kolom satu kolom 
^ calendar di kecilin lagi biar jadi satu halaman
^ kasih warna yg udah ada di bagian calendar biar gampang 
filter sort di reservation list, reservation type di tampilin di reservation list
urutan dri pak tito kanan ke kiri di reservation list: reference , reservation type, guest name, room, room type, check-in checkout , total, balance due, status
tampilannya sama
new reservation group misal 3 kamar 3 tipe kamar ntar blank dripada di add satu”
arrangement di hapus
tambah article buat payment, mo payment make apa di article nya. jadi satu aja bisa payment bisa charge pindahin jadi satu guest folio
tipe kasur di per kamar, bed type room masing”
bisa filter smua per kolom
kasih lisensi by d3rpla telyu …
```

---

## Detailed Feedback & Categorized Specifications

### 1. Front Office: Reservation Creation (`/app/fo/reservasi/new`)

- **Manual / Custom Deposit Amount (`deposit bisa custom ketik manual`):**
  - Allow operators to manually type a custom deposit amount during reservation creation rather than strictly locking it to the calculated first-night rate.
- **Form Layout & Structure (`layout diatur`):**
  - Streamline and rebalance field groupings and vertical pacing for cleaner navigation and faster data entry.
- **Guest Identity Validation (`phone number wajib, id type optional`):**
  - Make guest phone number mandatory (`required`).
  - Make guest ID document type (KTP, Passport, Driver's License) optional during initial reservation creation.
- **Manual Arrangement Pricing (`harga arrangement manual aja`):**
  - Provide an override field for arrangement pricing (e.g. per-guest package rate) or allow manual pricing entries.
- **Summary Notes with Balance Due (`tambahin notes sisa berapa, total berapa`):**
  - Display explicit summary notes / callouts indicating the total package amount and remaining balance due.
- **Inventory Depletion & Zero Availability Guard (`klo udah 0 ada alert atau tidak bisa di input aja`, `tambahin minus per kamar`):**
  - Show the decrement of remaining available rooms per room type.
  - When availability drops to 0, show an explicit alert or disable selection to prevent accidental overbooking.
- **Batch Multi-Room Generation (`new reservation group misal 3 kamar 3 tipe kamar ntar blank dripada di add satu”`):**
  - For group reservations (e.g., booking 3 rooms across different room types), provide a batch row generator or pre-filled structure instead of requiring staff to click "Add Room" one-by-one into empty rows.
- **Arrangement Field Simplification (`arrangement di hapus`):**
  - Evaluate removing or hiding the fixed arrangement selector if arrangement allocation is replaced by manual line items, custom pricing, or direct packages.

---

### 2. Front Office: Reservation Details (`/app/fo/reservasi/[id]`)

- **Single-Viewport Layout (`di jadiin satu halaman tidak terlalu banyak nge scroll`):**
  - Reorganize the reservation detail screen to reduce vertical scrolling and fit primary stay information, guest info, and quick actions within a single screen.
- **Structured Column Grid (`jadiin per satu kolom satu kolom`):**
  - Use structured, side-by-side balanced columns (e.g., Guest Information | Room & Stay Details | Folio & Payment Status).

---

### 3. Front Office: Calendar & Tape Chart

- **Compact Viewport Density (`calendar di kecilin lagi biar jadi satu halaman`):**
  - Reduce row heights, header margins, and cell padding so the calendar / tape chart fits on a standard laptop display without vertical pagination or deep scrolling.
- **Booking Status Color Coding (`kasih warna yg udah ada di bagian calendar biar gampang`):**
  - Apply distinctive, established status colors to booking blocks on the calendar for instantaneous visual recognition (e.g., Confirmed, Checked In, Checked Out, OOO).

---

### 4. Front Office: Reservation List (`/app/fo/reservasi`)

- **Explicit Column Order (Specified by Pak Tito):**
  From left to right:
  1. **Reference** (Reservation Number / Code)
  2. **Reservation Type** (Individual, Corporate, Government, OTA, Walk-in)
  3. **Guest Name**
  4. **Room** (Assigned Room Number)
  5. **Room Type**
  6. **Check-In / Check-Out** (Stay Dates)
  7. **Total** (Total Amount)
  8. **Balance Due**
  9. **Status** (Confirmed, Checked In, Checked Out, Cancelled)
- **Column Filtering & Sorting (`filter sort di reservation list`, `bisa filter smua per kolom`):**
  - Add interactive sorting and column-level filters across all table columns.
- **Visual Consistency (`tampilannya sama`):**
  - Keep typography, badges, and layout aligned with the established design system tokens.

---

### 5. Housekeeping & Rooms

- **Out of Order (OOO) Visual Distinction (`fix tampilan OOO`):**
  - Ensure rooms marked as OOO (Out of Order) stand out clearly on the Room Board, tape chart, and room lists with high-contrast red warning styling.
- **Bed Types per Room (`tipe kasur di per kamar, bed type room masing”`):**
  - Track bed configuration per room (e.g., King, Queen, Twin, Single) on the physical room record and display it in room selection and HK boards.

---

### 6. Billing, Folio & Articles

- **Article-Based Payment Classification & Unified Guest Folio (`tambah article buat payment...`):**
  - Consolidate charges and payments into a single unified guest folio.
  - Model payments and charges through categorized articles to provide clear audit trails and flexibility to transfer items between folios.

---

### 7. Academic Branding & Licensing

- **Telkom University D3 RPLA Attribution (`kasih lisensi by d3rpla telyu …`):**
  - Add a footer or credit banner: *"Developed by D3 Rekayasa Perangkat Lunak Aplikasi (RPLA) — Telkom University"*.

---

## Open Clarifications & Questions for Pak Tito

1. **Meeting Package Bundling (`misal full board package - meeting sekaligus kamarnya?`):**
   - When a Full Board / Meeting package is booked, how should meeting room venue rental be billed alongside sleeping rooms? Should the package automatically bundle both into a single folio line item, or remain separate charges?
2. **Roomless Reservations (`bisa reservasi tanpa kamar?`):**
   - Should the PMS support roomless reservations (e.g., banquet/meeting only, or day-use function space) without requiring an accommodation room number?
3. **Arrangement Deprecation vs. Customization (`arrangement di hapus` vs `harga arrangement manual aja`):**
   - Should standard arrangement types (RO, BB, HB, FB) be completely replaced with flexible custom packages, or kept as optional quick templates?

---

## Triage & Implementation Roadmap

| Priority | Feature / Adjustment | Module | Scope & Effort |
|---|---|---|---|
| **P1 (Immediate)** | Mandatory phone, optional ID type in reservation schema | FO | Small (~1 hr) |
| **P1 (Immediate)** | Reservation list column order & display Reservation Type | FO | Small (~2 hrs) |
| **P1 (Immediate)** | Reservation list column sort & filters | FO | Medium (~2-3 hrs) |
| **P1 (Immediate)** | Add "by D3 RPLA Telkom University" footer | Layout | Small (~30 mins) |
| **P1 (Immediate)** | Fix OOO visual styling & badge contrast | HK / FO | Small (~1 hr) |
| **P2 (Near-Term)** | Calendar / Tape Chart viewport compaction & color coding | FO | Medium (~3-4 hrs) |
| **P2 (Near-Term)** | Single-page consolidated reservation detail layout | FO | Medium (~3-4 hrs) |
| **P2 (Near-Term)** | Manual custom deposit input in reservation form | FO | Medium (~2-3 hrs) |
| **P2 (Near-Term)** | Zero-availability alerts & remaining room count indicators | FO | Medium (~2-3 hrs) |
| **P3 (Phase 2)** | Bed type attribute per room (King/Queen/Twin/Single) | Master / HK | Schema + UI (~4 hrs) |
| **P3 (Phase 2)** | Group reservation batch room generator | FO | Medium (~4 hrs) |
| **P3 (Phase 2)** | Unified article payments & charges / transfer between folios | Folio / ACC | High (~6-8 hrs) |
| **P3 (Phase 2)** | Roomless / meeting-only reservations | FO / FB | Architecture spike |
