# User Manual — ZADD Hotel Management

---

## Pendahuluan

### Tentang Aplikasi

ZADD Hotel Management adalah aplikasi Property Management System berbasis web untuk membantu operasional hotel. Aplikasi ini mencakup proses Front Office, Housekeeping, Food & Beverage, Accounting, dan Admin dalam satu sistem terpadu.

### Tujuan Manual Book

Manual book ini membantu pengguna memahami langkah dasar penggunaan aplikasi sesuai role masing-masing. Dokumen ini juga menjadi panduan singkat saat praktik operasional hotel.

### Audiens

- Front Office
- Housekeeping
- Food & Beverage
- Akuntansi
- Admin

### Cara Login

1. Buka halaman login ZADD Hotel Management.

   ![Halaman login ZADD Hotel Management](images/login-01-page.png)

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

   ![Form reservasi baru](images/fo-02-reservation-form.png)

   Isi data tamu, tanggal Kedatangan/Keberangkatan, tipe kamar, kamar, jumlah tamu, dan catatan. Sistem menetapkan tarif per malam dan deposit wajib sebesar tarif malam pertama; kedua nilai tersebut ditampilkan sebagai hasil perhitungan server dan tidak dapat diedit.

2. Klik **Simpan Reservasi**.

   ![Hasil reservasi tersimpan](images/fo-03-reservation-result.png)

   Reservasi baru muncul di daftar reservasi dengan status **CONFIRMED**. Front Office masuk melalui menu **Reservasi**, yang membuka Kalender/List sesuai preferensi terakhir. Klik baris reservasi untuk membuka detail dan melanjutkan check-in.

#### Alternatif: buat reservasi lewat Tape Chart

1. Buka menu **Reservasi**, lalu pilih tampilan **Kalender**.

   ![Tape Chart Front Office](images/fo-12-tape-chart.png)

   Tape Chart menampilkan kamar di sisi kiri dan tanggal di bagian atas. Klik cell kamar dan tanggal yang tersedia untuk membuat reservasi.

2. Sistem membuka form reservasi dari cell yang dipilih.

   ![Form reservasi dari Tape Chart](images/fo-13-tape-chart-reservation-form.png)

   Kamar dan tanggal sudah mengikuti pilihan pada Tape Chart. Lengkapi data tamu, lalu simpan reservasi seperti alur biasa.

### 2. Proses Check-in

1. Pada atau setelah tanggal Kedatangan, buka detail reservasi dan kumpulkan deposit wajib sebelum membuka GRC.

   Sistem membuat atau memakai kembali folio yang sudah ada, mencatat tepat satu pembayaran **DEPOSIT** yang sesuai, lalu mengubah status deposit dari **PENDING** menjadi **COLLECTED** dalam satu proses. Pengulangan proses tidak menggandakan pembayaran. Selama deposit masih **PENDING**, check-in tetap terkunci tanpa pilihan override.

2. Pastikan reservasi berstatus **CONFIRMED** dan deposit berstatus **COLLECTED**, lalu klik **Check In Guest**.

   ![Form check-in Front Office](images/fo-04-check-in-form.png)

   Check-in hanya dapat dilanjutkan jika folio sudah tersedia dan memiliki pembayaran **DEPOSIT** yang sesuai. Pastikan kamar, data tamu, dan GRC sudah benar sebelum melanjutkan.

3. Minta tamu menandatangani area **Tanda Tangan Tamu**, lalu centang konfirmasi kedatangan.

   ![Tanda tangan digital saat check-in](images/fo-05-check-in-signature.png)

   Setelah tanda tangan terekam, klik **Konfirmasi Check-In**. Proses check-in menggunakan folio yang sudah tersedia dan tidak mengumpulkan deposit atau membuat folio baru.

### 3. Kelola Guest Folio

1. Buka Guest Folio setelah check-in selesai.

   ![Guest Folio terbuka](images/fo-06-folio-open.png)

   Folio menampilkan daftar biaya, pembayaran, dan tombol untuk menambah charge atau mencatat pembayaran.

2. Klik **Tambah Charge** jika ada biaya tambahan.

   ![Dialog tambah charge folio](images/fo-07-add-charge-dialog.png)

   Pilih artikel, isi deskripsi bila perlu, periksa jumlah dan harga, lalu klik **Post Charge**.

3. Periksa folio setelah charge diposting.

   ![Charge berhasil masuk ke folio](images/fo-08-folio-charge-posted.png)

   Biaya yang sudah diposting muncul pada tabel **Biaya** dan menambah saldo folio.

### 4. Proses Check-out

1. Klik **Lanjut ke Check-Out** dari halaman folio.

   ![Balance gate saat check-out](images/fo-09-checkout-balance-gate.png)

   Jika masih ada **Saldo Terutang**, tombol konfirmasi check-out terkunci. Catat pembayaran akhir terlebih dahulu.

2. Pada bagian **Pembayaran Akhir**, periksa jumlah pembayaran dan klik **Record Payment & Continue**.

   ![Pembayaran akhir tercatat](images/fo-10-checkout-payment-recorded.png)

   Setelah saldo rounded whole-IDR menjadi nol atau kredit, sistem membuka langkah aksi check-out; jika kredit, kembalikan kelebihan pembayaran kepada tamu.

