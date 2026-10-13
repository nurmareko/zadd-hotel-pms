const roomStatuses = [
  { code: "VC", label: "Kosong bersih", description: "Kamar kosong, bersih, dan siap dijual setelah lolos inspeksi.", color: "bg-emerald-100 text-emerald-800" },
  { code: "OC", label: "Terisi bersih", description: "Kamar masih ditempati tamu dan sudah dibersihkan.", color: "bg-blue-100 text-blue-800" },
  { code: "VD", label: "Kosong kotor", description: "Kamar kosong yang perlu dibersihkan sebelum digunakan kembali.", color: "bg-amber-100 text-amber-800" },
  { code: "OD", label: "Terisi kotor", description: "Kamar masih ditempati tamu dan memerlukan pembersihan.", color: "bg-orange-100 text-orange-800" },
  { code: "VCU", label: "Bersih, menunggu inspeksi", description: "Kamar kosong sudah dibersihkan, tetapi belum siap dijual sampai lolos inspeksi.", color: "bg-purple-100 text-purple-800" },
  { code: "OOO", label: "Tidak dapat digunakan", description: "Kamar rusak atau memerlukan perbaikan sehingga tidak dapat dijual.", color: "bg-red-100 text-red-800" },
  { code: "OOS", label: "Tidak tersedia sementara", description: "Kamar sementara tidak digunakan untuk operasional atau layanan.", color: "bg-slate-100 text-slate-700" },
];

const summaryClass = "min-h-12 cursor-pointer rounded-md px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const listClass = "list-decimal space-y-2 pl-5";
const contentClass = "px-4 pb-4 text-sm leading-6 text-muted-foreground";

export function HkSopAccordion() {
  return (
    <section aria-label="Panduan SOP HK" className="mt-6 min-w-0 rounded-lg border border-border bg-card shadow-sm">
      <header className="border-b border-border px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">Panduan SOP HK</h2>
        <p className="mt-1 text-sm text-muted-foreground">Buka panduan sesuai pekerjaan. Catat hasil aktual pada formulir pembersihan.</p>
      </header>
      <div className="divide-y divide-border">
        <details>
          <summary className={summaryClass}>SOP pembersihan kamar check-out · VD → VCU</summary>
          <div className={contentClass}>
            <ol className={listClass}>
              <li>Pastikan tamu sudah check-out, kamar berstatus VD, dan Anda adalah petugas yang ditugaskan. Mulai pembersihan di aplikasi.</li>
              <li>Periksa barang tertinggal dan laporkan temuan. Tarik linen kotor, buang sampah, bersihkan seluruh permukaan dan lantai, sanitasi kamar mandi, lalu tata tempat tidur dengan linen bersih.</li>
              <li><strong className="text-foreground">Wajib mengganti linen/seprei dan handuk</strong> dengan yang bersih. Tandai kedua penggantian hanya setelah benar-benar dilakukan.</li>
              <li>Lengkapi dan tata amenities sesuai panduan penempatan. Periksa kebersihan, perlengkapan, dan fungsi fasilitas; catat kekurangan atau kerusakan.</li>
              <li>Selesaikan pembersihan menjadi VCU. Kamar belum siap dijual: inspeksi yang lulus mengubah VCU → VC; jika gagal, kembalikan ke VD dengan alasan untuk dibersihkan ulang.</li>
            </ol>
          </div>
        </details>
        <details>
          <summary className={summaryClass}>SOP pembersihan kamar terisi · OD → OC</summary>
          <div className={contentClass}>
            <ol className={listClass}>
              <li>Periksa penugasan, ketuk pintu, minta izin, dan hormati tanda jangan ganggu. Jangan memindahkan barang pribadi tamu tanpa izin.</li>
              <li>Mulai pembersihan di aplikasi. Rapikan tempat tidur, buang sampah, serta bersihkan permukaan, kamar mandi, dan lantai.</li>
              <li>Ganti handuk bila diminta tamu atau diletakkan di lantai. Ganti linen sesuai kebutuhan atau permintaan tamu. Catat penggantian yang benar-benar dilakukan.</li>
              <li>Isi ulang amenities yang habis, lalu catat kekurangan, kerusakan, atau permintaan tamu.</li>
              <li>Selesaikan pembersihan OD → OC. Tamu tetap menempati kamar; alur ini tidak melalui inspeksi kamar kosong VCU.</li>
            </ol>
          </div>
        </details>
        <details>
          <summary className={summaryClass}>Standar penataan amenities</summary>
          <div className={contentClass}>
            <ul className="list-disc space-y-2 pl-5">
              <li>Handuk bersih: lipat rapi dan letakkan pada rak atau gantungan handuk di kamar mandi, terpisah dari handuk kotor.</li>
              <li>Sabun dan sampo: letakkan rapi pada wadah atau area perlengkapan mandi yang bersih dan kering.</li>
              <li>Perlengkapan sikat dan pasta gigi: letakkan dalam kemasan utuh di dekat wastafel pada area yang kering.</li>
              <li>Air mineral: siapkan <strong className="text-foreground">2 botol air mineral gratis</strong> bersegel pada meja atau baki minuman, bersama gelas bersih.</li>
              <li>Periksa kebersihan, segel, dan masa berlaku perlengkapan. Catat jumlah aktual yang diganti atau ditambahkan; jangan mengisi jumlah berdasarkan perkiraan.</li>
            </ul>
          </div>
        </details>
        <details>
          <summary className={summaryClass}>Glosarium status kamar</summary>
          <dl className="space-y-4 px-4 pb-4 text-sm">
            {roomStatuses.map(({ code, label, description, color }) => (
              <div key={code}>
                <dt className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{code}</span>
                  {label}
                </dt>
                <dd className="mt-1 leading-6 text-muted-foreground">{description}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </section>
  );
}
