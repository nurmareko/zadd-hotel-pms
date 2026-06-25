// Global screens: Login, Profile, 404
const { useState: useStateG } = React;

function Login() {
  return (
    <div className="zd" style={{display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(180deg, var(--slate-100), var(--slate-50))', height:'100%'}}>
      <div style={{width:380, padding:32, background:'white', border:'1px solid var(--slate-200)', borderRadius:8, boxShadow:'0 1px 3px rgba(15,23,42,0.04), 0 8px 28px rgba(15,23,42,0.06)'}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}>
          <div style={{width:36, height:36, borderRadius:7, background:'var(--slate-900)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16}}>Z</div>
          <div>
            <div style={{fontWeight:600, fontSize:15, color:'var(--slate-900)'}}>ZADD Hotel PMS</div>
            <div style={{fontSize:12, color:'var(--slate-500)'}}>Hotel Practicum System</div>
          </div>
        </div>
        <h1 style={{fontSize:18, margin:'0 0 4px', fontWeight:600}}>Masuk ke akun</h1>
        <p style={{fontSize:12, color:'var(--slate-500)', margin:'0 0 20px'}}>Gunakan akun praktikum yang diberikan oleh dosen pembimbing.</p>
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <Field label="Username" required><input type="text" defaultValue="dewi.wulandari"/></Field>
          <Field label="Password" required><input type="password" defaultValue="••••••••••"/></Field>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12}}>
            <label style={{display:'flex', alignItems:'center', gap:6, color:'var(--slate-700)', cursor:'pointer'}}>
              <input type="checkbox"/> Ingat saya
            </label>
            <a href="#" style={{color:'var(--slate-900)', textDecoration:'none', fontWeight:500}}>Lupa password?</a>
          </div>
          <button className="btn primary lg" style={{width:'100%', justifyContent:'center', marginTop:4}}>Masuk</button>
        </div>
        <div style={{marginTop:20, paddingTop:16, borderTop:'1px solid var(--slate-100)', fontSize:11, color:'var(--slate-500)', textAlign:'center'}}>
          Praktikum Sem. Genap 2025/2026 · Fakultas Hospitality
        </div>
      </div>
    </div>
  );
}

function Profile() {
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fo" active=""/>
      <main className="zd-main">
        <Topbar crumbs={['Akun', 'Profil']} />
        <div className="zd-content">
          <PageHeader title="Profil Saya" sub="Informasi akun dan ubah password."/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, maxWidth:780}}>
            <div className="card">
              <div className="card-h"><h3>Informasi Akun</h3></div>
              <div className="card-b">
                <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:16}}>
                  <div style={{width:56, height:56, borderRadius:28, background:'var(--slate-900)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:20}}>DW</div>
                  <div>
                    <div style={{fontSize:15, fontWeight:600}}>Dewi Wulandari</div>
                    <div style={{fontSize:12, color:'var(--slate-500)'}}>dewi.wulandari@hospitality.ac.id</div>
                    <div style={{marginTop:4}}><Badge kind="confirmed">Front Office</Badge></div>
                  </div>
                </div>
                <div className="form-grid">
                  <Field label="Nama lengkap"><input type="text" defaultValue="Dewi Wulandari"/></Field>
                  <Field label="Username"><input type="text" defaultValue="dewi.wulandari" disabled/></Field>
                  <Field label="Email" span><input type="email" defaultValue="dewi.wulandari@hospitality.ac.id"/></Field>
                </div>
              </div>
              <div className="card-f" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
                <button className="btn">Batal</button>
                <button className="btn primary">Simpan</button>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3>Ubah Password</h3></div>
              <div className="card-b" style={{display:'flex', flexDirection:'column', gap:14}}>
                <Field label="Password lama" required><input type="password" defaultValue="••••••••"/></Field>
                <Field label="Password baru" required hint="Minimal 8 karakter, mengandung huruf dan angka."><input type="password"/></Field>
                <Field label="Konfirmasi password baru" required><input type="password"/></Field>
              </div>
              <div className="card-f" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <button className="btn ghost" style={{color:'var(--red-600)'}}>{I.logout({s:14})} Logout</button>
                <button className="btn primary">Ubah Password</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function NotFound() {
  return (
    <div className="zd" style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', background:'var(--slate-50)'}}>
      <div style={{textAlign:'center', maxWidth:380}}>
        <div style={{fontSize:64, fontWeight:700, color:'var(--slate-300)', letterSpacing:'-0.04em', lineHeight:1}}>403</div>
        <h2 style={{margin:'12px 0 6px', fontSize:18, fontWeight:600}}>Akses Ditolak</h2>
        <p style={{fontSize:13, color:'var(--slate-500)', margin:'0 0 20px'}}>Akun Anda tidak memiliki izin untuk mengakses halaman ini. Hubungi administrator jika Anda merasa ini adalah kekeliruan.</p>
        <div style={{display:'flex', gap:8, justifyContent:'center'}}>
          <button className="btn">Kembali</button>
          <button className="btn primary">Ke Dashboard</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Login, Profile, NotFound });