3. Pastikan opsi setelah check-out sudah dicentang, lalu klik **Complete Check-Out**.

   ![Check-out berhasil](images/fo-11-checkout-success.png)

   Check-out selesai. Sistem menyediakan tautan **Unduh Tagihan** dan **Back to Tape Chart**.

### 5. Kelola Lost & Found

1. Buka menu **Lost & Found**, lalu cari barang yang ditanyakan tamu.

   ![Pencarian Lost and Found Front Office](images/fo-14-lost-found-search.png)

   Front Office dapat mencari barang berdasarkan deskripsi, kamar, dan status. Barang temuan dicatat oleh Housekeeping; lihat bagian Housekeeping.

2. Isi catatan penyelesaian untuk barang yang akan dikembalikan.

   ![Form pengembalian Lost and Found](images/fo-15-lost-found-return-form.png)

   Catatan membantu hotel mengetahui kepada siapa barang dikembalikan.

3. Klik **Tandai dikembalikan**.

   ![Lost and Found dikembalikan](images/fo-16-lost-found-returned.png)

   Status berubah menjadi **Dikembalikan** dan catatan penyelesaian tampil di daftar.

## Housekeeping

Housekeeping membersihkan kamar yang ditugaskan dan mencatat barang temuan.

### 1. Melihat Kamar Saya

1. Buka ruang kerja ponsel di `/app/hk/mobile` untuk melihat kamar yang ditugaskan kepada Anda.

   ![Kamar Saya Housekeeping](images/hk-01-my-rooms.png)

   Daftar ini menampilkan kamar yang menjadi tugas housekeeper. Prioritaskan kamar dengan status kotor atau siap dibersihkan.

### 2. Membuka Kamar dan Mulai Bersihkan

1. Klik salah satu kamar dari daftar tugas.

   ![Detail kamar Housekeeping](images/hk-02-room-detail.png)

   Detail kamar menampilkan status, catatan, dan tombol untuk memulai pekerjaan.

2. Klik **Mulai Bersihkan**.

   ![Timer pembersihan berjalan](images/hk-03-cleaning-timer.png)

   Sistem mulai menghitung durasi pembersihan. Ikuti checklist sebelum menyelesaikan pekerjaan.

### 3. Selesai Bersihkan

1. Lengkapi checklist, lalu klik **Selesai Bersihkan**.

   ![Pembersihan selesai](images/hk-04-cleaning-finished.png)

   Kamar kosong berpindah dari VD ke VCU untuk menunggu inspeksi; kamar berpenghuni berpindah dari OD ke OC. Semua petugas HK dan Admin dapat memeriksa kamar VCU dari papan kamar.

### 4. Catat Lost & Found

1. Buka menu **Lost & Found**, lalu klik **Catat Barang Temuan**.

   ![Form Lost and Found](images/hk-05-found-item-form.png)

   Isi nama barang, lokasi, kamar, dan deskripsi singkat barang temuan.

2. Simpan barang temuan.

   ![Daftar Lost and Found](images/hk-06-lost-found-list.png)

   Barang muncul di daftar Lost & Found agar dapat ditindaklanjuti oleh tim hotel.

## Penugasan dan Inspeksi Housekeeping

Semua petugas HK dan Admin memiliki akses operasional Housekeeping yang sama, tanpa tingkat supervisor. Memulai dan menyelesaikan pembersihan tetap hanya dapat dilakukan oleh petugas yang ditugaskan; riwayat petugas, inspeksi, dan perubahan status tetap disimpan.

### 1. Melihat Papan Kamar

1. Buka papan kamar di `/app/hk/rooms`. `/app/hk` mengarah ke halaman ini. Alamat lama `/app/hk/supervisor` tetap dialihkan secara permanen (HTTP 308, parameter pencarian dipertahankan), dan `/app/hk/list` tetap menjadi pengalihan kompatibilitas ke papan kamar; keduanya tidak dijadwalkan untuk dihapus.

   ![Tampilan historis dashboard supervisor Housekeeping](images/sup-01-dashboard.png)

   Gambar di bagian ini merupakan dokumentasi tampilan lama, bukan bukti adanya tingkat akses supervisor saat ini. Gunakan papan kamar untuk melihat status, penugasan, daftar inspeksi VCU, dan mencetak daftar harian.

### 2. Menugaskan Kamar

1. Buka bagian penugasan di papan kamar.

   ![Bulk assignment Housekeeping](images/sup-02-bulk-assignment.png)

   Pilih kamar dan petugas, lalu jalankan penugasan massal. Kamar yang dipilih masuk ke daftar tugas petugas.

### 3. Inspeksi Kamar VCU

1. Buka kamar yang menunggu inspeksi.

   ![Form inspeksi kamar](images/sup-03-inspection-room.png)

   Periksa kondisi kamar dan isi checklist inspeksi sebelum memberi keputusan.

