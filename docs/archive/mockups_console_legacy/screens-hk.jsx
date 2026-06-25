// Housekeeping mobile screens (360-430px)
function HKDashboard() {
  const rooms = [
    {n:'101', s:'VC', f:1, last:'06:42'}, {n:'102', s:'OC', f:1, last:'14:20', g:'Siti N.'},
    {n:'103', s:'VD', f:1, last:'11:05'}, {n:'104', s:'VC', f:1, last:'07:30'},
    {n:'105', s:'OD', f:1, last:'09:14', g:'Lina M.'}, {n:'201', s:'OC', f:2, last:'08:00', g:'Andi P.'},
    {n:'202', s:'VC', f:2, last:'09:50'}, {n:'203', s:'VD', f:2, last:'10:32'},
    {n:'204', s:'OC', f:2, last:'12:11', g:'Tomi W.'}, {n:'205', s:'OOO', f:2, last:'25 Apr', note:'AC rusak'},
    {n:'301', s:'OC', f:3, last:'06:55', g:'Hendra K.'}, {n:'302', s:'VD', f:3, last:'11:40'},
  ];
  const counts = {VC:0, OC:0, VD:0, OD:0, OOO:0};
  rooms.forEach(r=>counts[r.s]++);
  return (
    <div className="zd"><div className="zd-mobile">
      <div className="m-top">
        <div style={{flex:1}}>
          <h2>Housekeeping</h2>
          <div className="sub">Selasa, 26 Apr · 12 kamar dipantau</div>
        </div>
        <button className="btn icon sm">{I.bell({s:16})}</button>
      </div>
      <div style={{padding:'10px 12px', background:'white', borderBottom:'1px solid var(--slate-200)', display:'flex', gap:6, overflowX:'auto'}}>
        <div className="btn sm" style={{borderColor:'var(--slate-900)', background:'var(--slate-900)', color:'white'}}>Semua · 12</div>
        <div className="btn sm">VC · {counts.VC}</div>
        <div className="btn sm">VD · {counts.VD}</div>
        <div className="btn sm">OC · {counts.OC}</div>
        <div className="btn sm">OD · {counts.OD}</div>
        <div className="btn sm">OOO · {counts.OOO}</div>
      </div>
      <div className="m-content" style={{padding:0}}>
        {[1,2,3].map(fl=>(
          <div key={fl}>
            <div style={{padding:'10px 16px 6px', fontSize:11, fontWeight:600, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', background:'var(--slate-50)'}}>Lantai {fl}</div>
            {rooms.filter(r=>r.f===fl).map(r=>{
              const sc = {VC:'vc', OC:'oc', VD:'vd', OD:'od', OOO:'ooo'}[r.s];
              return <div key={r.n} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'white', borderBottom:'1px solid var(--slate-100)'}}>
                <div style={{width:44, height:44, borderRadius:6, background:'var(--slate-100)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, color:'var(--slate-900)'}}>{r.n}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}><Badge kind={sc}>{r.s}</Badge>{r.g && <span style={{fontSize:13, fontWeight:500, color:'var(--slate-700)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.g}</span>}</div>
                  <div className="muted" style={{fontSize:12, marginTop:2}}>{r.note ? r.note : 'Update terakhir ' + r.last}</div>
                </div>
                {I.chev({s:14})}
              </div>;
            })}
          </div>
        ))}
      </div>
      <HKBottomNav active="rooms"/>
    </div></div>
  );
}

