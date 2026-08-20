# User Manual — ZADD Hotel Management (Remote Images)

---

## Pendahuluan

### Tentang Aplikasi

ZADD Hotel Management adalah aplikasi Property Management System berbasis web untuk membantu operasional hotel. Aplikasi ini mencakup proses Front Office, Housekeeping, Food & Beverage, Accounting, dan Admin dalam satu sistem terpadu.

### Tujuan Manual Book

Manual book ini membantu pengguna memahami langkah dasar penggunaan aplikasi sesuai role masing-masing. Dokumen ini juga menjadi panduan singkat saat praktik operasional hotel.

### Audiens

- Front Office
- Housekeeping
- Supervisor Housekeeping
- Food & Beverage
- Akuntansi
- Admin

### Cara Login

1. Buka halaman login ZADD Hotel Management.

   ![Halaman login ZADD Hotel Management](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/login-01-page.png)

   Masukkan username dan password sesuai role. Untuk praktik, gunakan akun demo yang disediakan oleh pengajar atau tim pengembang.

2. Setelah login berhasil, sistem menampilkan halaman sesuai role pengguna.

### Instalasi Aplikasi (PWA)

Aplikasi memiliki web app manifest dan ikon, sehingga dapat dipasang ke layar utama sebagai ikon aplikasi untuk akses cepat. Aplikasi belum memakai service worker, jadi gunakan koneksi internet saat membuka sistem.

1. Android (Chrome): buka URL aplikasi, pilih menu browser, lalu pilih **Add to Home screen** atau **Install app**.

   Konfirmasi pemasangan agar ikon ZADD Hotel Management muncul di layar utama.

2. iOS (Safari): buka URL aplikasi, pilih **Share**, lalu pilih **Add to Home Screen**.

   Konfirmasi nama aplikasi agar ikon muncul di Home Screen.

## Front Office

Front Office menangani reservasi, check-in, folio tamu, pembayaran akhir, dan check-out.

### 1. Buat Reservasi

1. Klik **Reservasi**, lalu pilih **Tambah Reservasi**.

   ![Form reservasi baru](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-02-reservation-form.png)

   Isi data tamu, tanggal Kedatangan/Keberangkatan, tipe kamar, kamar, jumlah tamu, dan catatan. Sistem menetapkan tarif per malam dan deposit wajib sebesar tarif malam pertama; kedua nilai tersebut ditampilkan sebagai hasil perhitungan server dan tidak dapat diedit.

2. Klik **Simpan Reservasi**.

   ![Hasil reservasi tersimpan](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-03-reservation-result.png)

   Reservasi baru muncul di daftar reservasi dengan status **CONFIRMED**. Front Office masuk melalui menu **Reservasi**, yang membuka Kalender/List sesuai preferensi terakhir. Klik baris reservasi untuk membuka detail dan melanjutkan check-in.

#### Alternatif: buat reservasi lewat Tape Chart

1. Buka menu **Reservasi**, lalu pilih tampilan **Kalender**.

   ![Tape Chart Front Office](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-12-tape-chart.png)

   Tape Chart menampilkan kamar di sisi kiri dan tanggal di bagian atas. Klik cell kamar dan tanggal yang tersedia untuk membuat reservasi.

2. Sistem membuka form reservasi dari cell yang dipilih.

   ![Form reservasi dari Tape Chart](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-13-tape-chart-reservation-form.png)

   Kamar dan tanggal sudah mengikuti pilihan pada Tape Chart. Lengkapi data tamu, lalu simpan reservasi seperti alur biasa.

### 2. Proses Check-in

1. Pada atau setelah tanggal Kedatangan, buka detail reservasi dan kumpulkan deposit wajib sebelum membuka GRC.

   Sistem membuat atau memakai kembali folio yang sudah ada, mencatat tepat satu pembayaran **DEPOSIT** yang sesuai, lalu mengubah status deposit dari **PENDING** menjadi **COLLECTED** dalam satu proses. Pengulangan proses tidak menggandakan pembayaran. Selama deposit masih **PENDING**, check-in tetap terkunci tanpa pilihan override.