2. Setujui inspeksi jika kamar sudah layak jual.

   ![Inspeksi kamar berhasil](images/sup-04-inspection-passed.png)

   Status kamar berubah menjadi **VC**. Kamar kembali tersedia untuk Front Office.

### 4. Cetak Daftar Harian

1. Buka lembar kerja di `/app/hk/rooms`, lalu cetak daftar harian.

   ![PDF Daily List Housekeeping](images/sup-05-daily-list-pdf.png)

   Daily List menampilkan ringkasan kamar untuk operasional Housekeeping pada tanggal berjalan.

## Food & Beverage

Modul Food & Beverage (F&B) digunakan untuk memantau penjualan, mengelola pesanan makan di tempat dan layanan kamar, memproses pembayaran, mengoordinasikan pekerjaan dapur, serta mencatat persediaan bahan baku. Gunakan prosedur berikut sesuai tugas operasional Anda.

> **Catatan gambar:** Tangkapan layar bagian ini menggunakan data demonstrasi terisolasi, bukan transaksi nyata.

### 1. Dasbor Operasional & Manajerial F&B

1. Buka `/app/fb`. Halaman awal menampilkan **Dasbor F&B**.

   ![Dasbor F&B](images/fb-01-dashboard.png)

2. Pilih tanggal melalui **Tanggal laporan (WIB)**. Laporan dimuat otomatis setelah tanggal berubah; tidak diperlukan tombol penerapan. Tanpa pilihan tanggal yang valid, sistem menggunakan tanggal hari ini dalam WIB.

3. Periksa enam indikator ringkasan berikut sebelum meninjau rincian transaksi.

   | Indikator | Cara membaca |
   | --- | --- |
   | **Penjualan Kotor** | Jumlah total tersimpan dari tagihan yang ditutup pada tanggal terpilih, termasuk komponen biaya layanan dan pajak dalam total tagihan; bukan hanya subtotal menu. |
   | **Rata-rata Tagihan** | Penjualan Kotor dibagi jumlah tagihan yang ditutup pada tanggal terpilih. |
   | **Tamu** | Jumlah tamu yang tercatat pada tagihan tersebut, bukan jumlah pengunjung unik. Pembayaran terpisah dapat menghitung rombongan yang sama lebih dari sekali. |
   | **Tagihan Terbuka** | Jumlah tagihan yang dibuka pada tanggal terpilih dan masih terbuka atau sudah ditagihkan tetapi belum selesai saat laporan dilihat. |
   | **Tagihan Cuma-Cuma** | Nilai sementara 0 karena pencatatan kategori ini belum didukung oleh skema data. Jangan menafsirkannya sebagai bukti tidak adanya transaksi cuma-cuma. |
   | **Waktu Masak Dapur** | Rata-rata durasi dari mulai memasak hingga selesai untuk pesanan yang selesai dimasak pada tanggal terpilih, tidak termasuk pesanan Void. Tanda `—` berarti belum tersedia durasi yang dapat dihitung. |

4. Tinjau **Penjualan per Tipe Layanan** untuk membandingkan **Dine In** dan **Room Service**, serta **Penjualan per Metode Pembayaran** untuk melihat **Tunai**, **Transfer**, **Kartu**, dan **Tagih ke Kamar**. Keduanya menggunakan tagihan yang ditutup pada tanggal laporan. Tagihan yang dibebankan ke kamar masuk dalam laporan ini; hal tersebut tidak berarti folio hotel sudah dilunasi.

5. Periksa **Tagihan Terbuka Aktif** untuk melihat nomor tagihan, lokasi, jumlah tamu, waktu pembukaan, durasi, dan total. Daftar ini bukan rekaman keadaan pada akhir tanggal lampau: hanya tagihan yang dibuka pada tanggal pilihan dan masih aktif sekarang yang ditampilkan. Durasi dihitung hingga saat laporan dimuat. Gunakan **Menu Terlaris** untuk meninjau jumlah item dan penjualan menu dari tagihan yang telah ditutup.

6. Tinjau panel pemeriksaan transaksi dengan memperhatikan batas pencatatannya.

   - **Tagihan Cuma-Cuma** belum memiliki pencatatan yang didukung; nilai 0 bukan konfirmasi bahwa tidak ada transaksi tersebut.
   - **Item Dibatalkan (0)** bukan riwayat penghapusan. Item dihapus secara permanen dan riwayat pembatalannya tidak disimpan; angka 0 bukan bukti tidak adanya penghapusan.
   - **Pesanan Dibatalkan** menampilkan pesanan Void berdasarkan waktu pembatalannya pada tanggal terpilih. Kolom yang tersedia adalah tagihan, lokasi, total, dan waktu pembatalan; panel ini tidak menampilkan alasan atau nama operator.

7. Pilih **Denah Meja** untuk melihat kondisi meja atau **Daftar Pesanan** untuk meninjau pesanan operasional. Kedua tab tersebut memiliki ringkasan empat indikator tersendiri, bukan enam indikator Dasbor F&B. Perpindahan tab tidak mempertahankan tanggal laporan; pilih kembali tanggal jika kembali ke dasbor untuk memeriksa hari tertentu.

