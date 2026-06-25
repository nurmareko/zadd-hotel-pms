// Front Office screens
const ROOMS = [
  {n:'101', t:'STD', f:1}, {n:'102', t:'STD', f:1}, {n:'103', t:'STD', f:1}, {n:'104', t:'STD', f:1}, {n:'105', t:'DLX', f:1},
  {n:'201', t:'STD', f:2}, {n:'202', t:'STD', f:2}, {n:'203', t:'DLX', f:2}, {n:'204', t:'DLX', f:2}, {n:'205', t:'DLX', f:2},
  {n:'301', t:'DLX', f:3}, {n:'302', t:'DLX', f:3}, {n:'303', t:'SUP', f:3}, {n:'304', t:'SUP', f:3}, {n:'305', t:'SUP', f:3},
];
const DAYS = ['26 Apr','27 Apr','28 Apr','29 Apr','30 Apr','01 Mei','02 Mei','03 Mei','04 Mei','05 Mei','06 Mei','07 Mei','08 Mei','09 Mei'];

function FODashboard() {
  const kpis = [
    {label:'Arrivals Hari Ini', value:'12', delta:'8 sudah check-in · 4 belum'},
    {label:'Departures Hari Ini', value:'9', delta:'5 sudah check-out · 4 in-house'},
    {label:'In-House Guests', value:'34', delta:'+3 vs kemarin'},
    {label:'Occupancy', value:'78%', delta:'24 / 31 kamar terisi'},
  ];
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fo" active="dashboard"/>
      <main className="zd-main">
        <Topbar crumbs={['Front Office', 'Dashboard']} />
        <div className="zd-content">
          <PageHeader title="Dashboard Front Office" sub="Selasa, 26 Apr 2026 · Shift Pagi (06:00 - 14:00)"
            actions={<><button className="btn">{I.refresh()} Refresh</button><button className="btn primary">{I.plus()} Reservasi Baru</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16}}>
            {kpis.map((k,i)=>(<div key={i} className="kpi"><div className="label">{k.label}</div><div className="value num">{k.value}</div><div className="delta">{k.delta}</div></div>))}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16}}>
            <div className="card">
              <div className="card-h"><h3>Expected Arrivals · Hari Ini</h3><span className="meta">12 reservasi</span></div>
              <table className="tbl">
                <thead><tr><th>Reservasi</th><th>Tamu</th><th>Tipe</th><th>Malam</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {[
                    {r:'RSV-2604-0012', g:'Andi Pratama', t:'Deluxe', n:3, s:'CHECKED_IN'},
                    {r:'RSV-2604-0013', g:'Siti Nuraini', t:'Standard', n:2, s:'CONFIRMED'},
                    {r:'RSV-2604-0014', g:'Budi Santoso', t:'Superior', n:4, s:'CONFIRMED'},
                    {r:'RSV-2604-0015', g:'Melati Hartono', t:'Deluxe', n:1, s:'CHECKED_IN'},
                    {r:'RSV-2604-0016', g:'Rizal Maulana', t:'Standard', n:2, s:'CONFIRMED'},
                  ].map((r,i)=>(
                    <tr key={i}><td className="strong mono" style={{color:'var(--slate-900)'}}>{r.r}</td><td>{r.g}</td><td>{r.t}</td>
                      <td className="num">{r.n}</td>
                      <td><Badge kind={r.s==='CONFIRMED'?'confirmed':'checked-in'}>{r.s==='CONFIRMED'?'Confirmed':'Checked In'}</Badge></td>
                      <td><button className="btn sm">{r.s==='CONFIRMED'?'Check-in':'Folio'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Departures · Hari Ini</h3><span className="meta">9 reservasi</span></div>
                <div className="card-b" style={{padding:0}}>
                  <table className="tbl">
                    <thead><tr><th>Kamar</th><th>Tamu</th><th className="num">Saldo</th></tr></thead>
                    <tbody>
                      <tr><td className="strong">204</td><td>Hendra Kusuma</td><td className="num" style={{color:'var(--red-600)'}}>{fmtIDR(450000)}</td></tr>
                      <tr><td className="strong">105</td><td>Lina Marlina</td><td className="num">{fmtIDR(0)}</td></tr>
                      <tr><td className="strong">301</td><td>Tomi Wijaya</td><td className="num" style={{color:'var(--red-600)'}}>{fmtIDR(125000)}</td></tr>
                      <tr><td className="strong">102</td><td>Sari Indah</td><td className="num">{fmtIDR(0)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Status Kamar</h3></div>
                <div className="card-b" style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8}}>
                  {[['VC','Vacant Clean',8,'vc'],['OC','Occupied',24,'oc'],['VD','Vacant Dirty',5,'vd'],['OD','Occ. Dirty',2,'od'],['OOO','OOO',1,'ooo']].map(([k,l,n,b])=>(
                    <div key={k} style={{textAlign:'center', padding:'10px 6px', border:'1px solid var(--slate-200)', borderRadius:5}}>
                      <div className="num" style={{fontSize:20, fontWeight:600}}>{n}</div>
                      <div style={{marginTop:4}}><Badge kind={b}>{k}</Badge></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function FOTapeChart() {
  // build a deterministic occupancy grid
  const grid = ROOMS.map((r,ri)=>DAYS.map((_,di)=>{
    const seed=(ri*7+di*3)%17;
    if(seed<5) return {s:'OC', g: ['Andi P.','Siti N.','Hendra K.','Tomi W.','Lina M.','Budi S.'][seed%6]};
    if(seed<7) return {s:'VD'};
    if(seed===8) return {s:'OOO', g:'Andi P.'};
    return {s:'VC'};
  }));
  const colors = {VC:{bg:'var(--emerald-50)', br:'var(--emerald-500)'}, OC:{bg:'var(--blue-50)', br:'var(--blue-500)', txt:'var(--blue-700)'}, VD:{bg:'var(--amber-50)', br:'var(--amber-500)'}, OD:{bg:'var(--red-50)', br:'var(--red-500)'}, OOO:{bg:'var(--slate-100)', br:'var(--slate-500)'}};
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fo" active="tape"/>
      <main className="zd-main">
        <Topbar crumbs={['Front Office','Tape Chart']}/>
        <div className="zd-content" style={{padding:'16px 20px'}}>
          <PageHeader title="Tape Chart" sub="Klik sel kosong untuk membuat reservasi · Klik sel terisi untuk membuka folio."
            actions={<>
              <div style={{display:'flex', alignItems:'center', gap:6, marginRight:8}}>
                <button className="btn icon">{I.chevL()}</button>
                <div className="btn" style={{padding:'0 14px'}}><span className="num">26 Apr - 09 Mei 2026</span></div>
                <button className="btn icon">{I.chev()}</button>
              </div>
              <button className="btn">Hari Ini</button>
              <button className="btn primary">{I.plus()} Reservasi Baru</button>
            </>}/>
          <div style={{display:'flex', gap:12, marginBottom:12, fontSize:12, alignItems:'center'}}>
            <span className="muted">Legenda:</span>
            <Badge kind="vc">VC · Vacant Clean</Badge>
            <Badge kind="oc">OC · Occupied</Badge>
            <Badge kind="vd">VD · Vacant Dirty</Badge>
            <Badge kind="od">OD · Occupied Dirty</Badge>
            <Badge kind="ooo">OOO · Out of Order</Badge>
            <span style={{marginLeft:'auto'}} className="muted">31 kamar · 14 hari</span>
          </div>
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div className="scroll" style={{overflow:'auto', maxHeight:520}}>
              <table style={{borderCollapse:'separate', borderSpacing:0, fontSize:12, width:'100%'}}>
                <thead>
                  <tr>
                    <th style={{position:'sticky', left:0, top:0, zIndex:3, background:'var(--slate-50)', borderRight:'1px solid var(--slate-200)', borderBottom:'1px solid var(--slate-200)', padding:'8px 10px', textAlign:'left', minWidth:120, fontSize:11, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.04em'}}>Kamar</th>
                    {DAYS.map((d,i)=>(<th key={i} style={{position:'sticky', top:0, zIndex:2, background:'var(--slate-50)', borderBottom:'1px solid var(--slate-200)', padding:'6px 4px', minWidth:64, fontSize:11, fontWeight:600, color: i===0?'var(--slate-900)':'var(--slate-500)'}}>
                      <div style={{fontSize:10, color:'var(--slate-500)', textTransform:'uppercase'}}>{['Sel','Rab','Kam','Jum','Sab','Min','Sen','Sel','Rab','Kam','Jum','Sab','Min','Sen'][i]}</div>
                      <div className="num">{d}</div>
                    </th>))}
                  </tr>
                </thead>
                <tbody>
                  {ROOMS.map((r,ri)=>(
                    <tr key={ri}>
                      <td style={{position:'sticky', left:0, zIndex:1, background:'white', borderRight:'1px solid var(--slate-200)', borderBottom:'1px solid var(--slate-100)', padding:'6px 10px', whiteSpace:'nowrap'}}>
                        <span style={{fontWeight:600, color:'var(--slate-900)'}}>{r.n}</span>
                        <span className="muted" style={{marginLeft:6, fontSize:11}}>{r.t}</span>
                      </td>
                      {grid[ri].map((c,ci)=>{
                        const col=colors[c.s];
                        return <td key={ci} style={{borderBottom:'1px solid var(--slate-100)', borderRight:'1px solid var(--slate-100)', padding:0, height:32}}>
                          <div style={{height:'100%', margin:2, background:col.bg, borderLeft:'3px solid '+col.br, borderRadius:3, padding:'4px 6px', fontSize:11, fontWeight:500, color:col.txt||'var(--slate-700)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                            {c.g || c.s}
                          </div>
                        </td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function FOResList() {
  const rows = [
    {n:'RSV-2604-0012', g:'Andi Pratama', t:'Deluxe', a:'26 Apr 2026', d:'29 Apr 2026', s:'CHECKED_IN', dep:1500000, rate:850000},
    {n:'RSV-2604-0013', g:'Siti Nuraini', t:'Standard', a:'26 Apr 2026', d:'28 Apr 2026', s:'CONFIRMED', dep:500000, rate:550000},
    {n:'RSV-2604-0014', g:'Budi Santoso', t:'Superior', a:'26 Apr 2026', d:'30 Apr 2026', s:'CONFIRMED', dep:0, rate:1250000},
    {n:'RSV-2504-0008', g:'Hendra Kusuma', t:'Deluxe', a:'25 Apr 2026', d:'26 Apr 2026', s:'CHECKED_IN', dep:1000000, rate:850000},
    {n:'RSV-2504-0007', g:'Lina Marlina', t:'Deluxe', a:'24 Apr 2026', d:'26 Apr 2026', s:'CHECKED_IN', dep:850000, rate:850000},
    {n:'RSV-2304-0004', g:'Tomi Wijaya', t:'Deluxe', a:'23 Apr 2026', d:'26 Apr 2026', s:'CHECKED_IN', dep:1700000, rate:850000},
    {n:'RSV-2304-0003', g:'Sari Indah', t:'Standard', a:'24 Apr 2026', d:'26 Apr 2026', s:'CHECKED_OUT', dep:1100000, rate:550000},
    {n:'RSV-2204-0001', g:'Rina Anggraini', t:'Superior', a:'22 Apr 2026', d:'25 Apr 2026', s:'CHECKED_OUT', dep:3750000, rate:1250000},
    {n:'RSV-2104-0014', g:'Anton Wibowo', t:'Standard', a:'27 Apr 2026', d:'29 Apr 2026', s:'CANCELLED', dep:0, rate:550000},
  ];
  const sm = {CONFIRMED:'confirmed', CHECKED_IN:'checked-in', CHECKED_OUT:'checked-out', CANCELLED:'cancelled'};
  const lbl = {CONFIRMED:'Confirmed', CHECKED_IN:'Checked In', CHECKED_OUT:'Checked Out', CANCELLED:'Cancelled'};
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fo" active="res-list"/>
      <main className="zd-main">
        <Topbar crumbs={['Front Office','Reservasi']}/>
        <div className="zd-content">
          <PageHeader title="Daftar Reservasi" sub="Semua reservasi aktif dan historis."
            actions={<><button className="btn">{I.download()} Export CSV</button><button className="btn primary">{I.plus()} Reservasi Baru</button></>}/>
          <div className="card" style={{padding:0}}>
            <div className="tbl-filters">
              <div className="search">{I.search({s:14})}<input placeholder="Cari nomor reservasi atau nama tamu…"/></div>
              <select className="select sm" style={{width:140}} defaultValue="ALL"><option value="ALL">Semua Status</option><option>Confirmed</option><option>Checked In</option><option>Checked Out</option><option>Cancelled</option></select>
              <select className="select sm" style={{width:140}}><option>Semua Tipe</option><option>Standard</option><option>Deluxe</option><option>Superior</option></select>
              <input className="input sm" type="date" defaultValue="2026-04-26" style={{width:140}}/>
              <span style={{color:'var(--slate-400)'}}>—</span>
              <input className="input sm" type="date" defaultValue="2026-05-09" style={{width:140}}/>
              <span className="grow"/>
              <span className="count num">{rows.length} hasil</span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="sorted">No. Reservasi {I.caretUp()}</th>
                  <th>Tamu</th><th>Tipe Kamar</th>
                  <th>Arrival</th><th>Departure</th>
                  <th className="num">Rate / Mlm</th>
                  <th className="num">Deposit</th>
                  <th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>(<tr key={i}>
                  <td className="mono strong">{r.n}</td>
                  <td className="strong">{r.g}</td>
                  <td>{r.t}</td>
                  <td className="num">{r.a}</td>
                  <td className="num">{r.d}</td>
                  <td className="num">{fmtIDR(r.rate)}</td>
                  <td className="num">{fmtIDR(r.dep)}</td>
                  <td><Badge kind={sm[r.s]}>{lbl[r.s]}</Badge></td>
                  <td style={{textAlign:'right'}}><button className="btn ghost sm">{I.more()}</button></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function FOResForm() {
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fo" active="res-new"/>
      <main className="zd-main">
        <Topbar crumbs={['Front Office','Reservasi','Reservasi Baru']}/>
        <div className="zd-content">
          <PageHeader title="Reservasi Baru" sub="Isi data tamu dan periode menginap untuk membuat reservasi."
            actions={<><button className="btn">Batal</button><button className="btn primary">Simpan Reservasi</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:16}}>
            <div className="card">
              <div className="card-b" style={{padding:20}}>
                <h4 style={{margin:'0 0 12px', fontSize:12, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600}}>Data Tamu</h4>
                <div className="form-grid">
                  <Field label="Nama lengkap" required><input type="text" defaultValue="Andi Pratama"/></Field>
                  <Field label="Nomor identitas (KTP/Paspor)" required><input type="text" defaultValue="3201080912880001"/></Field>
                  <Field label="Telepon" required><input type="text" defaultValue="+62 812 3456 7890"/></Field>
                  <Field label="Email"><input type="email" defaultValue="andi.p@example.com"/></Field>
                  <Field label="Kewarganegaraan"><input type="text" defaultValue="Indonesia"/></Field>
                  <Field label="Alamat" span><textarea defaultValue="Jl. Sudirman No. 123, Jakarta Selatan"/></Field>
                </div>
                <div className="form-section">
                  <h4>Detail Reservasi</h4>
                  <div className="form-grid">
                    <Field label="Arrival" required><input type="date" defaultValue="2026-04-28"/></Field>
                    <Field label="Departure" required><input type="date" defaultValue="2026-05-01"/></Field>
                    <Field label="Tipe kamar" required><select defaultValue="DLX"><option value="STD">Standard — Rp 550.000/mlm</option><option value="DLX">Deluxe — Rp 850.000/mlm</option><option value="SUP">Superior — Rp 1.250.000/mlm</option></select></Field>
                    <Field label="Jumlah tamu" required>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                        <input type="number" defaultValue="2" placeholder="Dewasa"/>
                        <input type="number" defaultValue="0" placeholder="Anak"/>
                      </div>
                    </Field>
                    <Field label="Deposit"><input type="text" className="num" defaultValue="1.500.000"/></Field>
                    <Field label="Tujuan kunjungan"><select defaultValue="leisure"><option value="business">Business</option><option value="leisure">Leisure</option><option value="event">Event</option></select></Field>
                    <Field label="Catatan" span><textarea placeholder="Permintaan khusus, mis. high floor, late arrival, dll." defaultValue="Permintaan extra bed (anak), late check-in jam 22:00."/></Field>
                  </div>
                </div>
              </div>
            </div>
            <aside style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Ringkasan Tarif</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Tipe</span><span>Deluxe</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Rate / malam</span><span className="num">{fmtIDR(850000)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Jumlah malam</span><span className="num">3</span></div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span>Subtotal kamar</span><span className="num">{fmtIDR(2550000)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Deposit</span><span className="num">{fmtIDR(1500000)}</span></div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0', fontWeight:600, fontSize:14}}><span>Estimasi tagihan</span><span className="num">{fmtIDR(2550000)}</span></div>
                  <div className="hint" style={{marginTop:6}}>Pajak {(11)}% dan service charge {(7)}% akan dihitung saat check-out.</div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Ketersediaan</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div style={{padding:'8px 10px', background:'var(--emerald-50)', borderRadius:5, color:'var(--emerald-700)', fontWeight:500, display:'flex', alignItems:'center', gap:8}}>
                    {I.check()} 4 kamar Deluxe tersedia
                  </div>
                  <div className="hint" style={{marginTop:8}}>Penetapan kamar fisik dilakukan saat check-in.</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function FOCheckin() {
  const avail = [{n:'203', f:2}, {n:'204', f:2, sel:true}, {n:'205', f:2}, {n:'301', f:3}];
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fo" active="checkin"/>
      <main className="zd-main">
        <Topbar crumbs={['Front Office','Check-in','RSV-2604-0013']}/>
        <div className="zd-content">
          <PageHeader title="Check-in · Siti Nuraini" sub="RSV-2604-0013 · Standard · 26 Apr → 28 Apr 2026 (2 malam)"
            actions={<><button className="btn">Batal</button><button className="btn primary">Konfirmasi Check-in</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:16}}>
            <div style={{display:'flex', flexDirection:'column', gap:16}}>
              <div className="card">
                <div className="card-h"><h3>1. Pilih Kamar</h3><span className="meta">Tipe: Standard</span></div>
                <div className="card-b">
                  <div style={{display:'flex', gap:8, marginBottom:10}}>
                    <select className="select sm" style={{width:120}} defaultValue=""><option value="">Semua lantai</option><option>Lantai 1</option><option>Lantai 2</option></select>
                    <span className="grow"/>
                    <span className="count" style={{fontSize:12, color:'var(--slate-500)', alignSelf:'center'}}>{avail.length} kamar tersedia</span>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8}}>
                    {['101','102','103','104','201','202'].map((n,i)=>{
                      const sel=n==='102';
                      return <button key={i} className="btn" style={{height:64, flexDirection:'column', gap:2, ...(sel?{borderColor:'var(--slate-900)', background:'var(--slate-900)', color:'white'}:{})}}>
                        <span style={{fontSize:15, fontWeight:600}}>{n}</span>
                        <span style={{fontSize:10, opacity:.8}}>Lt. {n[0]} · VC</span>
                      </button>;
                    })}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>2. Guest Registration Card (GRC)</h3></div>
                <div className="card-b">
                  <div className="form-grid">
                    <Field label="Nama lengkap" required><input type="text" defaultValue="Siti Nuraini"/></Field>
                    <Field label="Nomor identitas" required><input type="text" defaultValue="3578121205900003"/></Field>
                    <Field label="Telepon" required><input type="text" defaultValue="+62 813 9876 5432"/></Field>
                    <Field label="Email"><input type="email" defaultValue="siti.n@example.com"/></Field>
                    <Field label="Kewarganegaraan"><input type="text" defaultValue="Indonesia"/></Field>
                    <Field label="Tujuan kunjungan" required><select defaultValue="business"><option value="business">Business</option><option value="leisure">Leisure</option><option value="event">Event</option></select></Field>
                    <Field label="Alamat" span><textarea defaultValue="Jl. Diponegoro No. 45, Surabaya"/></Field>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>3. Deposit & Pembayaran Awal</h3></div>
                <div className="card-b">
                  <div className="form-grid">
                    <Field label="Jumlah deposit"><input type="text" className="num" defaultValue="500.000"/></Field>
                    <Field label="Metode"><select defaultValue="cash"><option value="cash">Cash</option><option value="transfer">Transfer</option><option value="card">Kartu Kredit/Debit</option></select></Field>
                    <Field label="Referensi (opsional)" span><input type="text" placeholder="Nomor transaksi, last-4 kartu, dsb."/></Field>
                  </div>
                </div>
              </div>
            </div>
            <aside>
              <div className="card">
                <div className="card-h"><h3>Ringkasan</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Reservasi</span><span className="mono strong">RSV-2604-0013</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Tamu</span><span>Siti Nuraini</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Tipe</span><span>Standard</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Kamar</span><span className="strong">102</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Periode</span><span>26 Apr → 28 Apr</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Malam</span><span className="num">2</span></div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span>Subtotal kamar</span><span className="num">{fmtIDR(1100000)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Deposit awal</span><span className="num">{fmtIDR(500000)}</span></div>
                </div>
                <div className="card-f" style={{fontSize:12, color:'var(--slate-600)'}}>Folio akan otomatis dibuka setelah check-in.</div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function FOFolio() {
  const items = [
    {d:'25 Apr 06:00', a:'ROOM-CHG', desc:'Room charge — Deluxe 204', q:1, p:850000},
    {d:'25 Apr 12:34', a:'FB-LUNCH', desc:'F&B Charge — Order #FB-2504-0023', q:1, p:185000},
    {d:'25 Apr 19:11', a:'FB-DINNER', desc:'F&B Charge — Order #FB-2504-0029', q:1, p:265000},
    {d:'26 Apr 06:00', a:'ROOM-CHG', desc:'Room charge — Deluxe 204', q:1, p:850000},
    {d:'26 Apr 09:42', a:'LAUNDRY', desc:'Laundry — 5 pcs', q:1, p:75000},
    {d:'26 Apr 11:15', a:'MINIBAR', desc:'Minibar — soft drinks', q:1, p:45000},
  ];
  const pays = [{d:'24 Apr 14:20', m:'TRANSFER', ref:'BCA-2504-XYZ', a:1700000, by:'Dewi W.'}];
  const sub = items.reduce((s,i)=>s+i.q*i.p,0);
  const paid = pays.reduce((s,p)=>s+p.a,0);
  const bal = sub - paid;
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fo" active="folio"/>
      <main className="zd-main">
        <Topbar crumbs={['Front Office','Guest Folio','FOL-2304-0004']}/>
        <div className="zd-content">
          <PageHeader title="Guest Folio · Tomi Wijaya" sub="FOL-2304-0004 · Kamar 204 (Deluxe) · 23 → 26 Apr 2026"
            actions={<><button className="btn">{I.download()} PDF Bill</button><button className="btn">{I.plus()} Manual Charge</button><button className="btn primary">{I.plus()} Record Payment</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:16}}>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h">
                  <h3>Charges</h3>
                  <div style={{display:'flex', gap:6}}>
                    <span className="meta num">{items.length} line items</span>
                    <Badge kind="open">Open</Badge>
                  </div>
                </div>
                <table className="tbl">
                  <thead><tr><th>Tanggal</th><th>Code</th><th>Deskripsi</th><th className="num">Qty</th><th className="num">Harga</th><th className="num">Jumlah</th><th></th></tr></thead>
                  <tbody>
                    {items.map((it,i)=>(<tr key={i}>
                      <td className="num muted">{it.d}</td>
                      <td className="mono">{it.a}</td>
                      <td className="strong">{it.desc}</td>
                      <td className="num">{it.q}</td>
                      <td className="num">{fmtIDR(it.p)}</td>
                      <td className="num strong">{fmtIDR(it.q*it.p)}</td>
                      <td style={{textAlign:'right'}}><button className="btn ghost sm">{I.more()}</button></td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <div className="card-h"><h3>Payments</h3><span className="meta num">{pays.length} pembayaran</span></div>
                <table className="tbl">
                  <thead><tr><th>Tanggal</th><th>Metode</th><th>Referensi</th><th>Diterima oleh</th><th className="num">Jumlah</th></tr></thead>
                  <tbody>
                    {pays.map((p,i)=>(<tr key={i}>
                      <td className="num muted">{p.d}</td>
                      <td><Badge kind="paid">{p.m}</Badge></td>
                      <td className="mono">{p.ref}</td>
                      <td>{p.by}</td>
                      <td className="num strong">{fmtIDR(p.a)}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            </div>
            <aside style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Tamu</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div style={{fontWeight:600, fontSize:14}}>Tomi Wijaya</div>
                  <div className="muted" style={{marginTop:2}}>+62 821 5566 7788</div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', padding:'3px 0'}}><span className="muted">Reservasi</span><span className="mono">RSV-2304-0004</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'3px 0'}}><span className="muted">Status</span><Badge kind="checked-in">Checked In</Badge></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'3px 0'}}><span className="muted">Periode</span><span>23 → 26 Apr</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'3px 0'}}><span className="muted">Malam</span><span className="num">3</span></div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Saldo</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Total charges</span><span className="num">{fmtIDR(sub)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Total payments</span><span className="num">−{fmtIDR(paid)}</span></div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0', fontSize:15, fontWeight:600}}><span>Saldo terhutang</span><span className="num" style={{color:bal>0?'var(--red-600)':'var(--emerald-600)'}}>{fmtIDR(bal)}</span></div>
                </div>
                <div className="card-f" style={{display:'flex', gap:6}}>
                  <button className="btn primary" style={{flex:1, justifyContent:'center'}}>Lanjut ke Check-out</button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function FOCheckout() {
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fo" active="checkout"/>
      <main className="zd-main">
        <Topbar crumbs={['Front Office','Check-out','FOL-2304-0004']}/>
        <div className="zd-content">
          <PageHeader title="Check-out · Tomi Wijaya" sub="FOL-2304-0004 · Kamar 204 (Deluxe) · Departure 26 Apr 2026"
            actions={<><button className="btn">Batal</button><button className="btn primary">{I.check()} Konfirmasi Check-out</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 360px', gap:16}}>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>1. Verifikasi Zero-Balance</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, border:'1px solid var(--slate-200)', borderRadius:5, overflow:'hidden'}}>
                    <div style={{padding:'12px 14px', borderRight:'1px solid var(--slate-200)'}}>
                      <div className="muted" style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600}}>Total Charges</div>
                      <div className="num" style={{fontSize:20, fontWeight:600, marginTop:4}}>{fmtIDR(2270000)}</div>
                    </div>
                    <div style={{padding:'12px 14px'}}>
                      <div className="muted" style={{fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600}}>Total Payments</div>
                      <div className="num" style={{fontSize:20, fontWeight:600, marginTop:4}}>{fmtIDR(1700000)}</div>
                    </div>
                  </div>
                  <div style={{marginTop:12, padding:'14px 16px', borderRadius:5, background:'var(--red-50)', border:'1px solid var(--red-200, #fecaca)', display:'flex', alignItems:'center', gap:10}}>
                    {I.alert({s:18})}
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600, color:'var(--red-700)'}}>Saldo belum nol — outstanding {fmtIDR(570000)}</div>
                      <div style={{fontSize:12, color:'var(--red-600)', marginTop:2}}>Lakukan pembayaran akhir di langkah 2 sebelum check-out dapat diselesaikan.</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>2. Pembayaran Akhir</h3><span className="meta">Outstanding: {fmtIDR(570000)}</span></div>
                <div className="card-b">
                  <div className="form-grid">
                    <Field label="Jumlah" required><input type="text" className="num" defaultValue="570.000"/></Field>
                    <Field label="Metode" required>
                      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6}}>
                        <button className="btn">Cash</button>
                        <button className="btn primary">Transfer</button>
                        <button className="btn">Card</button>
                      </div>
                    </Field>
                    <Field label="Referensi pembayaran" span><input type="text" defaultValue="BCA-2604-AB1290"/></Field>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>3. Aksi Setelah Check-out</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <label style={{display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0'}}><input type="checkbox" defaultChecked style={{marginTop:3}}/><div><div style={{fontWeight:500}}>Set status kamar 204 → Vacant Dirty (VD)</div><div className="muted" style={{fontSize:12}}>Otomatis dikirim ke Housekeeping.</div></div></label>
                  <label style={{display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0'}}><input type="checkbox" defaultChecked style={{marginTop:3}}/><div><div style={{fontWeight:500}}>Tutup folio (FOL-2304-0004)</div><div className="muted" style={{fontSize:12}}>Charge tidak dapat ditambahkan setelah folio ditutup.</div></div></label>
                  <label style={{display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0'}}><input type="checkbox" defaultChecked style={{marginTop:3}}/><div><div style={{fontWeight:500}}>Generate PDF bill</div><div className="muted" style={{fontSize:12}}>File diunduh otomatis setelah konfirmasi.</div></div></label>
                </div>
              </div>
            </div>
            <aside>
              <div className="card">
                <div className="card-h"><h3>Preview Bill</h3></div>
                <div className="card-b" style={{fontSize:12}}>
                  <div style={{textAlign:'center', paddingBottom:10, borderBottom:'1px dashed var(--slate-300)'}}>
                    <div style={{fontWeight:700, fontSize:13}}>HOTEL PRAKTIKUM ZADD</div>
                    <div className="muted" style={{fontSize:11}}>Jl. Hospitality No. 1 · Bandung</div>
                  </div>
                  <div style={{padding:'8px 0', display:'flex', justifyContent:'space-between'}}><span className="muted">Folio</span><span className="mono">FOL-2304-0004</span></div>
                  <div style={{padding:'2px 0', display:'flex', justifyContent:'space-between'}}><span className="muted">Tamu</span><span>Tomi Wijaya</span></div>
                  <div style={{padding:'2px 0', display:'flex', justifyContent:'space-between'}}><span className="muted">Kamar</span><span>204 / Deluxe</span></div>
                  <div style={{padding:'2px 0 8px', display:'flex', justifyContent:'space-between'}}><span className="muted">Periode</span><span>23–26 Apr 2026</span></div>
                  <div style={{borderTop:'1px dashed var(--slate-300)', paddingTop:8}}>
                    {[['Room charge × 3', 2550000],['F&B charges',450000],['Laundry',75000],['Minibar',45000],['Service charge 7%',221900],['VAT 11%',373593]].map(([l,v],i)=>(
                      <div key={i} style={{padding:'2px 0', display:'flex', justifyContent:'space-between'}}><span>{l}</span><span className="num">{fmtIDR(v)}</span></div>
                    ))}
                  </div>
                  <div style={{borderTop:'1px solid var(--slate-300)', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:13}}>
                    <span>TOTAL</span><span className="num">{fmtIDR(3715493)}</span>
                  </div>
                  <div style={{marginTop:6, display:'flex', justifyContent:'space-between'}}><span className="muted">Dibayar</span><span className="num">−{fmtIDR(1700000)}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', fontWeight:600, color:'var(--red-600)'}}><span>Outstanding</span><span className="num">{fmtIDR(570000)}</span></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div></div>
  );
}

Object.assign(window, { FODashboard, FOTapeChart, FOResList, FOResForm, FOCheckin, FOFolio, FOCheckout });
