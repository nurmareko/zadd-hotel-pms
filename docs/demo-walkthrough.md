# End-to-End Walkthrough & Demo Script

A single guest lifecycle that exercises **every module and every cross-module seam**. Run it to (1) verify the system works end to end — especially the refactored check-in/check-out flows, and (2) rehearse the demo. Each step lists the **action**, what to **verify**, and a short **demo note** for narration.

---

## Setup

1. **Use a disposable database** — a Neon dev branch, not your shared/prod DB. Point local `.env` at the branch.
2. Clean state:
   ```bash
   npm run db:reset && npm run db:demo
   npm run dev
   ```
3. Logins:

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Front Office | fo1 | fo123 |
| HK Supervisor | hksup | hksup123 |
| Housekeeping | hk1 | hk123 |
| Housekeeping | hk2 | hk2123 |
| Housekeeping | hk3 | hk3123 |
| Food & Beverage | fb1 | fb123 |
| Accounting | acc1 | acc123 |

> Pick a **room with an arrangement of RB or FBM** for the test guest, so Night Audit posts F&B inclusions and the flow is visible.

---

## The walkthrough

### 1. Admin — confirm the foundation
**Action:** Log in as `admin`. Glance at Rooms, Room Types, Articles (confirm ROOM-CHARGE, BREAKFAST, COFFEE-BREAK, LUNCH, DINNER exist), F&B Menu, Hotel Settings (note the Service Charge % and Tax %).
**Verify:** Setup data is present; SC/Tax are non-zero so totals are visible.
**Demo note:** *"Admin mengelola data master — kamar, tarif, artikel, menu, dan pengaturan hotel."*

### 2. FO — create a reservation
**Action:** As `fo1`, create a new reservation. Choose room type, stay dates, **arrangement = RB or FBM**, reservation type, set rate + deposit.
**Verify:** Reservation gets a number (`RSV-yyMMdd-NNNN`), appears on Kalender.
**Demo note:** *"Reservasi baru langsung tampil di kalender."*

### 3. FO — check-in  ⚠️ *refactored flow — watch closely*
**Action:** Check in that reservation. Fill the GRC, ask the guest to sign on the required on-screen signature pad, then record the deposit.
**Verify:** Reservation → **CHECKED_IN**, room → **OC**, folio created and **OPEN**, deposit recorded, and the captured signature appears in the downloadable GRC PDF. No error, no slow hang.
**Demo note:** *"Saat check-in, tamu menandatangani GRC secara digital dan sistem membuat folio secara otomatis."*
**Regression check:** this is one of the two flows refactored for the P2028 fix — confirm it completes cleanly.

### 4. FB — order + charge to room
**Action:** As `fb1`, click an available table → new order → add 2-3 menu items → bill → **pay by Charge to Room**, entering the checked-in guest's room number.
**Verify:** Lookup resolves the correct guest/folio; on confirm the order → **CLOSED**, table → **AVAILABLE**, and the F&B charge posts to the guest's folio.
**Demo note:** *"Tamu memesan di restoran dan membebankan ke kamar — langsung masuk ke folio."*

### 5. FO — verify the charge landed
**Action:** As `fo1`, open the guest's folio.
**Verify:** The F&B charge appears as a line item and is included in the balance. (If it doesn't show, refresh — the live cross-tab update is a known Phase-2 limitation.)
**Demo note:** *"Resepsionis melihat tagihan F&B tanpa rekonsiliasi manual."*

### 6. HK — cleaning cycle (optional but good to show)
**Action:** As `hk1` (mobile viewport), pick a dirty room → start cleaning → stop (mark VCU) → pass inspection → VC.
**Verify:** Status transitions work; the change reflects on the FO Kalender.
**Demo note:** *"Housekeeping berjalan dari ponsel, status tersinkron ke front office."*

### 7. ACC — run Night Audit
**Action:** As `acc1`, open Night Audit. Review the pre-run summary (in-house count, arrangement breakdown). Run it.
**Verify:** Room charge posts to each in-house folio at the reservation rate, plus the correct F&B inclusions for the arrangement (RB → breakfast; FBM → breakfast + coffee + lunch + dinner). NightAudit snapshot created. Re-run is blocked.
**Demo note:** *"Night audit otomatis memposting tagihan kamar dan paket F&B sesuai tipe arrangement."*

### 8. FO — verify the audit charges
**Action:** As `fo1`, reopen the guest's folio.
**Verify:** Folio now shows the F&B charge-to-room item (step 4) **plus** the night-audit room charge **plus** arrangement inclusions. Balance reflects all of them, no duplicates.
**Demo note:** *"Semua tagihan terkumpul di satu folio."*

### 9. FO — check-out  ⚠️ *refactored flow — watch closely*
**Action:** Check out the guest. Observe the zero-balance gate — settle any balance owed, then confirm.
**Verify:** Gate blocks while money is owed; after settling, folio → **CLOSED**, reservation → **CHECKED_OUT**, room → **VD**. Bill PDF generates listing **all** charges (F&B + room + inclusions).
**Demo note:** *"Check-out hanya bisa setelah saldo lunas; tagihan final tercetak."*
**Regression check:** the second refactored flow — confirm it completes and the totals aggregate correctly.

### 10. ACC — Night Report
**Action:** As `acc1`, open the audit's report; print the PDF.
**Verify:** On-screen and PDF numbers match the snapshot (occupancy, revenue breakdown room/F&B/other/total).
**Demo note:** *"Laporan night audit siap cetak untuk manajemen."*

---

## Pass criteria

All ten steps complete without errors, and at step 8 the folio shows every charge exactly once. If steps 3 or 9 fail or behave oddly, that's a check-in/check-out refactor bug — report it before doing anything else.

## Reuse as demo

Steps 2 → 4 → 7 → 9 are the spine: reserve → charge to room → night audit → check-out. That four-beat sequence is the most compelling demo narrative because it shows the modules working *together*, not in isolation. Pre-warm the deployed app a minute before presenting so no cold-start stall interrupts the flow.