8. Klik **Buka POS** untuk melanjutkan ke pengelolaan pesanan dan pembayaran.

### 2. Restaurant POS

Buka `/app/fb/pos` untuk menggunakan **POS Restoran**. Layar ini memuat pilihan layanan, tagihan aktif, meja, daftar menu, dan rincian pesanan. Pilih pesanan yang benar sebelum menambahkan item atau menerima pembayaran.

![Restaurant POS](images/fb-02-pos-main.png)

#### Membuat pesanan makan di tempat (Dine In)

1. Pilih **Makan di Tempat**, lalu klik **[F2] Pesanan Baru**. Anda juga dapat memilih meja yang tersedia dari panel meja untuk membuka dialog pembuatan pesanan.
2. Pada dialog **Pesanan Baru**, pilih **Meja**. Pilihan mencakup meja tersedia atau dipesan yang belum memiliki pesanan aktif; meja yang sedang digunakan tidak dapat dipakai untuk membuat pesanan baru melalui pilihan ini.
3. Isi **Jumlah tamu** dengan bilangan bulat minimal 1, maksimal 99, dan tidak melebihi kapasitas meja.
4. Klik **Buat Pesanan**. Sistem membuat pesanan untuk meja tersebut. Jika meja telah digunakan operator lain, muat ulang data dan pilih pesanan atau meja yang sesuai; jangan membuat pesanan pengganti tanpa memeriksa keadaan terbaru.

#### Membuat pesanan layanan kamar (Room Service)

1. Pilih **Layanan Kamar**, lalu klik **[F2] Pesanan Baru**.
2. Isi **Nomor kamar** dan **Jumlah tamu** antara 1 hingga 99. Nomor kamar dibatasi maksimal 10 karakter.
3. Klik **Buat Pesanan**. Kamar harus terdaftar, memiliki tamu yang sedang check-in, dan memiliki folio terbuka. Sistem menautkan pesanan ke folio tersebut tanpa menggunakan meja restoran.
4. Jika kamar atau folio tidak memenuhi syarat, periksa nomor kamar dan koordinasikan dengan Front Office. Pembuatan pesanan tidak menggantikan proses check-in atau pembukaan folio.

#### Memilih tagihan aktif, meja, atau antrean layanan kamar

1. Pada deretan **Tagihan aktif**, klik kartu **KOT** yang sesuai untuk membuka pesanan. Cocokkan nomor pesanan, nominal total, dan lokasi meja atau kamar. Periksa status dapur **Belum Dimasak**, **Sedang Dimasak**, atau **Siap Saji**, serta penanda **Ditagihkan** jika tagihan sudah dikonfirmasi. Geser deretan kartu secara horizontal jika tagihan yang dicari belum terlihat.
2. Untuk pesanan meja, pilih **Meja Berjalan**, lalu gunakan filter **Lokasi**: **Semua lokasi**, **Dalam ruangan**, **Luar ruangan**, atau **Ruang privat**. Klik meja dengan pesanan aktif untuk membuka tagihan yang sudah ada. Klik meja **Tersedia** atau **Dipesan** tanpa pesanan aktif untuk membuka dialog pesanan baru, bukan membuat tagihan kedua pada meja yang sudah digunakan. Meja **Tidak tersedia (OOS)** tidak dapat dipilih.
3. Untuk pesanan kamar, pilih **Layanan Kamar / Antrean**, lalu klik kamar dan nomor KOT yang sesuai pada **Antrean layanan kamar**. Periksa penanda **Pesanan aktif** atau **Ditagihkan** agar tidak tertukar dengan pesanan lain. Sebelum membebankan pembayaran ke kamar, cocokkan tamu, nomor kamar, dan nomor folio pada **Folio layanan kamar** di dialog pembayaran; memilih antrean hanya membuka pesanan, bukan mengganti folio tujuannya.

#### Menambahkan menu dan mengelola tagihan

1. Pilih pesanan dari daftar tagihan aktif atau panel meja. Pastikan lokasi dan jumlah tamunya sesuai.
2. Gunakan **Cari menu...** atau kategori **Semua**, **Makanan Utama**, **Minuman**, **Camilan**, dan **Hidangan Penutup**. Klik tombol `+` pada menu untuk menambahkan satu item.
3. Sesuaikan jumlah dengan tombol `+` atau `−` pada rincian item; gunakan ikon hapus untuk menghapus item. Penambahan dan perubahan item disimpan langsung. Tombol penambahan jumlah dibatasi hingga 99 per baris item.
4. Jika diperlukan, isi **Catatan untuk dapur**, lalu klik **Simpan** pada baris tersebut. Catatan dibatasi 235 karakter. Peringatan **Catatan belum disimpan.** berarti perubahan catatan belum diterapkan; simpan sebelum beralih ke pembayaran atau tindakan lain.
5. Periksa **Subtotal**, **Biaya Layanan**, **Pajak PB1**, dan **Total**. Persentase biaya layanan dan pajak mengikuti pengaturan hotel, bukan angka tetap dalam panduan ini.
6. Untuk meninggalkan pesanan sementara, klik **Tahan Tagihan**. Pesanan tetap tersimpan dan dapat dipilih kembali dari daftar tagihan aktif; tindakan ini hanya melepas pilihan pesanan, bukan membuat status penahanan baru.
7. Gunakan **Cetak Tagihan** untuk membuka tagihan pada tab baru. Pencetakan tagihan bukan konfirmasi pembayaran.
8. Untuk membatalkan pesanan yang masih terbuka, klik **Batal / Void**, isi **Alasan pembatalan** maksimal 255 karakter, lalu klik **Konfirmasi Void**. Periksa nomor pesanan terlebih dahulu karena pembatalan tidak dapat dibatalkan melalui dialog ini.

