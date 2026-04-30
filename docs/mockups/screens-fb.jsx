// F&B screens
function FBTables() {
  const tables = Array.from({length:16}).map((_,i)=>{
    const n = (i+1).toString().padStart(2,'0');
    const st = i%5===0?'BILLED':(i%3===0?'OPEN':'FREE');
    return {n:'T'+n, s:st, o:st==='OPEN'?180000+i*15000:(st==='BILLED'?345000+i*7500:0), pax: st==='FREE'?0:2+(i%4)};
  });
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fb" active="tables"/>
      <main className="zd-main">
        <Topbar crumbs={['Food & Beverage','Daftar Meja']} user="Rina A." userRole="F&B Officer"/>
        <div className="zd-content">
          <PageHeader title="Hotel Restaurant" sub="Daftar meja & ringkasan harian · Selasa, 26 Apr 2026"
            actions={<><button className="btn">{I.list()} Riwayat Order</button><button className="btn primary">{I.plus()} Walk-in Order</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16}}>
            <div className="kpi"><div className="label">Order Aktif</div><div className="value num">7</div><div className="delta">3 OPEN · 4 BILLED</div></div>
            <div className="kpi"><div className="label">Revenue Hari Ini</div><div className="value num">{fmtIDR(4825000)}</div><div className="delta up">+12% vs kemarin</div></div>
            <div className="kpi"><div className="label">Charge to Room</div><div className="value num">{fmtIDR(1250000)}</div><div className="delta">3 transaksi</div></div>
            <div className="kpi"><div className="label">Cash + Card</div><div className="value num">{fmtIDR(3575000)}</div><div className="delta">14 transaksi</div></div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Layout Meja</h3><div style={{display:'flex', gap:8, fontSize:11}}><Badge kind="vc">Free</Badge><Badge kind="oc">Open</Badge><Badge kind="vd">Billed</Badge></div></div>
            <div className="card-b">
              <div style={{display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:10}}>
                {tables.map(t=>{
                  const col = {FREE:['var(--emerald-50)','var(--emerald-500)','var(--emerald-700)'], OPEN:['var(--blue-50)','var(--blue-500)','var(--blue-700)'], BILLED:['var(--amber-50)','var(--amber-500)','var(--amber-600)']}[t.s];
                  return <button key={t.n} style={{padding:'12px 10px', background:col[0], border:'1px solid '+col[1], borderLeft:'4px solid '+col[1], borderRadius:5, cursor:'pointer', textAlign:'left'}}>
                    <div style={{fontWeight:700, fontSize:14, color:col[2]}}>{t.n}</div>
                    <div style={{fontSize:10, color:col[2], textTransform:'uppercase', fontWeight:600, letterSpacing:'0.04em'}}>{t.s}</div>
                    {t.s!=='FREE' && <div className="num" style={{fontSize:11, color:'var(--slate-700)', marginTop:4}}>{fmtIDR(t.o)}</div>}
                    {t.pax>0 && <div className="muted" style={{fontSize:10, marginTop:1}}>{t.pax} pax</div>}
                  </button>;
                })}
              </div>
            </div>
          </div>
          <div className="card" style={{marginTop:16}}>
            <div className="card-h"><h3>Order Hari Ini</h3><div className="tabs" style={{borderBottom:'none'}}><div className="tab active">Aktif (7)</div><div className="tab">Selesai (14)</div><div className="tab">Void (1)</div></div></div>
            <table className="tbl">
              <thead><tr><th>No. Order</th><th>Meja</th><th>Waiter</th><th>Item</th><th className="num">Total</th><th>Status</th><th>Pembayaran</th></tr></thead>
              <tbody>
                {[
                  {n:'FB-2604-0023', t:'T03', w:'Rina A.', i:5, tot:325000, s:'OPEN', p:'—'},
                  {n:'FB-2604-0022', t:'T07', w:'Rina A.', i:3, tot:185000, s:'BILLED', p:'CHARGE_TO_ROOM · 204'},
                  {n:'FB-2604-0021', t:'T01', w:'Joko P.', i:6, tot:545000, s:'BILLED', p:'CASH'},
                  {n:'FB-2604-0020', t:'T11', w:'Rina A.', i:2, tot:95000, s:'OPEN', p:'—'},
                ].map((o,i)=>(<tr key={i}>
                  <td className="mono strong">{o.n}</td><td className="strong">{o.t}</td><td>{o.w}</td>
                  <td className="num">{o.i}</td><td className="num strong">{fmtIDR(o.tot)}</td>
                  <td><Badge kind={o.s==='OPEN'?'open':'unpaid'}>{o.s}</Badge></td>
                  <td className="muted">{o.p}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function FBOrder() {
  const menu = [
    {c:'Main', items:[{n:'Nasi Goreng Spesial',p:65000},{n:'Mie Goreng Seafood',p:75000},{n:'Sate Ayam (10 tusuk)',p:55000},{n:'Gado-Gado',p:45000},{n:'Soto Ayam Lamongan',p:42000},{n:'Ayam Bakar',p:68000}]},
    {c:'Beverage', items:[{n:'Es Teh Manis',p:15000},{n:'Es Jeruk',p:20000},{n:'Kopi Tubruk',p:22000},{n:'Jus Alpukat',p:35000}]},
    {c:'Dessert', items:[{n:'Es Campur',p:30000},{n:'Pisang Goreng',p:25000},{n:'Klepon',p:20000}]},
  ];
  const cart = [{n:'Nasi Goreng Spesial',q:2,p:65000,note:'Pedas'},{n:'Sate Ayam (10 tusuk)',q:1,p:55000,note:''},{n:'Es Teh Manis',q:3,p:15000,note:'Less ice'},{n:'Pisang Goreng',q:1,p:25000,note:''}];
  const sub = cart.reduce((s,c)=>s+c.q*c.p,0);
  const sc = sub*0.07, tax = (sub+sc)*0.11, tot = sub+sc+tax;
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fb" active="order"/>
      <main className="zd-main">
        <Topbar crumbs={['Food & Beverage','Captain Order','FB-2604-0023']} user="Rina A." userRole="F&B Officer"/>
        <div className="zd-content">
          <PageHeader title="Captain Order · Meja T03" sub="Order #FB-2604-0023 · 4 pax · Dibuka 12:34"
            actions={<><button className="btn">{I.x()} Void Order</button><button className="btn">Simpan Draft</button><button className="btn primary">Ke Bill Detail {I.arrow()}</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 380px', gap:16}}>
            <div className="card">
              <div className="card-h"><h3>Pilih Menu</h3><div className="search" style={{maxWidth:200}}>{I.search({s:14})}<input placeholder="Cari menu…"/></div></div>
              <div style={{padding:'10px 14px', borderBottom:'1px solid var(--slate-200)', display:'flex', gap:6}}>
                {['Semua','Main','Beverage','Dessert'].map((c,i)=>(<div key={i} className="btn sm" style={i===0?{borderColor:'var(--slate-900)', background:'var(--slate-900)', color:'white'}:{}}>{c}</div>))}
              </div>
              <div className="card-b" style={{display:'flex', flexDirection:'column', gap:14}}>
                {menu.map(s=>(
                  <div key={s.c}>
                    <div style={{fontSize:11, fontWeight:600, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8}}>{s.c}</div>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8}}>
                      {s.items.map(it=>(<button key={it.n} style={{textAlign:'left', padding:'10px 12px', background:'white', border:'1px solid var(--slate-200)', borderRadius:5, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
                        <div><div style={{fontSize:13, fontWeight:500}}>{it.n}</div><div className="num muted" style={{fontSize:12, marginTop:2}}>{fmtIDR(it.p)}</div></div>
                        <span style={{width:24, height:24, borderRadius:12, background:'var(--slate-100)', display:'flex', alignItems:'center', justifyContent:'center'}}>{I.plus({s:12})}</span>
                      </button>))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="card" style={{position:'sticky', top:0, alignSelf:'flex-start'}}>
              <div className="card-h"><h3>Keranjang</h3><span className="meta num">{cart.length} items</span></div>
              <div className="card-b" style={{padding:0}}>
                {cart.map((c,i)=>(<div key={i} style={{padding:'10px 14px', borderBottom:'1px solid var(--slate-100)', display:'flex', gap:10, alignItems:'flex-start'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, fontWeight:500}}>{c.n}</div>
                    <div className="num muted" style={{fontSize:11, marginTop:2}}>{fmtIDR(c.p)} × {c.q}</div>
                    {c.note && <div style={{fontSize:11, color:'var(--amber-600)', marginTop:3, fontStyle:'italic'}}>“{c.note}”</div>}
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:4}}>
                    <button className="btn icon sm">−</button>
                    <span className="num" style={{width:18, textAlign:'center', fontWeight:600}}>{c.q}</span>
                    <button className="btn icon sm">+</button>
                  </div>
                  <div className="num strong" style={{minWidth:74, textAlign:'right'}}>{fmtIDR(c.p*c.q)}</div>
                </div>))}
              </div>
              <div className="card-f" style={{fontSize:13, padding:14}}>
                <div className="row" style={{justifyContent:'space-between', padding:'2px 0'}}><span className="muted">Subtotal</span><span className="num">{fmtIDR(sub)}</span></div>
                <div className="row" style={{justifyContent:'space-between', padding:'2px 0'}}><span className="muted">Service 7%</span><span className="num">{fmtIDR(sc)}</span></div>
                <div className="row" style={{justifyContent:'space-between', padding:'2px 0'}}><span className="muted">PPN 11%</span><span className="num">{fmtIDR(tax)}</span></div>
                <div className="divider"/>
                <div className="row" style={{justifyContent:'space-between', fontWeight:700, fontSize:15}}><span>Total</span><span className="num">{fmtIDR(tot)}</span></div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function FBBill() {
  const items = [{n:'Nasi Goreng Spesial',q:2,p:65000,note:'Pedas'},{n:'Sate Ayam (10 tusuk)',q:1,p:55000},{n:'Es Teh Manis',q:3,p:15000,note:'Less ice'},{n:'Pisang Goreng',q:1,p:25000}];
  const sub = items.reduce((s,c)=>s+c.q*c.p,0);
  const sc = sub*0.07, tax = (sub+sc)*0.11, tot = sub+sc+tax;
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fb" active="bill"/>
      <main className="zd-main">
        <Topbar crumbs={['Food & Beverage','Bill Detail','FB-2604-0023']} user="Rina A." userRole="F&B Officer"/>
        <div className="zd-content">
          <PageHeader title="Bill Detail · FB-2604-0023" sub="Meja T03 · 4 pax · Waiter Rina A. · Status BILLED"
            actions={<><button className="btn">{I.printer()} Print PDF</button><button className="btn">{I.plus()} Tambah Item</button><button className="btn primary">Lanjut ke Pembayaran {I.arrow()}</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 360px', gap:16}}>
            <div className="card">
              <div className="card-h"><h3>Line Items</h3><span className="meta">Order #FB-2604-0023 · {items.length} item</span></div>
              <table className="tbl">
                <thead><tr><th>Menu</th><th>Catatan</th><th className="num">Qty</th><th className="num">Harga</th><th className="num">Total</th><th></th></tr></thead>
                <tbody>{items.map((it,i)=>(<tr key={i}>
                  <td className="strong">{it.n}</td>
                  <td className="muted" style={{fontStyle: it.note?'italic':'normal'}}>{it.note||'—'}</td>
                  <td className="num">{it.q}</td>
                  <td className="num">{fmtIDR(it.p)}</td>
                  <td className="num strong">{fmtIDR(it.p*it.q)}</td>
                  <td style={{textAlign:'right'}}><button className="btn ghost sm">{I.more()}</button></td>
                </tr>))}</tbody>
              </table>
            </div>
            <aside style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Ringkasan</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Subtotal</span><span className="num">{fmtIDR(sub)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">Service charge 7%</span><span className="num">{fmtIDR(sc)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'4px 0'}}><span className="muted">PPN 11%</span><span className="num">{fmtIDR(tax)}</span></div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', fontWeight:700, fontSize:16}}><span>TOTAL</span><span className="num">{fmtIDR(tot)}</span></div>
                </div>
                <div className="card-f" style={{fontSize:11, color:'var(--slate-500)'}}>Service & pajak dihitung otomatis dari Hotel Settings.</div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Aksi Cepat</h3></div>
                <div className="card-b" style={{display:'flex', flexDirection:'column', gap:8}}>
                  <button className="btn primary" style={{justifyContent:'center'}}>{I.tag()} Bayar Tunai</button>
                  <button className="btn" style={{justifyContent:'center'}}>{I.bed()} Charge to Room</button>
                  <button className="btn" style={{justifyContent:'center'}}>Split Bill</button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div></div>
  );
}

function FBPayment() {
  const tot = 451385;
  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="fb" active="payment"/>
      <main className="zd-main">
        <Topbar crumbs={['Food & Beverage','Pembayaran','FB-2604-0023']} user="Rina A." userRole="F&B Officer"/>
        <div className="zd-content">
          <PageHeader title="Pembayaran · FB-2604-0023" sub={'Total ' + fmtIDR(tot) + ' · Meja T03'}
            actions={<><button className="btn">Kembali</button><button className="btn primary">{I.check()} Konfirmasi & Tutup Order</button></>}/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 360px', gap:16}}>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Metode Pembayaran</h3></div>
                <div className="card-b">
                  <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10}}>
                    {[{k:'CASH',l:'Cash',d:'Tunai',i:'tag'},{k:'CTR',l:'Charge to Room',d:'Bebankan ke folio tamu',i:'bed',sel:true},{k:'CARD',l:'Kartu Kredit/Debit',d:'EDC manual',i:'tag'}].map(m=>(
                      <button key={m.k} style={{padding:'14px 12px', textAlign:'left', background: m.sel?'var(--slate-900)':'white', color: m.sel?'white':'var(--slate-900)', border: '1px solid '+(m.sel?'var(--slate-900)':'var(--slate-300)'), borderRadius:5, cursor:'pointer'}}>
                        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>{I[m.i]({s:18})}{m.sel && I.check({s:14})}</div>
                        <div style={{fontWeight:600, fontSize:14, marginTop:8}}>{m.l}</div>
                        <div style={{fontSize:11, opacity:.7, marginTop:2}}>{m.d}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Charge to Room — Pilih Tamu In-House</h3><span className="meta">Aktifkan saat metode CTR.</span></div>
                <div className="card-b">
                  <div className="form-grid">
                    <Field label="Nomor Kamar" required><input type="text" defaultValue="204"/></Field>
                    <Field label="Tamu (auto-detect)"><input type="text" defaultValue="Tomi Wijaya — RSV-2304-0004" disabled/></Field>
                  </div>
                  <div style={{marginTop:14, padding:'12px 14px', background:'var(--blue-50)', borderRadius:5, display:'flex', gap:10, alignItems:'flex-start'}}>
                    <div style={{color:'var(--blue-700)'}}>{I.check({s:18})}</div>
                    <div style={{fontSize:13, color:'var(--blue-700)'}}>
                      <div style={{fontWeight:600}}>Tamu in-house ditemukan.</div>
                      <div style={{marginTop:2}}>Folio aktif <strong className="mono">FOL-2304-0004</strong> · Saldo saat ini {fmtIDR(2270000)}. Charge ini akan ditambahkan sebagai line item baru pada folio tersebut.</div>
                    </div>
                  </div>
                  <div style={{marginTop:12}}>
                    <Field label="Catatan untuk folio (opsional)"><input type="text" placeholder="Mis. dinner 2 pax"/></Field>
                  </div>
                </div>
              </div>
            </div>
            <aside style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="card">
                <div className="card-h"><h3>Ringkasan Bill</h3></div>
                <div className="card-b" style={{fontSize:13}}>
                  <div className="row" style={{justifyContent:'space-between', padding:'3px 0'}}><span className="muted">Subtotal</span><span className="num">{fmtIDR(355000)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'3px 0'}}><span className="muted">Service 7%</span><span className="num">{fmtIDR(24850)}</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'3px 0'}}><span className="muted">PPN 11%</span><span className="num">{fmtIDR(41785)}</span></div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', fontWeight:700, fontSize:15}}><span>Total tagih</span><span className="num">{fmtIDR(tot)}</span></div>
                  <div className="divider"/>
                  <div className="row" style={{justifyContent:'space-between', padding:'3px 0'}}><span className="muted">Metode</span><span style={{fontWeight:600}}>Charge to Room</span></div>
                  <div className="row" style={{justifyContent:'space-between', padding:'3px 0'}}><span className="muted">Folio tujuan</span><span className="mono">FOL-2304-0004</span></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div></div>
  );
}

Object.assign(window, { FBTables, FBOrder, FBBill, FBPayment });