function HKDetail() {
  return (
    <div className="zd"><div className="zd-mobile">
      <div className="m-top">
        <button className="btn icon sm" style={{border:'none', background:'transparent'}}>{I.chevL({s:18})}</button>
        <div style={{flex:1}}>
          <h2>Kamar 204</h2>
          <div className="sub">Lantai 2 · Deluxe</div>
        </div>
      </div>
      <div className="m-content">
        <div style={{padding:'16px', background:'white', borderRadius:8, border:'1px solid var(--slate-200)', textAlign:'center'}}>
          <div style={{fontSize:11, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600}}>Status saat ini</div>
          <div style={{marginTop:8, display:'inline-flex', padding:'8px 16px', borderRadius:6, background:'var(--blue-50)', color:'var(--blue-700)', fontWeight:700, fontSize:18, gap:8, alignItems:'center'}}>
            <span style={{width:10, height:10, borderRadius:5, background:'var(--blue-500)'}}/>OC · Occupied Clean
          </div>
          <div className="muted" style={{fontSize:12, marginTop:8}}>Diperbarui 14:20 oleh Bambang S.</div>
        </div>
        <div style={{marginTop:14, padding:14, background:'white', borderRadius:8, border:'1px solid var(--slate-200)'}}>
          <div style={{fontSize:11, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:8}}>Tamu Aktif</div>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:40, height:40, borderRadius:20, background:'var(--slate-200)', color:'var(--slate-700)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:14}}>TW</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600, fontSize:14}}>Tomi Wijaya</div>
              <div className="muted" style={{fontSize:12}}>Check-in 23 Apr · Check-out 26 Apr</div>
            </div>
          </div>
        </div>
        <div style={{marginTop:14, padding:14, background:'white', borderRadius:8, border:'1px solid var(--slate-200)'}}>
          <div style={{fontSize:11, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:8}}>Riwayat Status</div>
          {[
            {t:'14:20', d:'Hari ini', s:'OC', from:'OD', by:'Bambang S.'},
            {t:'09:14', d:'Hari ini', s:'OD', from:'OC', by:'Sistem (auto)'},
            {t:'07:42', d:'25 Apr', s:'OC', from:'VC', by:'Sistem (check-in)'},
          ].map((h,i)=>(
            <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop: i?'1px solid var(--slate-100)':'none'}}>
              <div style={{fontSize:11, color:'var(--slate-500)', width:62, flexShrink:0}}>{h.d}<br/><span className="num">{h.t}</span></div>
              <div style={{display:'flex', alignItems:'center', gap:6, flex:1}}>
                <Badge kind={h.from.toLowerCase()}>{h.from}</Badge>{I.chev({s:10})}<Badge kind={h.s.toLowerCase()}>{h.s}</Badge>
              </div>
              <div className="muted" style={{fontSize:11, textAlign:'right'}}>{h.by}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:'10px 12px', background:'white', borderTop:'1px solid var(--slate-200)'}}>
        <button className="btn primary lg" style={{width:'100%', justifyContent:'center'}}>Update Status Kamar</button>
      </div>
      <HKBottomNav active="rooms"/>
    </div></div>
  );
}

function HKUpdate() {
  return (
    <div className="zd"><div className="zd-mobile">
      <div className="m-top">
        <button className="btn icon sm" style={{border:'none', background:'transparent'}}>{I.chevL({s:18})}</button>
        <div style={{flex:1}}>
          <h2>Update Status</h2>
          <div className="sub">Kamar 204 · saat ini OC</div>
        </div>
      </div>
      <div className="m-content">
        <div style={{fontSize:12, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:10}}>Pilih status baru</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
          {[
            {k:'VC', l:'Vacant Clean', d:'Siap dijual', c:'vc'},
            {k:'OC', l:'Occupied Clean', d:'Tamu in-house, bersih', c:'oc', sel:true},
            {k:'VD', l:'Vacant Dirty', d:'Perlu dibersihkan', c:'vd'},
            {k:'OD', l:'Occupied Dirty', d:'Tamu in-house, kotor', c:'od'},
            {k:'OOO', l:'Out of Order', d:'Tidak dapat dijual', c:'ooo'},
          ].map(s=>{
            const col = {vc:['var(--emerald-50)','var(--emerald-500)'], oc:['var(--blue-50)','var(--blue-500)'], vd:['var(--amber-50)','var(--amber-500)'], od:['var(--red-50)','var(--red-500)'], ooo:['var(--slate-100)','var(--slate-500)']}[s.c];
            const sel = s.k==='VD';
            return <button key={s.k} style={{textAlign:'left', padding:'14px 12px', background:sel?col[0]:'white', border: sel? '2px solid '+col[1] : '1px solid var(--slate-200)', borderRadius:8, cursor:'pointer'}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{width:12, height:12, borderRadius:6, background:col[1]}}/>
                <span style={{fontWeight:700, fontSize:15}}>{s.k}</span>
                {sel && <span style={{marginLeft:'auto'}}>{I.check({s:16})}</span>}
              </div>
              <div style={{fontWeight:500, fontSize:13, marginTop:6, color:'var(--slate-900)'}}>{s.l}</div>
              <div style={{fontSize:11, color:'var(--slate-500)', marginTop:2}}>{s.d}</div>
            </button>;
          })}
        </div>
        <div style={{marginTop:16}}>
          <Field label="Catatan (opsional)" hint="Mis. linen perlu diganti, perlu maintenance, dll.">
            <textarea defaultValue="Ranjang berantakan, butuh ganti seprai dan handuk."/>
          </Field>
        </div>
        <div style={{marginTop:14, padding:'10px 12px', background:'var(--slate-100)', borderRadius:6, fontSize:12, color:'var(--slate-700)', display:'flex', alignItems:'flex-start', gap:8}}>
          {I.refresh({s:14})}
          <div>Perubahan akan tersinkron ke Tape Chart Front Office secara real-time.</div>
        </div>
      </div>
      <div style={{padding:'10px 12px', background:'white', borderTop:'1px solid var(--slate-200)', display:'flex', gap:8}}>
        <button className="btn lg" style={{flex:1, justifyContent:'center'}}>Batal</button>
        <button className="btn primary lg" style={{flex:2, justifyContent:'center'}}>Konfirmasi · OC → VD</button>
      </div>
    </div></div>
  );
}

Object.assign(window, { HKDashboard, HKDetail, HKUpdate });