> **Pengiriman ke dapur:** Item yang sudah disimpan langsung terlihat di Layar Dapur selama pesanan memenuhi syarat antrean. **[F6] Kirim ke Dapur** menampilkan pemberitahuan dan menyegarkan data; tombol ini bukan tahap pengiriman wajib dan tidak menyimpan catatan yang belum disimpan.

#### Memproses pembayaran

1. Pastikan pesanan memiliki item, seluruh catatan telah disimpan, dan total telah diperiksa. Klik **[F4] Bayar / Selesai**.
2. Sistem mengonfirmasi tagihan yang masih terbuka, lalu memuat data terbaru sebelum membuka **Pembayaran pesanan**. Item terkunci setelah tagihan dikonfirmasi. Jika perlu mengubah item, tutup dialog dan gunakan **Buka Kembali Pesanan** sebelum melakukan perubahan.

   ![Dialog Pembayaran POS](images/fb-03-pos-payment.png)

3. Periksa **Item yang dibayar**, **Subtotal**, **Biaya layanan**, **Pajak**, dan **Total pembayaran**. Pilih metode yang sesuai.

   | Metode | Langkah operator |
   | --- | --- |
   | **Tunai** (Cash) | Isi **Uang diterima (rupiah penuh)** dengan bilangan bulat positif tanpa pemisah, minimal sebesar total pembayaran. Periksa kembalian yang ditampilkan, lalu klik **Konfirmasi pembayaran**. |
   | **Kartu** (Card) | Isi **Referensi pembayaran (opsional)** jika diperlukan, maksimal 100 karakter, lalu klik **Konfirmasi pembayaran**. |
   | **Transfer** | Isi **Referensi pembayaran (opsional)** jika diperlukan, maksimal 100 karakter, lalu klik **Konfirmasi pembayaran**. |
   | **Bebankan ke kamar** (Charge to Room) | Untuk pesanan makan di tempat, isi **Nomor kamar**, klik **Cari kamar**, periksa tamu dan folio, lalu centang **Saya mengonfirmasi tamu dan folio tujuan ini.** Klik **Bebankan ke folio** setelah tujuan benar. Kamar harus memiliki tamu yang sedang menginap dan folio terbuka. |

4. Untuk layanan kamar, metode awal adalah **Bebankan ke kamar** dan bagian **Folio layanan kamar** menampilkan folio yang sudah ditautkan. Periksa tamu, kamar, dan nomor folio sebelum konfirmasi; bukan memilih kamar tujuan lain. Metode **Tunai**, **Kartu**, dan **Transfer** tetap tersedia jika pembayaran dilakukan langsung.
5. Tunggu **Hasil pembayaran**. Periksa metode, total yang diproses, kembalian jika tunai, atau nomor folio jika dibebankan ke kamar. Klik **Lihat struk** untuk membuka struk pada tab baru, lalu **Tutup** untuk kembali. Pembebanan ke folio menyelesaikan tagihan F&B yang diproses, bukan melunasi saldo folio hotel.

#### Memisahkan pembayaran berdasarkan item

1. Pilih pesanan, lalu klik **Split Tagihan**. Jika tagihan belum dikonfirmasi, sistem mengonfirmasinya terlebih dahulu.
2. Pada dialog **Pisah pembayaran**, atur **Pilih jumlah item yang dibayar**. Pilihan awal bernilai 0; pilih minimal satu item dengan total pembayaran positif. Jumlah harus berupa bilangan bulat dan tidak boleh melebihi jumlah item yang tersisa.
3. Periksa total pilihan beserta biaya layanan dan pajaknya, pilih satu metode pembayaran, lalu lakukan konfirmasi sesuai prosedur di atas.
4. Jika masih ada item belum dibayar, sistem menampilkan pemberitahuan pada hasil pembayaran. Klik **Tutup**, pilih kembali pesanan jika diperlukan, dan lanjutkan pembayaran untuk sisa item. Pesanan sisa tetap ditagihkan sampai diselesaikan; pembayaran sebagian tidak menyelesaikan seluruh tagihan atau membebaskan meja.
5. Buka **Lihat struk** untuk masing-masing pembayaran yang berhasil jika diperlukan. Pemisahan dilakukan menurut item dan jumlahnya, bukan pembagian nominal bebas atau pembagian rata otomatis berdasarkan jumlah tamu.

