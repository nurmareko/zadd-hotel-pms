# 3.1.3 Fitur Sistem (MVP)

Subbab ini memaparkan fitur-fitur yang akan diimplementasikan pada versi *Minimum Viable Product* (MVP) Sistem Manajemen Properti Hotel. Fitur dikelompokkan berdasarkan modul operasional yang mencerminkan kebutuhan praktikum mahasiswa Fakultas Hospitality. Di akhir subbab dicantumkan pula daftar fitur yang ditunda untuk pengembangan lanjutan, sebagai justifikasi pembatasan cakupan rilis awal.

## 3.1.3.1 Fitur MVP

### Modul Front Office

Modul Front Office mendukung siklus hidup tamu mulai dari pemesanan hingga pembayaran akhir. Fitur-fitur yang diimplementasikan:

- **Pengelolaan reservasi** — pembuatan, pengeditan, dan pembatalan reservasi dengan input data tamu, tanggal menginap, tipe kamar, dan tarif.
- **Tape Chart** — visualisasi okupansi kamar dalam bentuk grid kamar × tanggal dengan indikasi warna status, berfungsi sebagai landasan utama pekerjaan resepsionis.
- **Proses check-in** — penetapan kamar aktual kepada tamu yang datang, pengisian *Guest Registration Card* secara inline, dan pembuatan folio tamu secara otomatis.
- **Pengelolaan Guest Folio** — pencatatan *line item* charge, penambahan *manual charge* oleh petugas, serta pencatatan pembayaran (tunai, transfer, kartu) terhadap folio.
- **Proses check-out** — verifikasi saldo folio (*zero-balance verification*), pemrosesan pembayaran akhir, dan pembaruan otomatis status kamar menjadi *Vacant Dirty*.
- **Cetak bill** — bill tamu dapat diunduh dalam format PDF untuk keperluan pengarsipan atau pencetakan fisik oleh petugas.

### Modul Housekeeping

Modul Housekeeping dirancang *mobile-first* agar dapat digunakan oleh petugas yang bergerak di koridor kamar. Fitur-fitur yang diimplementasikan:

- **Dashboard status kamar** — pemantauan status seluruh kamar dengan indikator warna (Vacant Clean, Vacant Dirty, Occupied Clean, Occupied Dirty, Out of Order) dan filter cepat per lantai.
- **Detail kamar** — tampilan rinci status kamar, tamu aktif (jika ada), dan riwayat pembaruan terakhir.
- **Pembaruan status kamar** — aksi satu ketuk untuk mengubah status kamar, disertai catatan opsional. Pembaruan tersinkron secara waktu-nyata ke Tape Chart modul Front Office.

### Modul Food & Beverage

Modul F&B mendukung operasi *point of sales* restoran hotel. Fitur-fitur yang diimplementasikan:

- **Pemilihan meja** — tampilan grid meja beserta statusnya, menjadi titik masuk pembuatan order.
- **Captain Order** — formulir pencatatan pesanan oleh *waiter* secara cepat, meliputi pemilihan menu, kuantitas, dan catatan dapur.
- **Pemrosesan bill F&B** — perhitungan otomatis subtotal, *service charge*, dan pajak sesuai pengaturan hotel.
- **Pembayaran F&B** — mendukung pembayaran tunai maupun *charge to room* (membebankan tagihan F&B ke folio tamu yang sedang menginap), termasuk pemilihan tamu tujuan melalui nomor kamar.
- **Cetak struk** — struk F&B dapat diunduh dalam format PDF.

### Modul Akuntansi

Modul Akuntansi melayani proses *daily close* dan pelaporan. Fitur-fitur yang diimplementasikan:

- **Dashboard akuntansi** — ringkasan status *night audit* hari berjalan dan indikator posting yang belum diproses.
- **Night Audit** — *checklist* prasyarat sebelum audit, eksekusi proses *daily close*, dan penandaan tanggal bisnis baru.
- **Night Report** — laporan hasil *night audit* yang merangkum *revenue*, tingkat hunian, dan daftar tamu dalam satu dokumen terkonsolidasi. Laporan dapat diekspor dalam format PDF.

### Modul Admin

Modul Admin diakses oleh pengelola sistem (dosen pembimbing praktikum) untuk mengelola data master. Fitur-fitur yang diimplementasikan:

- **Pengelolaan pengguna** — pembuatan, pengeditan, dan penonaktifan akun pengguna beserta penetapan *role*.
- **Pengelolaan kamar dan tipe kamar** — pendefinisian tipe kamar (nama, kapasitas, tarif dasar) dan pendaftaran kamar individual.
- **Pengelolaan article (kode charge)** — daftar kode *charge* yang digunakan untuk posting *line item* folio.
- **Pengelolaan menu F&B** — CRUD *menu item* restoran beserta kategorinya.
- **Pengaturan hotel** — konfigurasi nama hotel, persentase pajak, *service charge*, dan waktu *cut-off night audit*.

## 3.1.3.2 Fitur Pengembangan Lanjutan

Beberapa fitur telah diidentifikasi pada tahap pengumpulan kebutuhan namun ditunda pada rilis MVP ini dengan pertimbangan kelayakan waktu pengembangan dan kompleksitas yang tidak sebanding dengan nilai pembelajaran pada praktikum awal. Fitur-fitur berikut direkomendasikan untuk dikembangkan pada rilis berikutnya:

| Fitur | Modul | Alasan Penundaan |
|---|---|---|
| Master Bill (group billing) | Front Office | Digunakan untuk reservasi rombongan korporat, tidak esensial untuk praktikum dasar |
| Multi-outlet F&B | F&B | Praktikum awal cukup menggunakan satu *outlet* (hotel restaurant) |
| Rate Plan dinamis dengan validitas tanggal dan segment | Front Office | Pemesanan MVP menggunakan tarif tetap per tipe kamar |
| Multi-role per akun | Autentikasi | Setiap akun praktikum dibatasi pada satu *role* untuk menyederhanakan *access control* |
| Revenue Distribution Report terpisah | Akuntansi | Informasi sudah tercakup dalam *Night Report* terkonsolidasi |
| Guest Segment Statistics | Akuntansi | Mensyaratkan entitas *Segment* yang belum diperlukan |
| Guest List Report terpisah | Akuntansi | Informasi sudah tercakup dalam *Night Report* terkonsolidasi |
| Manual Bill sebagai dokumen terpisah | Akuntansi | Pada MVP, *charge* *walk-in* dicatat sebagai *folio line item* |
| Print by Article | Akuntansi | Tergantung pada fitur *Manual Bill* |
| Activity Log Housekeeping (UI) | Housekeeping | Data log tetap tersimpan untuk audit, namun tanpa antarmuka penelusuran |
| Guest Database lintas-stay | Front Office | Pada MVP, data tamu dikelola per reservasi |
| Dashboard monitoring Admin lintas-modul | Admin | Admin dapat mengakses tiap modul secara manual melalui akun ber-role gabungan |

Pembatasan cakupan ini memungkinkan tim pengembang menyelesaikan seluruh alur operasional inti (reservasi → *check-in* → *stay* → *charge* → *check-out* → *daily close*) dalam kualitas produksi, dibandingkan menyediakan banyak fitur parsial yang tidak dapat digunakan secara utuh dalam praktikum.