2. Pastikan reservasi berstatus **CONFIRMED** dan deposit berstatus **COLLECTED**, lalu klik **Check In Guest**.

   ![Form check-in Front Office](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-04-check-in-form.png)

   Check-in hanya dapat dilanjutkan jika folio sudah tersedia dan memiliki pembayaran **DEPOSIT** yang sesuai. Pastikan kamar, data tamu, dan GRC sudah benar sebelum melanjutkan.

3. Minta tamu menandatangani area **Tanda Tangan Tamu**, lalu centang konfirmasi kedatangan.

   ![Tanda tangan digital saat check-in](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-05-check-in-signature.png)

   Setelah tanda tangan terekam, klik **Konfirmasi Check-In**. Proses check-in menggunakan folio yang sudah tersedia dan tidak mengumpulkan deposit atau membuat folio baru.

### 3. Kelola Guest Folio

1. Buka Guest Folio setelah check-in selesai.

   ![Guest Folio terbuka](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-06-folio-open.png)

   Folio menampilkan daftar biaya, pembayaran, dan tombol untuk menambah charge atau mencatat pembayaran.

2. Klik **Tambah Charge** jika ada biaya tambahan.

   ![Dialog tambah charge folio](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-07-add-charge-dialog.png)

   Pilih artikel, isi deskripsi bila perlu, periksa jumlah dan harga, lalu klik **Post Charge**.

3. Periksa folio setelah charge diposting.

   ![Charge berhasil masuk ke folio](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-08-folio-charge-posted.png)

   Biaya yang sudah diposting muncul pada tabel **Biaya** dan menambah saldo folio.

### 4. Proses Check-out

1. Klik **Lanjut ke Check-Out** dari halaman folio.

   ![Balance gate saat check-out](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-09-checkout-balance-gate.png)

   Jika masih ada **Saldo Terutang**, tombol konfirmasi check-out terkunci. Catat pembayaran akhir terlebih dahulu.

2. Pada bagian **Pembayaran Akhir**, periksa jumlah pembayaran dan klik **Record Payment & Continue**.

   ![Pembayaran akhir tercatat](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-10-checkout-payment-recorded.png)

   Setelah saldo rounded whole-IDR menjadi nol atau kredit, sistem membuka langkah aksi check-out; jika kredit, kembalikan kelebihan pembayaran kepada tamu.

3. Pastikan opsi setelah check-out sudah dicentang, lalu klik **Complete Check-Out**.

   ![Check-out berhasil](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-11-checkout-success.png)

   Check-out selesai. Sistem menyediakan tautan **Unduh Tagihan** dan **Back to Tape Chart**.

### 5. Kelola Lost & Found

1. Buka menu **Lost & Found**, lalu cari barang yang ditanyakan tamu.

   ![Pencarian Lost and Found Front Office](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-14-lost-found-search.png)

   Front Office dapat mencari barang berdasarkan deskripsi, kamar, dan status. Barang temuan dicatat oleh Housekeeping; lihat bagian Housekeeping.

2. Isi catatan penyelesaian untuk barang yang akan dikembalikan.

   ![Form pengembalian Lost and Found](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-15-lost-found-return-form.png)

   Catatan membantu hotel mengetahui kepada siapa barang dikembalikan.

3. Klik **Tandai dikembalikan**.

   ![Lost and Found dikembalikan](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fo-16-lost-found-returned.png)

   Status berubah menjadi **Dikembalikan** dan catatan penyelesaian tampil di daftar.

## Housekeeping

Housekeeping membersihkan kamar yang ditugaskan dan mencatat barang temuan.

### 1. Melihat Kamar Saya

1. Buka menu **Kamar Saya**.

   ![Kamar Saya Housekeeping](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/hk-01-my-rooms.png)

   Daftar ini menampilkan kamar yang menjadi tugas housekeeper. Prioritaskan kamar dengan status kotor atau siap dibersihkan.

### 2. Membuka Kamar dan Mulai Bersihkan

1. Klik salah satu kamar dari daftar tugas.

   ![Detail kamar Housekeeping](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/hk-02-room-detail.png)

   Detail kamar menampilkan status, catatan, dan tombol untuk memulai pekerjaan.

2. Klik **Mulai Bersihkan**.

   ![Timer pembersihan berjalan](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/hk-03-cleaning-timer.png)

   Sistem mulai menghitung durasi pembersihan. Ikuti checklist sebelum menyelesaikan pekerjaan.