> **Hasil pembayaran belum diketahui:** Jangan langsung mengulang pembayaran apabila konfirmasi tidak diterima. Dialog menonaktifkan pembayaran ulang untuk mencegah pencatatan ganda. Pilih **Periksa detail pesanan dan pembayaran**, cocokkan transaksi sebelumnya, lalu gunakan **Tutup & Muat Ulang** sebelum menentukan tindakan berikutnya. Jika pesan menyebut status atau jumlah item berubah, muat ulang dan periksa kembali data pesanan.

#### Menggunakan pintasan dan penyegaran layar

- **F2** membuka pesanan baru, **F4** membuka pembayaran, dan **F6** menjalankan **Kirim ke Dapur** sesuai ketentuan di atas. Gunakan tombol fungsi tanpa kombinasi Ctrl, Alt, Shift, atau Meta. Pintasan tidak menjalankan tindakan ketika dialog terbuka atau proses sedang berlangsung; penekanan berulang dengan menahan tombol juga diabaikan.
- Gunakan **Muat ulang pesanan** untuk mengambil keadaan terbaru dan **Layar penuh** untuk memperluas tampilan. POS menyegarkan data berkala setiap 15 detik saat halaman terlihat dan tidak sedang memproses tindakan, menampilkan dialog, atau menerima isian pada kolom formulir.
- Klik **Kembali ke Dasbor** untuk kembali ke ringkasan F&B.

### 3. Layar Dapur / Kitchen Pass KDS

1. Buka `/app/fb/kitchen`. Halaman **Layar Dapur** menampilkan pesanan yang masih terbuka atau ditagihkan, memiliki item, dan belum ditandai selesai dimasak. Pesanan diurutkan dari waktu pembukaan paling awal.

   ![Layar Dapur KDS](images/fb-04-kitchen-display.png)

2. Pilih filter stasiun **Semua**, **Dapur**, **Bar**, **Panggangan**, atau **Gorengan**. Penempatan stasiun ditentukan dari kata kunci kategori dan nama menu, bukan penugasan manual oleh operator. Satu tiket dapat muncul pada beberapa stasiun karena berisi item untuk stasiun yang berbeda. Filter tetap menampilkan seluruh isi tiket yang cocok, bukan hanya item milik stasiun tersebut.
3. Periksa nomor **KOT**, meja atau kamar tujuan, jenis layanan, jumlah tamu, pelayan, jumlah item, dan catatan sebelum memulai. Klik **Mulai memasak** untuk mencatat awal persiapan. Tiket kemudian menampilkan **Sedang dimasak**.
4. Gunakan **Tandai Siap** pada item yang telah selesai disiapkan. Tombol berubah menjadi **Siap** dan ringkasan menampilkan jumlah item siap. Tekan kembali untuk membatalkan tanda jika diperlukan.
5. Koordinasikan kesiapan seluruh item dengan stasiun lain. Setelah seluruh pesanan benar-benar siap, klik **Tandai selesai**. Sistem mencatat waktu selesai dan tiket tidak lagi muncul pada antrean aktif setelah penyegaran. Tindakan ini menyelesaikan persiapan dapur, bukan pembayaran pesanan.
6. Pantau waktu berjalan pada tiket dalam format jam:menit:detik. Pesanan ditandai **TERLAMBAT** dengan penekanan warna merah setelah mencapai **60 menit sejak pesanan dibuka**, bukan sejak tombol **Mulai memasak** ditekan. Prioritaskan pemeriksaan pesanan terlambat tanpa menandainya selesai sebelum benar-benar siap.
7. Jika notifikasi suara diperlukan, klik **Suara hening** hingga berubah menjadi **Suara aktif**. Sistem memainkan bunyi uji ketika diaktifkan dan memberi bunyi saat tiket baru muncul pada pembaruan data, termasuk tiket di luar filter stasiun yang sedang dipilih. Suara tidak aktif secara otomatis saat halaman pertama kali dibuka; penambahan item pada tiket yang sama bukan notifikasi tiket baru. Jika suara gagal, periksa izin suara peramban dan aktifkan kembali.
8. Gunakan **Layar penuh** untuk tampilan operasional dapur dan **Keluar layar penuh** untuk kembali. Waktu tiket diperbarui setiap detik, sedangkan antrean disegarkan otomatis setiap 10 detik. Jika sistem menyatakan pesanan berubah, muat ulang Layar Dapur dan periksa isinya sebelum melanjutkan.

> **Batas daftar kesiapan:** Tanda siap per item hanya berlaku pada layar yang digunakan, tidak tersimpan dan tidak dibagikan kepada operator lain. Perubahan isi tiket menghapus tanda siap. Tombol **Tandai selesai** tidak mensyaratkan semua item telah dicentang; operator tetap wajib memastikan kesiapan seluruh stasiun sebelum menyelesaikan pesanan.

### 4. Inventaris Dapur & Riwayat Stok

Halaman inventaris digunakan oleh petugas dengan peran F&B atau Admin. Pencatatan dilakukan dalam satuan masing-masing bahan; periksa satuan sebelum memasukkan jumlah.

