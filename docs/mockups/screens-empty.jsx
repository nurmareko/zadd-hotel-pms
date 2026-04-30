// Empty / loading / error / no-results states — gallery card
// Wrapped in a desktop chrome so they read as real product screens.

function ESIllust({ kind, accent = '#0f172a' }) {
  // Lightweight inline SVGs sized 96px. accent inherits from theme.
  const sw = { width: 96, height: 96 };
  if (kind === 'noData') return (
    <svg {...sw} viewBox="0 0 96 96" fill="none">
      <rect x="14" y="20" width="56" height="68" rx="3" stroke={accent} strokeWidth="1.5" strokeOpacity=".7"/>
      <rect x="22" y="32" width="40" height="2" fill={accent} fillOpacity=".25"/>
      <rect x="22" y="40" width="32" height="2" fill={accent} fillOpacity=".25"/>
      <rect x="22" y="48" width="36" height="2" fill={accent} fillOpacity=".25"/>
      <circle cx="68" cy="60" r="14" stroke={accent} strokeWidth="2" strokeOpacity=".85"/>
      <path d="M78 70l8 8" stroke={accent} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M62 60h12M68 54v12" stroke={accent} strokeWidth="1.5" strokeOpacity=".6" strokeLinecap="round"/>
    </svg>
  );
  if (kind === 'noResults') return (
    <svg {...sw} viewBox="0 0 96 96" fill="none">
      <circle cx="40" cy="40" r="22" stroke={accent} strokeWidth="2.5" strokeOpacity=".85"/>
      <path d="M58 58l16 16" stroke={accent} strokeWidth="3" strokeLinecap="round"/>
      <path d="M30 40h20M40 30v20" stroke={accent} strokeWidth="1.5" strokeOpacity=".4" strokeLinecap="round"/>
      <path d="M70 22l-3 3M80 32l-3-3M75 28l3-3" stroke={accent} strokeWidth="1.5" strokeOpacity=".5" strokeLinecap="round"/>
    </svg>
  );
  if (kind === 'error') return (
    <svg {...sw} viewBox="0 0 96 96" fill="none">
      <path d="M48 14l36 60H12L48 14z" stroke={accent} strokeWidth="2" strokeLinejoin="round"/>
      <rect x="46" y="38" width="4" height="20" rx="1.5" fill={accent}/>
      <circle cx="48" cy="64" r="2.5" fill={accent}/>
    </svg>
  );
  if (kind === 'loading') return (
    <svg {...sw} viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="26" stroke={accent} strokeOpacity=".15" strokeWidth="4"/>
      <path d="M48 22a26 26 0 0 1 26 26" stroke={accent} strokeWidth="4" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 48 48" to="360 48 48" dur="1.1s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
  if (kind === 'offline') return (
    <svg {...sw} viewBox="0 0 96 96" fill="none">
      <path d="M16 36a40 40 0 0 1 64 0M28 48a26 26 0 0 1 40 0M40 60a13 13 0 0 1 16 0" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeOpacity=".75"/>
      <circle cx="48" cy="72" r="3.5" fill={accent}/>
      <line x1="14" y1="14" x2="82" y2="82" stroke={accent} strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
  if (kind === 'success') return (
    <svg {...sw} viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="32" stroke={accent} strokeWidth="2.5" strokeOpacity=".5"/>
      <path d="M32 48l12 12 22-22" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return null;
}

function ESCard({ kind, title, body, primary, secondary, meta }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--slate-200)',
      borderRadius: 6,
      padding: '32px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 14,
    }}>
      <ESIllust kind={kind}/>
      <div>
        <div style={{fontSize: 14, fontWeight: 600, color: 'var(--slate-900)'}}>{title}</div>
        <div style={{fontSize: 12, color: 'var(--slate-500)', marginTop: 4, lineHeight: 1.5, maxWidth: 280}}>{body}</div>
      </div>
      {meta && <div style={{
        fontSize: 11, color: 'var(--slate-500)',
        background: 'var(--slate-50)', border: '1px solid var(--slate-200)',
        padding: '4px 8px', borderRadius: 4,
        fontFamily: 'ui-monospace, monospace',
      }}>{meta}</div>}
      <div style={{display:'flex', gap:8}}>
        {secondary && <button className="btn sm">{secondary}</button>}
        {primary && <button className="btn primary sm">{primary}</button>}
      </div>
    </div>
  );
}