### 3. Selesai Bersihkan

1. Lengkapi checklist, lalu klik **Selesai Bersihkan**.

   ![Pembersihan selesai](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/hk-04-cleaning-finished.png)

   Kamar berpindah ke status menunggu inspeksi. Supervisor Housekeeping dapat memeriksa kamar dari inbox VCU.

### 4. Catat Lost & Found

1. Buka menu **Lost & Found**, lalu klik **Catat Barang Temuan**.

   ![Form Lost and Found](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/hk-05-found-item-form.png)

   Isi nama barang, lokasi, kamar, dan deskripsi singkat barang temuan.

2. Simpan barang temuan.

   ![Daftar Lost and Found](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/hk-06-lost-found-list.png)

   Barang muncul di daftar Lost & Found agar dapat ditindaklanjuti oleh tim hotel.

## Supervisor Housekeeping

Supervisor Housekeeping mengatur penugasan kamar, melakukan inspeksi, dan mencetak daily list.

### 1. Melihat Dashboard Supervisor

1. Buka dashboard **Housekeeping Supervisor**.

   ![Dashboard Supervisor Housekeeping](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/sup-01-dashboard.png)

   Dashboard menampilkan KPI kamar, forecast, dan ringkasan pekerjaan harian.

### 2. Assign Rooms

1. Buka bagian **Assignment**.

   ![Bulk assignment Housekeeping](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/sup-02-bulk-assignment.png)

   Pilih kamar dan housekeeper, lalu jalankan bulk assignment. Kamar yang dipilih masuk ke worklist housekeeper.

### 3. Inspeksi Kamar VCU

1. Buka kamar yang menunggu inspeksi.

   ![Form inspeksi kamar](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/sup-03-inspection-room.png)

   Periksa kondisi kamar dan isi checklist inspeksi sebelum memberi keputusan.

2. Klik **Pass Inspection** jika kamar sudah layak jual.

   ![Inspeksi kamar berhasil](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/sup-04-inspection-passed.png)

   Status kamar berubah menjadi **VC**. Kamar kembali tersedia untuk Front Office.

### 4. Cetak Daily List

1. Buka **Daily List**, lalu pilih print atau unduh PDF.

   ![PDF Daily List Housekeeping](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/sup-05-daily-list-pdf.png)

   Daily List menampilkan ringkasan kamar untuk operasional Housekeeping pada tanggal berjalan.

## Food & Beverage

Food & Beverage menangani dine-in, billing, pembayaran, dan room service.

### 1. Melihat Floor Plan

1. Buka dashboard **F&B**.

   ![Floor plan F&B](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-01-floor-plan.png)

   Floor plan menampilkan status meja. Pilih meja yang tersedia untuk membuat order dine-in.

### 2. Buat Dine-in Order

1. Klik meja, lalu konfirmasi pembuatan order.

   ![Konfirmasi order dine-in](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-02-dine-in-confirm.png)

   Sistem menyiapkan order baru untuk meja yang dipilih.

2. Tambahkan menu ke order.

   ![Item order dine-in](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-03-dine-in-order-items.png)

   Pilih menu dan jumlah item. Item yang ditambahkan muncul pada daftar order.

3. Klik **Bill** untuk menutup order.

   ![Bill dine-in](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-04-dine-in-bill.png)

   Periksa total bill sebelum memproses pembayaran.

4. Pilih metode pembayaran dan klik **Process Payment**.

   ![Pembayaran dine-in](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-05-dine-in-payment.png)

   Sistem mencatat pembayaran sesuai metode yang dipilih.

5. Pastikan pembayaran berhasil.

   ![Pembayaran dine-in berhasil](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-06-dine-in-payment-success.png)

   Status bill menjadi paid dan meja dapat digunakan kembali.

### 3. Buat Room Service Order

1. Buka **New Room Service Order**, lalu masukkan nomor kamar tamu in-house.

   ![Lookup room service](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-07-room-service-lookup.png)

   Sistem menampilkan tamu yang sedang in-house untuk kamar tersebut.

2. Tambahkan item room service.

   ![Item order room service](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-08-room-service-order-items.png)

   Pilih menu dan jumlah item seperti order dine-in.

