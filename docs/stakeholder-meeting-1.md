# Catatan Tindak Lanjut: Stakeholder Meeting #1

| | |
|---|---|
| **Tanggal Meeting** | 8 Mei 2026 |
| **Stakeholder** | Bapak Tito (Front Office) |
| **Tim Pengembang** | [Nama Tim] |
| **Status Proyek** | Minggu ke-5 dari 8. Modul Foundation, Admin, dan FO selesai. Modul HK, FB, dan ACC dalam antrian. |
| **Ringkasan** | Demo MVP diterima positif. Pak Tito memberikan masukan tambahan yang dirangkum dan dikategorikan di bawah. |

---

## A. Ditambahkan ke MVP

Bolt-on kecil yang menggunakan infrastruktur yang sudah ada. Visible di demo berikutnya.

| Fitur | Modul | Cakupan | Estimasi |
|---|---|---|---|
| **Cetak Guest Registration Card** | FO | Tombol unduh PDF GRC pada folio tamu. Reuse infrastruktur PDF dari FO-07. | ~2 jam |
| **Tipe Reservasi** | FO | Field enum pada reservasi: Individual, Company, Government, Online Travel Agent, Walk-in. Ditampilkan di form & list. | ~1 jam |
| **Komentar Reservasi (atas & bawah)** | FO | Dua field text terpisah pada reservasi — komentar staf (atas) & komentar manajer (bawah). Dapat diedit pada FO-04. | ~1 jam |
| **Tipe Arrangement (RO / RB / FBM)** | FO + ACC | Field enum pada reservasi: Room Only, Room + Breakfast, Full Board Meeting. Night Audit auto-posting breakdown sesuai tipe (RO=kamar; RB=kamar+breakfast; FBM=kamar+breakfast+coffee break+lunch+dinner). | ~3-4 jam |
| **Auto-charge saat Night Audit** | ACC | Setiap kali Night Audit dijalankan, tagihan kamar untuk seluruh tamu CHECKED_IN otomatis di-posting ke folio masing-masing sesuai Tipe Arrangement. | Bagian dari AC-02 |
| **HK Dashboard mobile-first** | HK | Dashboard pemantauan status kamar, didesain untuk akses mobile (HP/tablet) oleh petugas HK. | Sudah direncanakan sebagai HK-01 |
| **Timer Pembersihan Kamar** | HK | Tombol Start/Stop pada layar Update Status untuk mencatat durasi pembersihan kamar. | ~1-2 jam |
| **Status Vacant Clean Unchecked (VCU)** | HK | Status tambahan antara VD dan VC. Petugas HK menandai kamar VCU setelah selesai membersihkan, lalu supervisor inspeksi untuk menjadikan VC. | ~2 jam |

**Total estimasi penambahan:** ~12-15 jam, didistribusikan ke modul yang sedang/akan dikerjakan.

---

## B. Ditunda ke Pengembangan Pasca-MVP

Sudah teridentifikasi tapi memerlukan cakupan yang melampaui timeline MVP 8 minggu. Akan didokumentasikan untuk fase pengembangan berikutnya.

| Fitur | Modul | Alasan Penundaan |
|---|---|---|
| **Master Bill & Dummy Bill** | ACC | Memerlukan konsep group billing dan reservasi rombongan yang belum ada di MVP. |
| **Tambah Reservasi dalam Nomor yang Sama** | FO | Sama dengan Master Bill — kebutuhan group booking. |
| **Tambah Kamar ke Reservasi Existing** | FO | Sama dengan group booking pattern. |
| **Waiter Mobile (tablet/HP)** | FB | Interface mobile-first F&B terpisah dari POS desktop. MVP fokus pada POS desktop terlebih dahulu; tablet/HP merupakan fase kedua. |
| **Room Service & Banquet** | FB | Tipe order F&B baru di luar restoran utama. Memerlukan ekstensi schema dan workflow. |
| **Sistem Pesan FO ↔ HK** | FO + HK | Sistem komunikasi internal antar modul. Bukan fungsi operasional inti. |
| **Role General Manager & Manager** | Auth | MVP membatasi satu role per akun. Role hierarki manajemen ditunda. |
| **Integrasi Online Travel Agent** | FO | Tracking sumber reservasi dengan API eksternal. Cakupan besar di luar MVP. |
| **Print by Article (Akuntansi)** | ACC | Bergantung pada Master Bill. |
| **Activity Log HK (UI)** | HK | Data log tetap tersimpan untuk audit, namun antarmuka penelusuran ditunda. |

