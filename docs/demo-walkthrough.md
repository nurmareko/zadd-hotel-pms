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
**Action:** As `fo1`, create a new reservation. Choose room type, stay dates, **arrangement = RB or FBM**, and reservation type. Review the server-resolved nightly rates and required deposit, which equals the first-night rate; neither value is editable.
**Verify:** Reservation gets a number (`RSV-yyMMdd-NNNN`), appears on Kalender, and its required deposit starts as **PENDING**.
**Demo note:** *"Reservasi baru langsung tampil di kalender."*

### 3. FO — check-in  ⚠️ *refactored flow — watch closely*
**Action:** On or after the arrival date, collect the required deposit before opening the GRC. Then review the GRC, ask the guest to sign on the required on-screen signature pad, and confirm check-in.
**Verify:** Deposit collection creates or reuses the **OPEN** folio, records exactly one matching **DEPOSIT** payment, and changes **PENDING → COLLECTED** atomically; repeating the collection does not duplicate the payment. A **PENDING** deposit has no override and blocks check-in. Check-in proceeds only while the reservation is **CONFIRMED** with a **COLLECTED** deposit, existing folio, and matching **DEPOSIT** payment; it then changes the reservation to **CHECKED_IN** and room to **OC**. The captured signature appears in the downloadable GRC PDF. No error, no slow hang.
**Demo note:** *"Front Office mengumpulkan deposit wajib terlebih dahulu; setelah statusnya COLLECTED, tamu menandatangani GRC dan melanjutkan check-in dengan folio yang sudah tersedia."*
**Regression check:** this is one of the two flows refactored for the P2028 fix — confirm it completes cleanly.

### 4. FB — order + charge to room
**Action:** As `fb1`, click an available table → new order → add 2-3 menu items → bill → **pay by Charge to Room**, entering the checked-in guest's room number.
**Verify:** Lookup resolves the correct guest/folio; on confirm the order → **CLOSED**, table → **AVAILABLE**, and the F&B charge posts to the guest's folio.
**Demo note:** *"Tamu memesan di restoran dan membebankan ke kamar — langsung masuk ke folio."*

### 5. FO — verify the charge landed
**Action:** As `fo1`, open the guest's folio.
**Verify:** The F&B charge appears as a line item and is included in the balance. (If it doesn't show, refresh — the live cross-tab update is a known Phase-2 limitation.)
**Demo note:** *"Resepsionis melihat tagihan F&B tanpa rekonsiliasi manual."*

### 6. HK — assignment, cleaning, and inspection
**Action:** As `hk2`, open the Room Board at `/app/hk/rooms` and assign a vacant dirty room to `hk1` (single room or bulk assignment). As `hk1` on a mobile viewport, open `/app/hk/mobile`, start the assigned room's cleaning timer, complete the required linen/towel checklist, and finish with a note. Return to `hk2` and approve the VCU inspection from the board. Use a separate stayover room to exercise `OD → OC` without a vacant-room inspection.
**Verify:** HK and ADMIN have the same full HK operational access, with no supervisor tier; both can open the board, phone workspace, linen circulation, and full Lost & Found registry. Only the assigned operator can start/finish cleaning. `CleaningSession` timing and inspection attribution remain visible in room history, `VD → VCU → VC` updates the board's VCU inbox, and FO Kalender reflects the status change. Confirm `/app/hk` lands on `/app/hk/rooms`; `/app/hk/supervisor` is a permanent, query-preserving HTTP 308 shim and `/app/hk/list` remains a compatibility redirect to the board. Both shims are retained, not slated for removal. These are walkthrough checks to perform, not claims of completed verification.
**Demo note:** *"Petugas HK dan Admin memiliki akses operasional yang sama. Petugas `hk2` membagi tugas, petugas `hk1` yang ditugaskan membersihkan dari HP, lalu petugas `hk2` memeriksa kamar sebelum kembali dijual. Setiap tindakan tetap tercatat."*

### 7. HK / FO / ADMIN — Lost & Found
**Action:** As `hk1`, log a text-only found item from Lost & Found or room detail. As `fo1`, search for it and mark it returned with a resolution note; HK, FO, and ADMIN share the full registry permissions, including claim, disposal/donation, and export.
**Verify:** Item starts UNCLAIMED, search finds it by text/room/status, and returned resolution sets RETURNED with a returned timestamp.
**Demo note:** *"Barang tertinggal dapat dicatat, dicari, dan diselesaikan oleh petugas HK maupun FO."*

### 8. ACC — run Night Audit
**Action:** As `acc1`, open Night Audit. Review the pre-run summary (in-house count, arrangement breakdown). Run it.
**Verify:** Room charge posts to each in-house folio at the reservation rate, plus the correct F&B inclusions for the arrangement (RB → breakfast; FBM → breakfast + coffee + lunch + dinner). NightAudit snapshot created. Re-run is blocked.
**Demo note:** *"Night audit otomatis memposting tagihan kamar dan paket F&B sesuai tipe arrangement."*

### 9. FO — verify the audit charges
**Action:** As `fo1`, reopen the guest's folio.
**Verify:** Folio now shows the F&B charge-to-room item (step 4) **plus** the night-audit room charge **plus** arrangement inclusions. Balance reflects all of them, no duplicates.
**Demo note:** *"Semua tagihan terkumpul di satu folio."*

### 10. FO — check-out  ⚠️ *refactored flow — watch closely*
**Action:** Check out the guest. Observe the rounded whole-IDR balance gate: a positive balance must be settled; zero or credit may proceed. If credit remains, follow the warning and return the excess to the guest.
**Verify:** A positive balance blocks; zero or credit proceeds. On completion, folio → **CLOSED**, reservation → **CHECKED_OUT**, room → **VD**. Bill PDF generates listing **all** charges (F&B + room + inclusions).
**Demo note:** *"Saldo positif harus dilunasi; saldo nol atau kredit dapat dilanjutkan, dan kelebihan kredit dikembalikan kepada tamu."*
**Regression check:** the second refactored flow — confirm it completes and the totals aggregate correctly.

### 11. ACC — Night Report
**Action:** As `acc1`, open the audit's report; print the PDF.
**Verify:** On-screen and PDF numbers match the snapshot (occupancy, revenue breakdown room/F&B/other/total).
**Demo note:** *"Laporan night audit siap cetak untuk manajemen."*

---

## Pass criteria

All eleven steps complete without errors, and at step 9 the folio shows every charge exactly once. If steps 3 or 10 fail or behave oddly, that's a check-in/check-out refactor bug — report it before doing anything else.

## Reuse as demo

Steps 2 → 4 → 7 → 9 are the spine: reserve → charge to room → night audit → check-out. That four-beat sequence is the most compelling demo narrative because it shows the modules working *together*, not in isolation. Pre-warm the deployed app a minute before presenting so no cold-start stall interrupts the flow.