3. Pilih **Charge to Room**.

   ![Charge to room](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-09-room-service-charge-room.png)

   Sistem mengirim total order ke Guest Folio kamar tamu.

4. Pastikan room service berhasil diproses.

   ![Room service berhasil](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/fb-10-room-service-success.png)

   Order selesai dan charge sudah terhubung ke folio tamu.

## Akuntansi

Akuntansi menjalankan Night Audit dan melihat laporan harian hotel.

### 1. Melihat Area Akuntansi

1. Buka dashboard **Accounting**.

   ![Dashboard Akuntansi](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/acc-01-dashboard.png)

   Dashboard menampilkan status business date, pendapatan, dan akses ke Night Audit.

### 2. Run Night Audit

1. Buka menu **Night Audit**.

   ![Night Audit sebelum dijalankan](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/acc-02-night-audit-prerun.png)

   Periksa tanggal audit, pendapatan, pembayaran, dan transaksi terbuka sebelum menjalankan audit.

2. Klik **Run Night Audit** dan konfirmasi.

   ![Konfirmasi Night Audit](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/acc-03-night-audit-confirm.png)

   Sistem meminta konfirmasi agar audit tidak dijalankan tanpa sengaja.

3. Tunggu sampai audit selesai.

   ![Hasil Night Audit](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/acc-04-night-audit-result.png)

   Setelah selesai, sistem menampilkan ringkasan audit dan tautan laporan.

### 3. Lihat Night Report

1. Buka laporan hasil Night Audit.

   ![Night Report Akuntansi](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/acc-05-night-report.png)

   Night Report dapat dilihat untuk rekap pendapatan, pembayaran, dan saldo operasional harian.

## Admin

Admin mengelola master data, pengguna, dan pengaturan aplikasi tanpa akses ke modul Housekeeping.

### 1. Kelola Room Types dan Rooms

1. Buka menu **Rooms** pada Admin.

   ![Master data room types](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/admin-01-room-types.png)

   Tab Room Types digunakan untuk melihat dan mengelola tipe kamar hotel.

2. Pilih tab **Daftar Kamar**.

   ![Master data rooms](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/admin-02-rooms.png)

   Daftar Kamar menampilkan nomor kamar, tipe kamar, lantai, status inventori, dan status housekeeping.

### 2. Kelola Articles dan Menu

1. Buka menu **Articles**.

   ![Master data articles](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/admin-03-articles.png)

   Articles digunakan untuk item charge hotel seperti laundry, minibar, atau layanan tambahan.

2. Buka menu **Menu**.

   ![Master data menu F&B](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/admin-04-menu.png)

   Menu digunakan untuk mengelola item makanan dan minuman yang dijual oleh F&B.

### 3. Kelola Users

1. Buka menu **Users**.

   ![Manajemen users Admin](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/admin-05-users.png)

   Admin dapat melihat user demo dan role pengguna. Bagian Admin tidak menampilkan akses ke layar Housekeeping.

### 4. Kelola Meja

1. Buka menu **Meja** pada Admin.

   ![Daftar meja restoran](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/admin-06-tables-list.png)

   Daftar Meja menampilkan nomor meja, kapasitas, lokasi, status, order aktif, dan catatan. Gunakan **Tambah Meja** atau aksi baris untuk menambah dan mengubah kapasitas, lokasi/area, status, dan catatan meja.

2. Pilih tab **Layout**.

   ![Layout meja restoran](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/admin-07-tables-layout.png)

   Layout menampilkan editor floor plan desktop untuk memosisikan meja dengan drag pada canvas. Susunan ini mencerminkan layout fisik ruangan restoran sehingga F&B melihat posisi meja yang sama di floor plan.

### 5. Pengaturan Hotel

1. Buka menu **Pengaturan** pada Admin.

   ![Pengaturan Hotel Admin](https://raw.githubusercontent.com/nurmareko/zadd-hotel-pms/main/docs/user-guide/images/admin-08-settings.png)

   Pengaturan Hotel menyediakan nama hotel, mata uang, alamat, PPN, service charge, dan cut-off Night Audit. Panel Preview menampilkan contoh perhitungan F&B sebelum perubahan disimpan.
