// Admin screens
function ADUsers() {
  const users = [
    {u:'dewi.wulandari', n:'Dewi Wulandari', e:'dewi.w@hospitality.ac.id', r:'FO', a:true, l:'2 jam lalu'},
    {u:'bambang.setiawan', n:'Bambang Setiawan', e:'bambang.s@hospitality.ac.id', r:'ACC', a:true, l:'30 menit lalu'},
    {u:'rina.anggraini', n:'Rina Anggraini', e:'rina.a@hospitality.ac.id', r:'FB', a:true, l:'15 menit lalu'},
    {u:'sumarno', n:'Sumarno', e:'sumarno@hospitality.ac.id', r:'HK', a:true, l:'1 jam lalu'},
    {u:'maya.indah', n:'Maya Indah', e:'maya.i@hospitality.ac.id', r:'ACC', a:true, l:'kemarin'},
    {u:'joko.purnomo', n:'Joko Purnomo', e:'joko.p@hospitality.ac.id', r:'FB', a:true, l:'3 jam lalu'},
    {u:'siti.handayani', n:'Siti Handayani', e:'siti.h@hospitality.ac.id', r:'FO', a:false, l:'3 minggu lalu'},
    {u:'pak.dosen', n:'Dr. Hendra Wijaya', e:'hendra.w@hospitality.ac.id', r:'ADMIN', a:true, l:'baru saja'},
  ];
  const rl = {FO:['var(--blue-50)','var(--blue-700)'], HK:['var(--amber-50)','var(--amber-600)'], FB:['var(--emerald-50)','var(--emerald-700)'], ACC:['var(--slate-100)','var(--slate-700)'], ADMIN:['var(--red-50)','var(--red-600)']};
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="admin" active="users"/>
      <main className="zd-main">
        <Topbar crumbs={['Admin','Pengguna']} user="Hendra W." userRole="Administrator"/>
        <div className="zd-content">
          <PageHeader title="Pengelolaan Pengguna" sub="Kelola akun praktikum dan penetapan role."
            actions={<><button className="btn">{I.download()} Export</button><button className="btn primary">{I.plus()} Tambah Pengguna</button></>}/>
          <div className="card" style={{padding:0}}>
            <div className="tbl-filters">
              <div className="search">{I.search({s:14})}<input placeholder="Cari nama, username, atau email…"/></div>
              <select className="select sm" style={{width:130}}><option>Semua Role</option><option>FO</option><option>HK</option><option>FB</option><option>ACC</option><option>ADMIN</option></select>
              <select className="select sm" style={{width:130}}><option>Semua Status</option><option>Aktif</option><option>Nonaktif</option></select>
              <span className="grow"/>
              <span className="count num">{users.length} pengguna</span>
            </div>
            <table className="tbl">
              <thead><tr><th>Nama</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Login Terakhir</th><th></th></tr></thead>
              <tbody>{users.map((u,i)=>{
                const c = rl[u.r];
                return <tr key={i}>
                  <td><div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div style={{width:28, height:28, borderRadius:14, background:'var(--slate-200)', color:'var(--slate-700)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:11}}>{u.n.split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
                    <span className="strong">{u.n}</span>
                  </div></td>
                  <td className="mono">{u.u}</td>
                  <td className="muted">{u.e}</td>
                  <td><span style={{display:'inline-flex', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600, background:c[0], color:c[1]}}>{u.r}</span></td>
                  <td>{u.a ? <Badge kind="paid">Aktif</Badge> : <Badge kind="closed">Nonaktif</Badge>}</td>
                  <td className="muted num">{u.l}</td>
                  <td style={{textAlign:'right'}}><button className="btn ghost sm">{I.edit()}</button><button className="btn ghost sm">{I.more()}</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function ADRooms() {
  const types = [{c:'STD', n:'Standard', cap:2, r:550000, ct:8},{c:'DLX', n:'Deluxe', cap:2, r:850000, ct:14},{c:'SUP', n:'Superior', cap:3, r:1250000, ct:9}];
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="admin" active="rooms"/>
      <main className="zd-main">
        <Topbar crumbs={['Admin','Kamar & Tipe']} user="Hendra W." userRole="Administrator"/>
        <div className="zd-content">
          <PageHeader title="Kamar & Tipe Kamar" sub="Definisikan tipe kamar (dengan tarif inline) dan daftarkan kamar individual."
            actions={<><button className="btn">{I.plus()} Tambah Tipe</button><button className="btn primary">{I.plus()} Tambah Kamar</button></>}/>
          <div className="tabs" style={{marginBottom:16}}>
            <div className="tab active">Tipe Kamar</div>
            <div className="tab">Daftar Kamar (31)</div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16}}>
            {types.map(t=>(<div key={t.c} className="card">
              <div className="card-b">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                  <div>
                    <div className="mono" style={{fontSize:11, color:'var(--slate-500)', fontWeight:600}}>{t.c}</div>
                    <div style={{fontSize:16, fontWeight:600, marginTop:2}}>{t.n}</div>
                  </div>
                  <button className="btn ghost sm">{I.edit()}</button>
                </div>
                <div className="divider"/>
                <div className="row" style={{justifyContent:'space-between', padding:'3px 0', fontSize:13}}><span className="muted">Kapasitas</span><span className="num">{t.cap} pax</span></div>
                <div className="row" style={{justifyContent:'space-between', padding:'3px 0', fontSize:13}}><span className="muted">Base rate / malam</span><span className="num strong">{fmtIDR(t.r)}</span></div>
                <div className="row" style={{justifyContent:'space-between', padding:'3px 0', fontSize:13}}><span className="muted">Jumlah kamar</span><span className="num">{t.ct}</span></div>
              </div>
            </div>))}
          </div>
          <div className="card" style={{padding:0}}>
            <div className="card-h"><h3>Daftar Kamar</h3><div className="search" style={{maxWidth:200}}>{I.search({s:14})}<input placeholder="Cari nomor kamar…"/></div></div>
            <table className="tbl">
              <thead><tr><th>Nomor</th><th>Lantai</th><th>Tipe</th><th className="num">Base Rate</th><th>Status Saat Ini</th><th></th></tr></thead>
              <tbody>{[
                {n:'101',f:1,t:'Standard (STD)',r:550000,s:'VC'},
                {n:'102',f:1,t:'Standard (STD)',r:550000,s:'VC'},
                {n:'103',f:1,t:'Standard (STD)',r:550000,s:'VD'},
                {n:'104',f:1,t:'Standard (STD)',r:550000,s:'VC'},
                {n:'105',f:1,t:'Deluxe (DLX)',r:850000,s:'OD'},
                {n:'201',f:2,t:'Standard (STD)',r:550000,s:'OC'},
                {n:'204',f:2,t:'Deluxe (DLX)',r:850000,s:'OC'},
                {n:'205',f:2,t:'Deluxe (DLX)',r:850000,s:'OOO'},
              ].map((r,i)=>(<tr key={i}>
                <td className="strong num">{r.n}</td><td className="num">{r.f}</td><td>{r.t}</td>
                <td className="num">{fmtIDR(r.r)}</td>
                <td><Badge kind={r.s.toLowerCase()}>{r.s}</Badge></td>
                <td style={{textAlign:'right'}}><button className="btn ghost sm">{I.edit()}</button><button className="btn ghost sm">{I.trash()}</button></td>
              </tr>))}</tbody>
            </table>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function ADArticles() {
  const arts = [
    {c:'ROOM-CHG', n:'Room Charge', t:'ROOM', p:0, d:'Auto-posted oleh Night Audit.'},
    {c:'FB-CHG', n:'F&B Charge to Room', t:'FB', p:0, d:'Otomatis dari order F&B.'},
    {c:'LAUNDRY', n:'Laundry Service', t:'SERVICE', p:75000, d:'Per item, harga dapat di-override.'},
    {c:'MINIBAR', n:'Minibar Consumption', t:'MISC', p:0, d:'Manual posting saat check-out.'},
    {c:'EXTRA-BED', n:'Extra Bed', t:'SERVICE', p:150000, d:'Per malam.'},
    {c:'EARLY-CHK', n:'Early Check-in', t:'SERVICE', p:200000, d:'Sebelum 12:00.'},
    {c:'LATE-CHK', n:'Late Check-out', t:'SERVICE', p:200000, d:'Setelah 14:00.'},
    {c:'PHONE', n:'Telephone', t:'MISC', p:0, d:'Posting manual.'},
    {c:'TAX-PPN', n:'Tax PPN 11%', t:'TAX', p:0, d:'Auto-calc dari subtotal.'},
    {c:'SVC-CHG', n:'Service Charge 7%', t:'TAX', p:0, d:'Auto-calc dari subtotal.'},
  ];
  const tc = {ROOM:['var(--blue-50)','var(--blue-700)'], FB:['var(--emerald-50)','var(--emerald-700)'], SERVICE:['var(--amber-50)','var(--amber-600)'], TAX:['var(--slate-100)','var(--slate-700)'], MISC:['var(--slate-100)','var(--slate-600)']};
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="admin" active="articles"/>
      <main className="zd-main">
        <Topbar crumbs={['Admin','Articles']} user="Hendra W." userRole="Administrator"/>
        <div className="zd-content">
          <PageHeader title="Articles (Charge Codes)" sub="Daftar kode charge yang digunakan untuk posting line item folio."
            actions={<button className="btn primary">{I.plus()} Tambah Article</button>}/>
          <div className="card" style={{padding:0}}>
            <div className="tbl-filters">
              <div className="search">{I.search({s:14})}<input placeholder="Cari kode atau nama…"/></div>
              <select className="select sm" style={{width:130}}><option>Semua Tipe</option><option>ROOM</option><option>FB</option><option>SERVICE</option><option>TAX</option><option>MISC</option></select>
              <span className="grow"/>
              <span className="count num">{arts.length} articles</span>
            </div>
            <table className="tbl">
              <thead><tr><th>Code</th><th>Nama</th><th>Tipe</th><th className="num">Default Price</th><th>Catatan</th><th></th></tr></thead>
              <tbody>{arts.map((a,i)=>{
                const c = tc[a.t];
                return <tr key={i}>
                  <td className="mono strong">{a.c}</td>
                  <td className="strong">{a.n}</td>
                  <td><span style={{display:'inline-flex', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600, background:c[0], color:c[1]}}>{a.t}</span></td>
                  <td className="num">{a.p>0?fmtIDR(a.p):<span className="muted">—</span>}</td>
                  <td className="muted">{a.d}</td>
                  <td style={{textAlign:'right'}}><button className="btn ghost sm">{I.edit()}</button><button className="btn ghost sm">{I.trash()}</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function ADMenu() {
  const menus = [
    {c:'M-NGS', n:'Nasi Goreng Spesial', cat:'Main', p:65000, a:true},
    {c:'M-MGS', n:'Mie Goreng Seafood', cat:'Main', p:75000, a:true},
    {c:'M-SAT', n:'Sate Ayam (10 tusuk)', cat:'Main', p:55000, a:true},
    {c:'M-GAD', n:'Gado-Gado', cat:'Main', p:45000, a:true},
    {c:'M-SOT', n:'Soto Ayam Lamongan', cat:'Main', p:42000, a:true},
    {c:'M-AYB', n:'Ayam Bakar', cat:'Main', p:68000, a:true},
    {c:'B-ETM', n:'Es Teh Manis', cat:'Beverage', p:15000, a:true},
    {c:'B-EJR', n:'Es Jeruk', cat:'Beverage', p:20000, a:true},
    {c:'B-KOP', n:'Kopi Tubruk', cat:'Beverage', p:22000, a:true},
    {c:'B-JAL', n:'Jus Alpukat', cat:'Beverage', p:35000, a:true},
    {c:'D-ESC', n:'Es Campur', cat:'Dessert', p:30000, a:true},
    {c:'D-PIS', n:'Pisang Goreng', cat:'Dessert', p:25000, a:true},
    {c:'D-KLE', n:'Klepon', cat:'Dessert', p:20000, a:false},
  ];
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="admin" active="menu"/>
      <main className="zd-main">
        <Topbar crumbs={['Admin','F&B Menu']} user="Hendra W." userRole="Administrator"/>
        <div className="zd-content">
          <PageHeader title="F&B Menu" sub="Outlet: Hotel Restaurant (single outlet untuk MVP)."
            actions={<><button className="btn">{I.download()} Export</button><button className="btn primary">{I.plus()} Tambah Menu</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16}}>
            <div className="kpi"><div className="label">Total Menu Aktif</div><div className="value num">{menus.filter(m=>m.a).length}</div><div className="delta">{menus.length - menus.filter(m=>m.a).length} nonaktif</div></div>
            <div className="kpi"><div className="label">Kategori</div><div className="value num">3</div><div className="delta">Main, Beverage, Dessert</div></div>
            <div className="kpi"><div className="label">Avg. Price</div><div className="value num">{fmtIDR(38150)}</div><div className="delta">Per item</div></div>
          </div>
          <div className="card" style={{padding:0}}>
            <div className="tbl-filters">
              <div className="search">{I.search({s:14})}<input placeholder="Cari menu…"/></div>
              <select className="select sm" style={{width:130}}><option>Semua Kategori</option><option>Main</option><option>Beverage</option><option>Dessert</option></select>
              <select className="select sm" style={{width:130}}><option>Semua Status</option><option>Aktif</option><option>Nonaktif</option></select>
              <span className="grow"/>
              <span className="count num">{menus.length} menu</span>
            </div>
            <table className="tbl">
              <thead><tr><th>Code</th><th>Nama Menu</th><th>Kategori</th><th className="num">Harga</th><th>Status</th><th></th></tr></thead>
              <tbody>{menus.map((m,i)=>(<tr key={i}>
                <td className="mono">{m.c}</td>
                <td className="strong">{m.n}</td>
                <td>{m.cat}</td>
                <td className="num strong">{fmtIDR(m.p)}</td>
                <td>{m.a ? <Badge kind="paid">Aktif</Badge> : <Badge kind="closed">Nonaktif</Badge>}</td>
                <td style={{textAlign:'right'}}><button className="btn ghost sm">{I.edit()}</button><button className="btn ghost sm">{I.trash()}</button></td>
              </tr>))}</tbody>
            </table>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function ADSettings() {
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="admin" active="settings"/>
      <main className="zd-main">
        <Topbar crumbs={['Admin','Pengaturan Hotel']} user="Hendra W." userRole="Administrator"/>
        <div className="zd-content">
          <PageHeader title="Pengaturan Hotel" sub="Konfigurasi hotel, pajak, service charge, dan cut-off Night Audit."
            actions={<><button className="btn">Batal</button><button className="btn primary">Simpan</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:16, maxWidth:1100}}>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Informasi Hotel</h3></div>
                <div className="card-b">
                  <div className="form-grid">
                    <Field label="Nama hotel" required><input type="text" defaultValue="Hotel Praktikum ZADD"/></Field>
                    <Field label="Mata uang" required><select defaultValue="IDR"><option value="IDR">IDR — Indonesian Rupiah</option></select></Field>
                    <Field label="Alamat" span><textarea defaultValue="Jl. Hospitality Raya No. 1, Bandung 40123"/></Field>
                    <Field label="Telepon"><input type="text" defaultValue="+62 22 4567 8900"/></Field>
                    <Field label="Email"><input type="email" defaultValue="info@zaddhotel.ac.id"/></Field>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Tax & Service Charge</h3></div>
                <div className="card-b">
                  <div className="form-grid">
                    <Field label="Tax (PPN) %" required hint="Diaplikasikan ke subtotal + service charge."><input type="number" defaultValue="11" step="0.1"/></Field>
                    <Field label="Service Charge %" required hint="Diaplikasikan ke subtotal F&B."><input type="number" defaultValue="7" step="0.1"/></Field>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Night Audit</h3></div>
                <div className="card-b">
                  <div className="form-grid">
                    <Field label="Cut-off time" required hint="Waktu paling awal Night Audit dapat dijalankan."><input type="text" defaultValue="02:00"/></Field>
                    <Field label="Auto-VOID order F&B yang masih OPEN"><select defaultValue="yes"><option value="yes">Ya</option><option value="no">Tidak (manual)</option></select></Field>
                  </div>
                </div>
              </div>
            </div>
            <aside>
              <div className="card">
                <div className="card-h"><h3>Preview</h3></div>
                <div className="card-b" style={{fontSize:12}}>
                  <div style={{padding:10, background:'var(--slate-50)', borderRadius:5}}>
                    <div className="muted" style={{textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600, fontSize:10}}>Contoh perhitungan F&B</div>
                    <div style={{marginTop:8}}>
                      <div className="row" style={{justifyContent:'space-between', padding:'2px 0'}}><span>Subtotal</span><span className="num">{fmtIDR(100000)}</span></div>
                      <div className="row" style={{justifyContent:'space-between', padding:'2px 0'}}><span className="muted">+ Service 7%</span><span className="num">{fmtIDR(7000)}</span></div>
                      <div className="row" style={{justifyContent:'space-between', padding:'2px 0'}}><span className="muted">+ PPN 11% (atas {fmtIDR(107000)})</span><span className="num">{fmtIDR(11770)}</span></div>
                      <div className="divider"/>
                      <div className="row" style={{justifyContent:'space-between', fontWeight:700}}><span>Total</span><span className="num">{fmtIDR(118770)}</span></div>
                    </div>
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

Object.assign(window, { ADUsers, ADRooms, ADArticles, ADMenu, ADSettings });