#### Memeriksa persediaan bahan baku

1. Buka `/app/fb/inventory` untuk melihat **Inventaris Dapur**.

   ![Inventaris Dapur](images/fb-05-inventory-list.png)

2. Gunakan **Cari Bahan Baku** untuk mencari berdasarkan nama bahan atau kategori. Pilih **Lokasi Penyimpanan** untuk membatasi lokasi; gunakan **Semua lokasi** untuk melihat keseluruhan atau **Belum ditentukan** untuk bahan tanpa lokasi jika pilihan tersebut tersedia.
3. Pilih filter **Semua**, **Negatif**, **Habis**, **Rendah**, atau **Aman**. Periksa kolom **Stok Fisik**, **Par**, dan **Terakhir Dihitung** sebelum mencatat perubahan. Stok pada layar merupakan saldo yang tercatat; cocokkan dengan kondisi fisik melalui Stok Opname.

   | Status | Kondisi saldo tercatat |
   | --- | --- |
   | **Negatif** | Saldo kurang dari 0. |
   | **Habis** | Saldo sama dengan 0. |
   | **Rendah** | Saldo lebih dari 0 dan kurang dari atau sama dengan Par. Saldo tepat pada Par tetap berstatus Rendah. |
   | **Aman** | Saldo lebih besar dari Par. |

4. Klik **Muat Ulang** untuk mengambil data terbaru. Jika tidak ada hasil pencarian, ubah filter atau pilih **Atur Ulang Filter**. Jika belum ada bahan baku, hubungi administrator untuk menyiapkan datanya.

#### Mencatat penerimaan, penghitungan fisik, dan kerusakan

1. Pilih tindakan dari tombol di bagian atas atau menu **Aksi** pada baris bahan.

   | Tindakan | Jumlah yang harus dimasukkan dan dampaknya |
   | --- | --- |
   | **Terima Barang** | Masukkan jumlah bahan yang diterima. Sistem menambahkan jumlah tersebut ke saldo. |
   | **Stok Opname** | Masukkan **Jumlah Fisik Aktual**, bukan selisihnya. Sistem menetapkan saldo sesuai hasil hitung dan mencatat selisih terhadap saldo saat penyimpanan, sekaligus memperbarui waktu terakhir dihitung. Isi 0 jika bahan habis. |
   | **Catat Kerusakan** | Masukkan jumlah bahan rusak atau terbuang. Sistem mengurangi saldo sejumlah itu; saldo hasil pengurangan dapat menjadi negatif. |

2. Pilih **Bahan Baku**, lalu periksa **Stok tercatat** dan satuannya. Jika tindakan dibuka dari baris bahan, pastikan bahan yang sudah terpilih benar.
3. Isi **Jumlah** atau **Jumlah Fisik Aktual**. Gunakan maksimal tiga angka desimal dengan nilai paling besar 9.999.999,999. Penerimaan dan kerusakan harus lebih dari 0; Stok Opname boleh 0 tetapi tidak boleh negatif. Sistem juga menolak saldo atau selisih yang melampaui batas penyimpanan.
4. Isi **Catatan (opsional)** maksimal 255 karakter jika diperlukan untuk menjelaskan sumber penerimaan, hasil penghitungan, atau penyebab kerusakan. Untuk **Terima Barang**, cantumkan nama pemasok dan referensi pengiriman atau nomor surat jalan dalam catatan jika diperlukan; formulir tidak menyediakan kolom khusus pemasok atau referensi pengiriman.
5. Klik **Simpan**, tunggu pemberitahuan berhasil, lalu periksa saldo dan status bahan yang diperbarui. Gunakan **Batal** jika pencatatan belum akan dilakukan.
6. Jika hasil penyimpanan belum dapat dipastikan, jangan mencatat ulang langsung. Tutup dialog, klik **Muat Ulang**, dan cocokkan **Riwayat Stok** terlebih dahulu untuk mencegah pergerakan ganda.

#### Menindaklanjuti peringatan dan menonaktifkan menu (86)

1. Periksa bagian **Perlu Perhatian**. Peringatan ini muncul untuk bahan dengan stok negatif yang terhubung ke menu, bukan untuk seluruh bahan berstatus Rendah atau Habis. Daftar mengikuti pencarian bahan dan filter lokasi yang digunakan.

   ![Peringatan Perlu Perhatian dan 86](images/fb-06-inventory-86.png)

2. Cocokkan stok fisik dan identifikasi menu terkait. Jika menu tidak boleh dipesan sementara, klik **Nonaktifkan Menu (86)** pada peringatan yang sesuai.
3. Pada dialog **Nonaktifkan menu (86)?**, pastikan nama menu benar, lalu klik **Nonaktifkan (86)**. Pilih **Batal** jika tidak ingin melanjutkan.
4. Setelah berhasil, menu menjadi nonaktif dan tidak tersedia untuk pesanan baru. Tindakan 86 tidak mengubah stok bahan dan tidak membatalkan item yang sudah tercatat pada pesanan. Menu yang sudah nonaktif menampilkan **Menu Sudah Nonaktif**; tombol ini tidak dapat digunakan untuk mengaktifkan menu kembali.