function EmptyStates() {
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fo" active="res-list"/>
      <main className="zd-main">
        <Topbar crumbs={['Design System', 'Empty States']}/>
        <div className="zd-content">
          <PageHeader
            title="Empty States · Gallery"
            sub="Bagaimana sistem berkomunikasi saat tidak ada data, terjadi error, atau pencarian gagal."
          />

          <div style={{fontSize:11, fontWeight:600, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, marginTop:4}}>
            Standar
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:20}}>
            <ESCard kind="noData"
              title="Belum ada reservasi"
              body="Reservasi yang dibuat akan muncul di sini. Mulai dengan membuat reservasi pertama."
              primary="+ Reservasi Baru"
              secondary="Import dari CSV"/>
            <ESCard kind="noResults"
              title="Tidak ada hasil"
              body="Pencarian “Tomi Wijaya” tidak ditemukan di rentang 23 Apr → 26 Apr 2026."
              primary="Reset Filter"
              secondary="Perluas Tanggal"
              meta='q="Tomi Wijaya"'/>
            <ESCard kind="loading"
              title="Memuat data…"
              body="Mengambil daftar reservasi dari server. Biasanya selesai dalam 1–2 detik."
              meta="GET /api/reservations"/>
          </div>

          <div style={{fontSize:11, fontWeight:600, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10}}>
            Error & koneksi
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:20}}>
            <ESCard kind="error"
              title="Gagal memuat data"
              body="Terjadi kesalahan saat menghubungi server. Coba muat ulang halaman atau hubungi admin."
              primary="Coba Lagi"
              secondary="Lapor Masalah"
              meta="ERR_500 · req-7f3d2a"/>
            <ESCard kind="offline"
              title="Koneksi terputus"
              body="Anda offline. Update status kamar yang dilakukan sekarang akan tersinkron saat koneksi pulih."
              secondary="Cek Koneksi"
              meta="3 perubahan tertunda"/>
            <ESCard kind="success"
              title="Check-out berhasil"
              body="Folio FOL-2304-0004 atas nama Tomi Wijaya telah ditutup. Saldo akhir: NOL."
              primary="Cetak Folio"
              secondary="Tutup"/>
          </div>

          <div style={{fontSize:11, fontWeight:600, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10}}>
            In-context (di dalam kartu)
          </div>
          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:12}}>
            <div className="card">
              <div className="card-h"><h3>Daftar Reservasi · Hari Ini</h3><span className="meta">0 reservasi</span></div>
              <div style={{padding:'48px 24px', textAlign:'center'}}>
                <ESIllust kind="noData"/>
                <div style={{fontSize:13, fontWeight:600, color:'var(--slate-900)', marginTop:10}}>Tidak ada reservasi untuk hari ini</div>
                <div style={{fontSize:12, color:'var(--slate-500)', marginTop:4, maxWidth:340, marginLeft:'auto', marginRight:'auto', lineHeight:1.5}}>
                  Hari ini Selasa, 26 Apr 2026 — belum ada arrival, departure, atau in-house. Buat reservasi atau pilih tanggal lain.
                </div>
                <div style={{marginTop:14, display:'flex', gap:8, justifyContent:'center'}}>
                  <button className="btn sm">Tampilkan 7 hari ke depan</button>
                  <button className="btn primary sm">+ Reservasi Baru</button>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3>Activity Feed</h3></div>
              <div style={{padding:'32px 16px', textAlign:'center'}}>
                <ESIllust kind="noData"/>
                <div style={{fontSize:13, fontWeight:600, color:'var(--slate-900)', marginTop:10}}>Tidak ada aktivitas</div>
                <div style={{fontSize:11.5, color:'var(--slate-500)', marginTop:4, lineHeight:1.5}}>
                  Aktivitas tim akan muncul di sini saat ada update kamar, check-in, atau posting transaksi.
                </div>
              </div>
            </div>
          </div>

          <div style={{fontSize:11, fontWeight:600, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10, marginTop:20}}>
            Loading skeletons (in-place)
          </div>
          <div className="card">
            <div className="card-h"><h3>Tape Chart · 14 Hari</h3><span className="meta">Memuat…</span></div>
            <div style={{padding:14, display:'flex', flexDirection:'column', gap:8}}>
              {[0,1,2,3,4].map(r=>(
                <div key={r} style={{display:'flex', gap:6}}>
                  <div className="sk" style={{width: 90, height: 22}}/>
                  {[0,1,2,3,4,5,6,7,8,9].map(c=>(
                    <div key={c} className="sk" style={{flex:1, height:22, animationDelay:(r*0.04+c*0.05)+'s'}}/>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <style>{`
            .sk {
              border-radius: 4px;
              background: linear-gradient(90deg, var(--slate-100) 0%, var(--slate-200) 50%, var(--slate-100) 100%);
              background-size: 200% 100%;
              animation: skShine 1.4s ease-in-out infinite;
            }
            @keyframes skShine { 0%{background-position: 200% 0;} 100%{background-position: -200% 0;} }
          `}</style>
        </div>
      </main>
    </div></div>
  );
}

Object.assign(window, { EmptyStates });
