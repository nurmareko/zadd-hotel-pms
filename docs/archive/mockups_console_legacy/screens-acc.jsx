// Accounting screens
function ACDashboard() {
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="acc" active="dashboard"/>
      <main className="zd-main">
        <Topbar crumbs={['Akuntansi','Dashboard']} user="Bambang S." userRole="Night Auditor"/>
        <div className="zd-content">
          <PageHeader title="Dashboard Akuntansi" sub="Status daily-close untuk business date 26 Apr 2026"
            actions={<button className="btn primary">{I.moon()} Mulai Night Audit</button>}/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16}}>
            <div className="kpi"><div className="label">Status Night Audit</div><div className="value" style={{fontSize:18, color:'var(--amber-600)'}}>PENDING</div><div className="delta">Belum dijalankan untuk hari ini</div></div>
            <div className="kpi"><div className="label">Estimasi Revenue</div><div className="value num">{fmtIDR(28450000)}</div><div className="delta up">+8% vs rata-rata 7 hari</div></div>
            <div className="kpi"><div className="label">Occupancy</div><div className="value num">78%</div><div className="delta">24 / 31 kamar</div></div>
            <div className="kpi"><div className="label">Posting Belum Flush</div><div className="value num" style={{color:'var(--red-600)'}}>3</div><div className="delta down">Perlu di-review</div></div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16}}>
            <div className="card">
              <div className="card-h"><h3>Riwayat Night Audit · 7 Hari Terakhir</h3></div>
              <table className="tbl">
                <thead><tr><th>Business Date</th><th>Auditor</th><th>Run At</th><th className="num">Revenue</th><th className="num">Occupancy</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {[
                    {d:'25 Apr 2026', a:'Bambang S.', t:'26 Apr 02:14', r:26200000, o:'74%', s:'COMPLETED'},
                    {d:'24 Apr 2026', a:'Bambang S.', t:'25 Apr 02:08', r:24850000, o:'71%', s:'COMPLETED'},
                    {d:'23 Apr 2026', a:'Maya I.', t:'24 Apr 02:31', r:27300000, o:'77%', s:'COMPLETED'},
                    {d:'22 Apr 2026', a:'Maya I.', t:'23 Apr 02:19', r:25100000, o:'72%', s:'COMPLETED'},
                    {d:'21 Apr 2026', a:'Bambang S.', t:'22 Apr 02:25', r:22400000, o:'68%', s:'COMPLETED'},
                  ].map((r,i)=>(<tr key={i}>
                    <td className="strong num">{r.d}</td><td>{r.a}</td><td className="num muted">{r.t}</td>
                    <td className="num strong">{fmtIDR(r.r)}</td><td className="num">{r.o}</td>
                    <td><Badge kind="paid">{r.s}</Badge></td>
                    <td><button className="btn sm">Lihat Report</button></td>
                  </tr>))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-h"><h3>Posting Belum Flush</h3><span className="meta" style={{color:'var(--red-600)'}}>3 perlu review</span></div>
              <div className="card-b" style={{padding:0}}>
                {[
                  {t:'Folio FOL-2304-0004', d:'Saldo belum nol — outstanding {fmtIDR(570000)}', s:'CHECK_OUT_INCOMPLETE'},
                  {t:'Order FB-2604-0023', d:'Status BILLED, belum dibayar', s:'PAYMENT_PENDING'},
                  {t:'Reservasi RSV-2604-0011', d:'No-show, belum dibatalkan otomatis', s:'NO_SHOW'},
                ].map((p,i)=>(<div key={i} style={{padding:'12px 14px', borderBottom: i<2?'1px solid var(--slate-100)':'none', display:'flex', gap:10, alignItems:'flex-start'}}>
                  <div style={{color:'var(--amber-600)', marginTop:2}}>{I.alert({s:14})}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600, fontSize:13}}>{p.t}</div>
                    <div className="muted" style={{fontSize:12, marginTop:2}}>{p.d.replace('{fmtIDR(570000)}', fmtIDR(570000))}</div>
                    <div style={{marginTop:6}}><Badge kind="vd">{p.s}</Badge></div>
                  </div>
                  <button className="btn sm">Resolve</button>
                </div>))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function ACAudit() {
  const checks = [
    {l:'Semua tamu in-house sudah ter-posting room charge hari ini', ok:true, c:'24 / 24 folio'},
    {l:'Semua F&B order ditutup atau dialihkan ke folio', ok:false, c:'2 order masih OPEN'},
    {l:'Semua check-out hari ini sudah zero-balance', ok:false, c:'1 folio belum lunas (FOL-2304-0004)'},
    {l:'Semua pembayaran sudah ter-record', ok:true, c:'17 transaksi'},
    {l:'Tidak ada reservasi no-show yang belum diproses', ok:false, c:'1 reservasi (RSV-2604-0011)'},
    {l:'Status kamar konsisten dengan folio aktif', ok:true, c:'31 / 31 kamar'},
  ];
  const ready = checks.every(c=>c.ok);
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="acc" active="audit"/>
      <main className="zd-main">
        <Topbar crumbs={['Akuntansi','Night Audit']} user="Bambang S." userRole="Night Auditor"/>
        <div className="zd-content">
          <PageHeader title="Night Audit" sub="Daily-close untuk business date 26 Apr 2026 → 27 Apr 2026"
            actions={<><button className="btn">Batal</button><button className="btn primary" disabled={!ready} style={!ready?{opacity:0.5, cursor:'not-allowed'}:{}}>{I.moon()} Run Night Audit</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:16}}>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Pre-check List</h3><span className="meta">{checks.filter(c=>c.ok).length} / {checks.length} sudah lulus</span></div>
                <div className="card-b" style={{padding:0}}>
                  {checks.map((c,i)=>(<div key={i} style={{padding:'12px 16px', borderBottom: i<checks.length-1?'1px solid var(--slate-100)':'none', display:'flex', alignItems:'center', gap:12}}>
                    <div style={{width:24, height:24, borderRadius:12, background: c.ok?'var(--emerald-50)':'var(--amber-50)', color: c.ok?'var(--emerald-600)':'var(--amber-600)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                      {c.ok ? I.check({s:14}) : I.alert({s:14})}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:500, color:'var(--slate-900)'}}>{c.l}</div>
                      <div className="muted" style={{fontSize:12, marginTop:2}}>{c.c}</div>
                    </div>
                    {!c.ok && <button className="btn sm">Resolve</button>}
                  </div>))}
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Tahapan Night Audit</h3></div>
                <div className="card-b" style={{padding:0}}>
                  {[
                    {l:'1. Posting room charge harian', d:'Charge dibuat untuk semua kamar OC.'},
                    {l:'2. Tutup F&B order yang masih OPEN', d:'Order tanpa pembayaran akan di-VOID.'},
                    {l:'3. Snapshot revenue per kategori', d:'Room, F&B, Service, Tax, Misc.'},
                    {l:'4. Increment business date', d:'Sistem berpindah ke 27 Apr 2026.'},
                    {l:'5. Generate Night Report (PDF)', d:'Report tersimpan dan dapat diunduh.'},
                  ].map((s,i)=>(<div key={i} style={{padding:'10px 16px', borderBottom: i<4?'1px solid var(--slate-100)':'none', display:'flex', gap:12, alignItems:'flex-start'}}>
                    <div style={{width:22, height:22, borderRadius:11, background:'var(--slate-100)', color:'var(--slate-700)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600}}>{i+1}</div>
                    <div><div style={{fontSize:13, fontWeight:500}}>{s.l}</div><div className="muted" style={{fontSize:12, marginTop:1}}>{s.d}</div></div>
                  </div>))}
                </div>
              </div>
            </div>
            <aside style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Status Saat Ini</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Business date</span><span className="strong num">26 Apr 2026</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Cut-off NA</span><span className="num">02:00</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Sekarang</span><span className="num">01:42</span></div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Kamar OC</span><span className="num">24</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Folio terbuka</span><span className="num">25</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">F&B order open</span><span className="num">2</span></div>
                </div>
              </div>
              <div className="card" style={{borderColor:'var(--amber-300, #fcd34d)', background:'var(--amber-50)'}}>
                <div className="card-b" style={{display:'flex', gap:10, alignItems:'flex-start'}}>
                  <div style={{color:'var(--amber-600)'}}>{I.alert({s:18})}</div>
                  <div style={{fontSize:12, color:'var(--slate-800)'}}>
                    <div style={{fontWeight:600, marginBottom:3}}>3 item perlu di-resolve.</div>
                    Anda tetap dapat menjalankan audit dengan force-flag, namun item ini akan tercatat sebagai exception pada Night Report.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function ACReport() {
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="acc" active="report"/>
      <main className="zd-main">
        <Topbar crumbs={['Akuntansi','Night Report','25 Apr 2026']} user="Bambang S." userRole="Night Auditor"/>
        <div className="zd-content">
          <PageHeader title="Night Report" sub="Business date 25 Apr 2026 · Run 26 Apr 02:14 oleh Bambang S."
            actions={<><select className="select sm" style={{width:160}}><option>25 Apr 2026</option><option>24 Apr 2026</option><option>23 Apr 2026</option></select><button className="btn">{I.printer()} Print</button><button className="btn primary">{I.download()} Export PDF</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16}}>
            <div className="kpi"><div className="label">Total Revenue</div><div className="value num">{fmtIDR(26200000)}</div><div className="delta up">+5.4% vs prev</div></div>
            <div className="kpi"><div className="label">Occupancy</div><div className="value num">74%</div><div className="delta">23 / 31 kamar</div></div>
            <div className="kpi"><div className="label">ARR</div><div className="value num">{fmtIDR(912000)}</div><div className="delta">Avg. room rate</div></div>
            <div className="kpi"><div className="label">RevPAR</div><div className="value num">{fmtIDR(845000)}</div><div className="delta up">+3.1% vs prev</div></div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:16}}>
            <div className="card">
              <div className="card-h"><h3>Revenue Breakdown</h3></div>
              <table className="tbl">
                <thead><tr><th>Kategori</th><th className="num">Transaksi</th><th className="num">Subtotal</th><th className="num">Service+Tax</th><th className="num">Total</th><th className="num">%</th></tr></thead>
                <tbody>
                  {[
                    {c:'Room Revenue', tx:23, st:19550000, t:0, share:74.6},
                    {c:'F&B — Main Course', tx:38, st:3100000, t:558000, share:14.0},
                    {c:'F&B — Beverage', tx:62, st:1240000, t:223200, share:5.6},
                    {c:'Laundry', tx:8, st:425000, t:0, share:1.6},
                    {c:'Minibar', tx:14, st:625000, t:0, share:2.4},
                    {c:'Service Charge', tx:'—', st:1140000, t:0, share:4.4},
                    {c:'Tax (PPN)', tx:'—', st:1881300, t:0, share:7.2},
                  ].map((r,i)=>(<tr key={i}>
                    <td className="strong">{r.c}</td>
                    <td className="num">{r.tx}</td>
                    <td className="num">{fmtIDR(r.st)}</td>
                    <td className="num muted">{r.t?fmtIDR(r.t):'—'}</td>
                    <td className="num strong">{fmtIDR(r.st+r.t)}</td>
                    <td className="num muted">{r.share}%</td>
                  </tr>))}
                </tbody>
                <tfoot>
                  <tr style={{background:'var(--slate-50)', fontWeight:700}}>
                    <td style={{padding:'10px 12px'}}>TOTAL</td><td className="num" style={{padding:'10px 12px'}}>145</td>
                    <td className="num" style={{padding:'10px 12px'}}>{fmtIDR(27961300)}</td>
                    <td className="num" style={{padding:'10px 12px'}}>{fmtIDR(781200)}</td>
                    <td className="num" style={{padding:'10px 12px'}}>{fmtIDR(26200000)}</td>
                    <td className="num" style={{padding:'10px 12px'}}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Occupancy</h3></div>
                <div className="card-b">
                  <div style={{display:'flex', alignItems:'flex-end', gap:6, height:80}}>
                    {[68,71,77,72,74,71,74].map((v,i)=>(<div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                      <div style={{width:'100%', background: i===6?'var(--slate-900)':'var(--slate-300)', height: v+'%', borderRadius:'3px 3px 0 0'}}/>
                      <div className="num" style={{fontSize:10, color:'var(--slate-500)'}}>{v}%</div>
                    </div>))}
                  </div>
                  <div style={{display:'flex', justifyContent:'space-between', marginTop:8, fontSize:10, color:'var(--slate-500)'}}>
                    {['19','20','21','22','23','24','25'].map(d=><span key={d}>{d} Apr</span>)}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Pembayaran</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span>Cash</span><span className="num">{fmtIDR(8420000)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span>Transfer</span><span className="num">{fmtIDR(11300000)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span>Card</span><span className="num">{fmtIDR(5180000)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span>Charge to Room</span><span className="num">{fmtIDR(1300000)}</span></div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', fontWeight:700}}><span>Total</span><span className="num">{fmtIDR(26200000)}</span></div>
                </div>
              </div>
            </div>
          </div>
          <div className="card" style={{marginTop:16}}>
            <div className="card-h"><h3>Daftar Tamu In-House (Snapshot)</h3><span className="meta">23 tamu</span></div>
            <table className="tbl">
              <thead><tr><th>Kamar</th><th>Tamu</th><th>Reservasi</th><th>Arrival</th><th>Departure</th><th>Malam</th><th className="num">Saldo</th></tr></thead>
              <tbody>
                {[
                  {r:'204', g:'Tomi Wijaya', n:'RSV-2304-0004', a:'23 Apr', d:'26 Apr', nt:3, b:570000},
                  {r:'201', g:'Andi Pratama', n:'RSV-2604-0012', a:'26 Apr', d:'29 Apr', nt:3, b:1050000},
                  {r:'105', g:'Lina Marlina', n:'RSV-2504-0007', a:'24 Apr', d:'26 Apr', nt:2, b:0},
                  {r:'301', g:'Hendra Kusuma', n:'RSV-2504-0008', a:'25 Apr', d:'26 Apr', nt:1, b:125000},
                ].map((r,i)=>(<tr key={i}>
                  <td className="strong">{r.r}</td><td>{r.g}</td><td className="mono">{r.n}</td>
                  <td className="num">{r.a}</td><td className="num">{r.d}</td><td className="num">{r.nt}</td>
                  <td className="num strong" style={{color:r.b>0?'var(--red-600)':'var(--slate-700)'}}>{fmtIDR(r.b)}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div></div>
  );
}

Object.assign(window, { ACDashboard, ACAudit, ACReport });