---

## C. Perlu Klarifikasi pada Meeting Berikutnya

Pertanyaan yang muncul dari pembahasan tetapi memerlukan keputusan eksplisit sebelum implementasi.

1. **Alur Pemesanan F&B oleh Tamu In-House**
   - Pertanyaan: Apakah tamu memesan F&B melalui resepsionis terlebih dahulu, atau langsung di outlet F&B?
   - Dampak: Menentukan apakah FO atau FB yang menjadi entry point order F&B.

2. **Timing Pembayaran F&B**
   - Pertanyaan: Pembayaran dilakukan langsung setelah memesan, atau diberi pilihan untuk dibebankan ke folio dan dibayar saat Check-Out?
   - Dampak: Workflow pembayaran F&B (saat ini MVP: pilihan tunai atau charge-to-room di akhir order).

3. **Hierarki Role Akses Penuh**
   - Pertanyaan: Apakah role General Manager / Manager perlu akses ke semua modul, atau cukup satu role dengan akses khusus?
   - Dampak: Struktur access control. Jika ya, perlu ekstensi proxy + UI navigasi.

4. **Format Komentar Reservasi**
   - Pertanyaan: Konfirmasi field "komentar atas-bawah" — dua field terpisah (staf vs manajer) atau satu field dengan riwayat edit?
   - Dampak: Schema database (kolom tunggal vs ganda).

5. **Detail Status Vacant Clean Unchecked**
   - Pertanyaan: Konfirmasi alur — siapa yang melakukan inspeksi VCU → VC? Apakah supervisor HK yang sama atau role terpisah?
   - Dampak: Apakah perlu field "inspected_by" pada housekeeping_log.

---

## D. Komitmen Cadence

Pak Tito menyatakan ekspektasi **progress mingguan**. Tim akan menyiapkan demo singkat (15-30 menit) setiap minggu menampilkan fitur baru yang shipped sejak meeting sebelumnya.

| Minggu | Target Demo |
|---|---|
| Minggu 5 (sekarang) | Onboarding tim, mulai modul HK dan integrasi bolt-on FO |
| Minggu 6 | Modul HK selesai + Tipe Reservasi + Tipe Arrangement |
| Minggu 7 | Modul FB selesai + Print GRC + komentar reservasi |
| Minggu 8 | Modul ACC + Night Audit auto-charge, integration testing, demo final |

---

## E. Dokumentasi yang Masih Perlu Disiapkan

Berdasarkan kebutuhan akademik dan masukan Pak Tito:

- [x] ERD — `docs/db_specification_mvp.md`
- [x] Use Case Diagram — `docs/use_case_narrative_mvp.md`
- [ ] **Proses Bisnis** — flowchart proses reservasi → check-in → stay → check-out
- [ ] **Activity Diagram** — UML untuk setiap use case utama

Estimasi: 2-3 jam dengan diagram Mermaid di dokumentasi markdown.

---

## F. Tindak Lanjut Segera

| # | Aksi | Owner | Target |
|---|---|---|---|
| 1 | Distribusi catatan ini ke tim & Pak Tito | [Lead] | Hari ini |
| 2 | Update `docs/feature_list_mvp.md` — bagian MVP + Deferred | [Lead] | Hari ini |
| 3 | Implementasi bolt-on FO (Tipe Reservasi, Arrangement, Komentar, Cetak GRC) | [FO Owner] | 1-2 sesi sebelum HK kickoff |
| 4 | Onboarding teammate HK / FB / ACC | [Lead] | Minggu ini |
| 5 | Draft pertanyaan klarifikasi (Bagian C) untuk dikirim ke Pak Tito | [Lead] | Sebelum meeting berikutnya |

---

*Dokumen ini akan diperbarui setelah meeting berikutnya dengan keputusan terhadap pertanyaan di Bagian C.*