#### Memeriksa buku besar riwayat stok

1. Buka menu **Aksi** pada bahan yang ingin diperiksa, lalu pilih **Riwayat Stok**.

   ![Buku Besar Riwayat Stok](images/fb-07-inventory-ledger.png)

2. Pada dialog **Riwayat Stok**, periksa maksimal **100 pergerakan terbaru untuk bahan tersebut**, diurutkan dari yang paling baru. Riwayat ini bukan daftar seluruh bahan dan bukan jaminan seluruh pergerakan lama ditampilkan.
3. Cocokkan jenis pergerakan, tanggal dan waktu dalam WIB, nama pencatat, jumlah perubahan bertanda positif atau negatif, **Saldo** setelah pergerakan, serta catatannya. Jenis yang dapat ditampilkan adalah **Terima Barang**, **Stok Opname**, **Catat Kerusakan**, dan **Pemakaian**. Adanya label Pemakaian tidak berarti setiap transaksi POS otomatis mengurangi stok.
4. Jika riwayat gagal dimuat, klik **Coba Lagi**. Jika belum ada pergerakan, dialog menampilkan keterangan tersebut. Klik **Tutup** setelah pemeriksaan selesai.

## Akuntansi

Akuntansi menjalankan Night Audit dan melihat laporan harian hotel.

### 1. Melihat Area Akuntansi

1. Buka dashboard **Accounting**.

   ![Dashboard Akuntansi](images/acc-01-dashboard.png)

   Dashboard menampilkan status business date, pendapatan, dan akses ke Night Audit.

### 2. Run Night Audit

1. Buka menu **Night Audit**.

   ![Night Audit sebelum dijalankan](images/acc-02-night-audit-prerun.png)

   Periksa tanggal audit, pendapatan, pembayaran, dan transaksi terbuka sebelum menjalankan audit.

2. Klik **Run Night Audit** dan konfirmasi.

   ![Konfirmasi Night Audit](images/acc-03-night-audit-confirm.png)

   Sistem meminta konfirmasi agar audit tidak dijalankan tanpa sengaja.

3. Tunggu sampai audit selesai.

   ![Hasil Night Audit](images/acc-04-night-audit-result.png)

   Setelah selesai, sistem menampilkan ringkasan audit dan tautan laporan.

### 3. Lihat Night Report

1. Buka laporan hasil Night Audit.

   ![Night Report Akuntansi](images/acc-05-night-report.png)

   Night Report dapat dilihat untuk rekap pendapatan, pembayaran, dan saldo operasional harian.

## Admin

Admin mengelola master data, pengguna, dan pengaturan aplikasi tanpa akses ke modul Housekeeping.

### 1. Kelola Room Types dan Rooms

1. Buka menu **Rooms** pada Admin.

   ![Master data room types](images/admin-01-room-types.png)

   Tab Room Types digunakan untuk melihat dan mengelola tipe kamar hotel.

2. Pilih tab **Daftar Kamar**.

   ![Master data rooms](images/admin-02-rooms.png)

   Daftar Kamar menampilkan nomor kamar, tipe kamar, lantai, status inventori, dan status housekeeping.

### 2. Kelola Articles dan Menu

1. Buka menu **Articles**.

   ![Master data articles](images/admin-03-articles.png)

   Articles digunakan untuk item charge hotel seperti laundry, minibar, atau layanan tambahan.

2. Buka menu **Menu**.

   ![Master data menu F&B](images/admin-04-menu.png)

   Menu digunakan untuk mengelola item makanan dan minuman yang dijual oleh F&B.

### 3. Kelola Users

1. Buka menu **Users**.

   ![Manajemen users Admin](images/admin-05-users.png)

   Admin dapat melihat user demo dan role pengguna. Bagian Admin tidak menampilkan akses ke layar Housekeeping.

### 4. Kelola Meja

1. Buka menu **Meja** pada Admin.

   ![Daftar meja restoran](images/admin-06-tables-list.png)

   Daftar Meja menampilkan nomor meja, kapasitas, lokasi, status, order aktif, dan catatan. Gunakan **Tambah Meja** atau aksi baris untuk menambah dan mengubah kapasitas, lokasi/area, status, dan catatan meja.

2. Pilih tab **Layout**.

   ![Layout meja restoran](images/admin-07-tables-layout.png)

   Layout menampilkan editor floor plan desktop untuk memosisikan meja dengan drag pada canvas. Susunan ini mencerminkan layout fisik ruangan restoran sehingga F&B melihat posisi meja yang sama di floor plan.

### 5. Pengaturan Hotel

1. Buka menu **Pengaturan** pada Admin.

   ![Pengaturan Hotel Admin](images/admin-08-settings.png)

   Pengaturan Hotel menyediakan nama hotel, mata uang, alamat, PPN, service charge, dan cut-off Night Audit. Panel Preview menampilkan contoh perhitungan F&B sebelum perubahan disimpan.
