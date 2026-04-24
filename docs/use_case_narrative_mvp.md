# 3.2.2 Use Case Diagram (MVP)

Use case diagram pada Gambar 3.1 menggambarkan interaksi antara aktor dengan fitur-fitur sistem manajemen properti hotel yang telah diidentifikasi pada subbab 3.1.3. Sistem melibatkan lima aktor, yaitu Petugas Front Office, Petugas Housekeeping, Petugas F&B, dan Petugas Akuntansi (Night Auditor) yang masing-masing merupakan peran yang dimainkan oleh mahasiswa praktikum, serta Administrator yang diperankan oleh dosen pembimbing praktikum untuk mengelola data master dan pengguna sistem.

Sistem mencakup tiga belas *use case* utama dan dua *use case* pendukung yang dikelompokkan ke dalam lima modul sesuai pembagian fungsional. Modul Front Office menangani siklus hidup tamu yang mencakup pengelolaan reservasi, proses *check-in*, pengelolaan *guest folio*, serta proses *check-out*. Modul Housekeeping menangani pemantauan dan pembaruan status kamar secara *mobile-first*. Modul Food & Beverage menangani pembuatan *captain order*, pemrosesan *bill*, serta pembayaran melalui metode tunai maupun *charge to room*. Modul Akuntansi menangani eksekusi *night audit* dan penghasilan *night report* terkonsolidasi. Modul Admin menangani pengelolaan data master dan pengelolaan pengguna beserta *role*-nya.

Diagram memuat dua relasi antar *use case*. Relasi «include» menghubungkan *Proses Check-out* ke *Verifikasi Zero-Balance*, menandakan bahwa verifikasi saldo folio selalu dieksekusi sebagai bagian wajib dari proses *check-out*. Relasi «extend» menghubungkan *Charge to Room* ke *Proses Pembayaran F&B*, menandakan bahwa pembebanan tagihan F&B ke folio tamu merupakan perilaku tambahan yang bersifat opsional dan hanya dijalankan apabila metode pembayaran yang dipilih adalah *charge to room*.

## Pemetaan Aktor–Use Case

| Aktor | Use Case |
|---|---|
| Petugas Front Office | Kelola Reservasi; Proses Check-in; Kelola Guest Folio; Proses Check-out |
| Petugas Housekeeping | Lihat Status Kamar; Update Status Kamar |
| Petugas F&B | Buat Captain Order; Proses Bill F&B; Proses Pembayaran F&B |
| Petugas Akuntansi | Jalankan Night Audit; Generate Night Report |
| Administrator | Kelola Data Master; Kelola Pengguna & Role |

Relasi antar *use case*:

- *Proses Check-out* «include» *Verifikasi Zero-Balance*
- *Charge to Room* «extend» *Proses Pembayaran F&B*
