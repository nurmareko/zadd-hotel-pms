// Print layouts — A4 portrait, designed for actual paper output.
// A4 = 794 × 1123 px @ 96dpi. We render at that size on the artboard
// so what you see is what prints (1:1, no scale).

function PrintFolio() {
  const charges = [
    { d: '23 Apr', code: 'ROOM',  desc: 'Deluxe · 1 malam',          ref: 'FOL-2304-0004', dr: 850000, cr: 0 },
    { d: '23 Apr', code: 'TAX',   desc: 'PB1 10%',                   ref: '',              dr:  85000, cr: 0 },
    { d: '23 Apr', code: 'SVC',   desc: 'Service Charge 5%',         ref: '',              dr:  42500, cr: 0 },
    { d: '23 Apr', code: 'PAY',   desc: 'Deposit · Kartu Kredit',    ref: 'TRX-001829',    dr:      0, cr: 500000 },
    { d: '24 Apr', code: 'ROOM',  desc: 'Deluxe · 1 malam',          ref: 'FOL-2304-0004', dr: 850000, cr: 0 },
    { d: '24 Apr', code: 'TAX',   desc: 'PB1 10%',                   ref: '',              dr:  85000, cr: 0 },
    { d: '24 Apr', code: 'SVC',   desc: 'Service Charge 5%',         ref: '',              dr:  42500, cr: 0 },
    { d: '24 Apr', code: 'FB',    desc: 'Restaurant · Captain T-04', ref: 'CO-2404-0021',  dr: 187500, cr: 0 },
    { d: '25 Apr', code: 'ROOM',  desc: 'Deluxe · 1 malam',          ref: 'FOL-2304-0004', dr: 850000, cr: 0 },
    { d: '25 Apr', code: 'TAX',   desc: 'PB1 10%',                   ref: '',              dr:  85000, cr: 0 },
    { d: '25 Apr', code: 'SVC',   desc: 'Service Charge 5%',         ref: '',              dr:  42500, cr: 0 },
    { d: '25 Apr', code: 'LDRY',  desc: 'Laundry · 4 pcs',           ref: 'LDY-0156',      dr:  60000, cr: 0 },
    { d: '25 Apr', code: 'FB',    desc: 'Mini Bar · Kamar 204',      ref: 'MB-0098',       dr:  45000, cr: 0 },
    { d: '26 Apr', code: 'PAY',   desc: 'Pelunasan · Tunai',         ref: 'TRX-001920',    dr:      0, cr: 2225500 },
  ];
  const totalDr = charges.reduce((s,c)=>s+c.dr, 0);
  const totalCr = charges.reduce((s,c)=>s+c.cr, 0);
  const balance = totalDr - totalCr;

  const sty = {
    page: {
      width: 794, minHeight: 1123, margin: 0,
      padding: '56px 64px', boxSizing: 'border-box',
      background: 'white', color: '#0f172a',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      fontSize: 11, lineHeight: 1.4,
    },
    head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 16 },
    brand: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 },
    sub: { fontSize: 10, color: '#475569', lineHeight: 1.5 },
    docNum: { textAlign: 'right' },
    docNumLbl: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 600 },
    docNumVal: { fontSize: 18, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontWeight: 600, marginTop: 2 },
    sect: { marginTop: 22 },
    sectTitle: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #cbd5e1', paddingBottom: 4 },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' },
    fieldLbl: { fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
    fieldVal: { fontSize: 12, fontWeight: 500, marginBottom: 6 },
    tbl: { width: '100%', borderCollapse: 'collapse', marginTop: 6 },
    th: { textAlign: 'left', borderBottom: '1.5px solid #0f172a', padding: '6px 8px 6px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontWeight: 700 },
    thNum: { textAlign: 'right' },
    td: { padding: '6px 8px 6px 0', fontSize: 11, borderBottom: '0.5px solid #e2e8f0', verticalAlign: 'top' },
    tdNum: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
    foot: { marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 },
    sumRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 11 },
    sumTot: { borderTop: '1.5px solid #0f172a', marginTop: 4, paddingTop: 8, fontSize: 13, fontWeight: 700 },
    sigBox: { borderTop: '1px solid #94a3b8', marginTop: 80, paddingTop: 6, fontSize: 10, color: '#475569', textAlign: 'center' },
    notice: { marginTop: 28, padding: 10, background: '#f1f5f9', borderLeft: '3px solid #475569', fontSize: 9.5, color: '#334155', lineHeight: 1.5 },
    pageFoot: { position: 'absolute', bottom: 32, left: 64, right: 64, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', borderTop: '0.5px solid #e2e8f0', paddingTop: 8 },
  };
  const fmt = (n) => 'Rp ' + n.toLocaleString('id-ID');

  return (
    <div style={{...sty.page, position: 'relative'}}>
      <div style={sty.head}>
        <div>
          <div style={sty.brand}>ZADD Hotel</div>
          <div style={sty.sub}>
            Jl. Mawar Indah No. 24, Bandung 40117<br/>
            Telp (022) 4156-7890 · pms@zaddhotel.id<br/>
            NPWP 02.345.678.9-405.000
          </div>
        </div>
        <div style={sty.docNum}>
          <div style={sty.docNumLbl}>Guest Folio</div>
          <div style={sty.docNumVal}>FOL-2304-0004</div>
          <div style={{...sty.sub, marginTop: 6}}>Cetak: 26 Apr 2026, 11:32 WIB<br/>Petugas: Dewi Wulandari (FO)</div>
        </div>
      </div>

      <div style={sty.sect}>
        <div style={sty.sectTitle}>Detail Tamu & Reservasi</div>
        <div style={sty.grid2}>
          <div>
            <div style={sty.fieldLbl}>Nama Tamu</div>
            <div style={sty.fieldVal}>Tomi Wijaya</div>
            <div style={sty.fieldLbl}>No. Identitas (KTP)</div>
            <div style={sty.fieldVal}>3273 0506 8501 0024</div>
            <div style={sty.fieldLbl}>Telepon · Email</div>
            <div style={sty.fieldVal}>+62 812-9876-5432 · tomi.w@example.com</div>
          </div>
          <div>
            <div style={sty.fieldLbl}>Reservasi · Folio</div>
            <div style={sty.fieldVal}>RSV-2304-0011 / FOL-2304-0004</div>
            <div style={sty.fieldLbl}>Kamar · Tipe</div>
            <div style={sty.fieldVal}>204 · Deluxe (Twin)</div>
            <div style={sty.fieldLbl}>Check-in → Check-out</div>
            <div style={sty.fieldVal}>23 Apr 2026 → 26 Apr 2026 · 3 malam · 2 dewasa</div>
          </div>
        </div>
      </div>

      <div style={sty.sect}>
        <div style={sty.sectTitle}>Rincian Transaksi</div>
        <table style={sty.tbl}>
          <thead><tr>
            <th style={{...sty.th, width: 56}}>Tgl</th>
            <th style={{...sty.th, width: 56}}>Kode</th>
            <th style={sty.th}>Deskripsi</th>
            <th style={{...sty.th, width: 96}}>Referensi</th>
            <th style={{...sty.th, ...sty.thNum, width: 90}}>Debit</th>
            <th style={{...sty.th, ...sty.thNum, width: 90}}>Kredit</th>
          </tr></thead>
          <tbody>{charges.map((c,i)=>(
            <tr key={i}>
              <td style={sty.td}>{c.d}</td>
              <td style={{...sty.td, fontFamily:'ui-monospace, monospace', fontSize: 10}}>{c.code}</td>
              <td style={sty.td}>{c.desc}</td>
              <td style={{...sty.td, fontFamily:'ui-monospace, monospace', fontSize: 10, color: '#64748b'}}>{c.ref}</td>
              <td style={{...sty.td, ...sty.tdNum}}>{c.dr ? fmt(c.dr) : '—'}</td>
              <td style={{...sty.td, ...sty.tdNum}}>{c.cr ? fmt(c.cr) : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div style={sty.foot}>
        <div>
          <div style={sty.sectTitle}>Catatan</div>
          <div style={{fontSize: 10.5, color: '#475569', lineHeight: 1.6}}>
            Pembayaran lunas diterima 26 Apr 2026 pukul 11:14 WIB via tunai.<br/>
            Saldo akhir: <strong>NOL</strong> · Verifikasi zero-balance: PASSED.<br/>
            Folio ditutup oleh Dewi Wulandari (FO) pada 11:18 WIB.
          </div>
        </div>
        <div>
          <div style={sty.sumRow}><span style={{color:'#64748b'}}>Sub-total Charge</span><span style={{fontVariantNumeric:'tabular-nums'}}>{fmt(2225500)}</span></div>
          <div style={sty.sumRow}><span style={{color:'#64748b'}}>Total Pembayaran</span><span style={{fontVariantNumeric:'tabular-nums'}}>{fmt(2725500)}</span></div>
          <div style={{...sty.sumRow, ...sty.sumTot}}>
            <span>Saldo Akhir</span>
            <span style={{fontVariantNumeric:'tabular-nums'}}>{fmt(balance)}</span>
          </div>
        </div>
      </div>

      <div style={{...sty.foot, marginTop: 32, gridTemplateColumns: '1fr 1fr 1fr', gap: 32}}>
        <div style={sty.sigBox}>Tamu<br/><strong style={{color:'#0f172a'}}>Tomi Wijaya</strong></div>
        <div style={sty.sigBox}>Petugas FO<br/><strong style={{color:'#0f172a'}}>Dewi Wulandari</strong></div>
        <div style={sty.sigBox}>Cap Hotel</div>
      </div>

      <div style={sty.notice}>
        <strong>Disclaimer:</strong> Folio ini merupakan dokumen sah pembayaran kamar dan layanan hotel.
        Simpan untuk keperluan reimbursement perusahaan. PB1 10% dan service charge 5% telah termasuk pada total.
        Pertanyaan terkait penagihan: pms@zaddhotel.id.
      </div>

      <div style={sty.pageFoot}>
        <span>FOL-2304-0004 · Tomi Wijaya</span>
        <span>ZADD Hotel · Bandung</span>
        <span>Halaman 1 dari 1</span>
      </div>
    </div>
  );
}

function PrintNightReport() {
  const sty = {
    page: {
      width: 794, minHeight: 1123, padding: '56px 64px', boxSizing: 'border-box',
      background: 'white', color: '#0f172a',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      fontSize: 10.5, lineHeight: 1.4, position: 'relative',
    },
    h: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: 14 },
    title: { fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' },
    sub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    meta: { textAlign: 'right', fontSize: 10, color: '#475569' },
    metaK: { fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' },
    sect: { marginTop: 20 },
    st: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #cbd5e1', paddingBottom: 4 },
    kpis: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 4 },
    kpi: { padding: '8px 12px', borderRight: '0.5px solid #e2e8f0' },
    kpiL: { fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 },
    kpiV: { fontSize: 18, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' },
    kpiD: { fontSize: 9, color: '#475569', marginTop: 2 },
    tbl: { width: '100%', borderCollapse: 'collapse', marginTop: 6 },
    th: { textAlign: 'left', borderBottom: '1.5px solid #0f172a', padding: '6px 8px 6px 0', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', fontWeight: 700 },
    td: { padding: '5px 8px 5px 0', fontSize: 10.5, borderBottom: '0.5px solid #e2e8f0' },
    num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
    totRow: { fontWeight: 700, borderTop: '1.5px solid #0f172a', borderBottom: 'none' },
    bar: { height: 6, background: '#e2e8f0', borderRadius: 3, position: 'relative' },
    barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, background: '#0f172a', borderRadius: 3 },
    sigBox: { borderTop: '1px solid #94a3b8', marginTop: 60, paddingTop: 6, fontSize: 10, color: '#475569', textAlign: 'center' },
    pageFoot: { position: 'absolute', bottom: 32, left: 64, right: 64, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', borderTop: '0.5px solid #e2e8f0', paddingTop: 8 },
  };
  const fmt = (n) => n.toLocaleString('id-ID');
  const rev = [
    { code: 'RM',   desc: 'Room Revenue',         net: 19550000, tax: 1955000, svc: 977500, gross: 22482500 },
    { code: 'FB',   desc: 'F&B Revenue',          net:  3120000, tax:  312000, svc: 156000, gross:  3588000 },
    { code: 'LDRY', desc: 'Laundry',              net:   285000, tax:   28500, svc:  14250, gross:   327750 },
    { code: 'MB',   desc: 'Mini Bar',             net:   180000, tax:   18000, svc:   9000, gross:   207000 },
    { code: 'OTH',  desc: 'Other (Telp, Misc.)',  net:    45000, tax:    4500, svc:   2250, gross:    51750 },
  ];
  const totals = rev.reduce((a,r)=>({net:a.net+r.net, tax:a.tax+r.tax, svc:a.svc+r.svc, gross:a.gross+r.gross}), {net:0,tax:0,svc:0,gross:0});

  const settle = [
    { method: 'Tunai',         count: 8,  amount: 4200000 },
    { method: 'Kartu Debit',   count: 5,  amount: 6850000 },
    { method: 'Kartu Kredit',  count: 11, amount: 12100000 },
    { method: 'Transfer Bank', count: 3,  amount: 1900000 },
    { method: 'Charge to Room',count: 6,  amount: 1606250 },
  ];
  const settleTot = settle.reduce((s,r)=>s+r.amount,0);

  return (
    <div style={sty.page}>
      <div style={sty.h}>
        <div>
          <div style={sty.title}>Night Audit Report</div>
          <div style={sty.sub}>Business Date · 25 April 2026 (Sabtu) · Periode 06:00 → 06:00 WIB</div>
        </div>
        <div style={sty.meta}>
          <div>ZADD Hotel · Bandung</div>
          <div>Audit ke-<span style={sty.metaK}>1.247</span></div>
          <div>Cetak: 26 Apr 2026, 06:14 WIB</div>
          <div>Auditor: <span style={sty.metaK}>Hadi Suryanto</span></div>
        </div>
      </div>

      <div style={sty.sect}>
        <div style={sty.st}>Performance Summary</div>
        <div style={{...sty.kpis, border: '1px solid #e2e8f0', borderRadius: 4}}>
          <div style={sty.kpi}>
            <div style={sty.kpiL}>Occupancy</div>
            <div style={sty.kpiV}>87.1%</div>
            <div style={sty.kpiD}>27 of 31 rooms · ▲ 4.2pt vs LW</div>
          </div>
          <div style={sty.kpi}>
            <div style={sty.kpiL}>ADR</div>
            <div style={sty.kpiV}>724.074</div>
            <div style={sty.kpiD}>Avg Daily Rate · ▲ 1.8% vs LW</div>
          </div>
          <div style={sty.kpi}>
            <div style={sty.kpiL}>RevPAR</div>
            <div style={sty.kpiV}>630.645</div>
            <div style={sty.kpiD}>Revenue per Available · ▲ 6.1%</div>
          </div>
          <div style={{...sty.kpi, borderRight:'none'}}>
            <div style={sty.kpiL}>TRevPAR</div>
            <div style={sty.kpiV}>851.612</div>
            <div style={sty.kpiD}>Total RevPAR · ▲ 5.4%</div>
          </div>
        </div>
      </div>

      <div style={sty.sect}>
        <div style={sty.st}>Revenue by Article (IDR)</div>
        <table style={sty.tbl}>
          <thead><tr>
            <th style={{...sty.th, width: 50}}>Kode</th>
            <th style={sty.th}>Deskripsi</th>
            <th style={{...sty.th, ...sty.num, width: 100}}>Net</th>
            <th style={{...sty.th, ...sty.num, width: 80}}>PB1 10%</th>
            <th style={{...sty.th, ...sty.num, width: 80}}>Svc 5%</th>
            <th style={{...sty.th, ...sty.num, width: 110}}>Gross</th>
          </tr></thead>
          <tbody>
            {rev.map((r,i)=>(
              <tr key={i}>
                <td style={{...sty.td, fontFamily:'ui-monospace, monospace', fontSize:10}}>{r.code}</td>
                <td style={sty.td}>{r.desc}</td>
                <td style={{...sty.td, ...sty.num}}>{fmt(r.net)}</td>
                <td style={{...sty.td, ...sty.num}}>{fmt(r.tax)}</td>
                <td style={{...sty.td, ...sty.num}}>{fmt(r.svc)}</td>
                <td style={{...sty.td, ...sty.num, fontWeight:600}}>{fmt(r.gross)}</td>
              </tr>
            ))}
            <tr>
              <td style={{...sty.td, ...sty.totRow}}></td>
              <td style={{...sty.td, ...sty.totRow}}>TOTAL</td>
              <td style={{...sty.td, ...sty.num, ...sty.totRow}}>{fmt(totals.net)}</td>
              <td style={{...sty.td, ...sty.num, ...sty.totRow}}>{fmt(totals.tax)}</td>
              <td style={{...sty.td, ...sty.num, ...sty.totRow}}>{fmt(totals.svc)}</td>
              <td style={{...sty.td, ...sty.num, ...sty.totRow}}>{fmt(totals.gross)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={sty.sect}>
        <div style={sty.st}>Settlement by Payment Method</div>
        <table style={sty.tbl}>
          <thead><tr>
            <th style={sty.th}>Metode</th>
            <th style={{...sty.th, ...sty.num, width: 60}}>Trx</th>
            <th style={{...sty.th, ...sty.num, width: 110}}>Jumlah</th>
            <th style={{...sty.th, width: 220}}>%</th>
          </tr></thead>
          <tbody>
            {settle.map((s,i)=>{
              const pct = (s.amount/settleTot)*100;
              return (
                <tr key={i}>
                  <td style={sty.td}>{s.method}</td>
                  <td style={{...sty.td, ...sty.num}}>{s.count}</td>
                  <td style={{...sty.td, ...sty.num, fontWeight:600}}>{fmt(s.amount)}</td>
                  <td style={sty.td}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <div style={{...sty.bar, flex:1}}><div style={{...sty.barFill, width:pct+'%'}}/></div>
                      <span style={{fontVariantNumeric:'tabular-nums', fontSize:10, color:'#475569', width:38, textAlign:'right'}}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td style={{...sty.td, ...sty.totRow}}>TOTAL</td>
              <td style={{...sty.td, ...sty.num, ...sty.totRow}}>{settle.reduce((s,r)=>s+r.count,0)}</td>
              <td style={{...sty.td, ...sty.num, ...sty.totRow}}>{fmt(settleTot)}</td>
              <td style={{...sty.td, ...sty.totRow}}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={sty.sect}>
        <div style={sty.st}>Audit Checklist</div>
        <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap:'2px 24px', fontSize:10.5}}>
          {[
            ['Posting room charge harian',     'PASSED · 27 kamar · 19.550.000'],
            ['Posting tax & service charge',   'PASSED · semua transaksi'],
            ['Verifikasi zero-balance check-out', 'PASSED · 4 dari 4 folio'],
            ['Rekonsiliasi pembayaran F&B',    'PASSED · 24 transaksi'],
            ['Roll-over business date',        'PASSED · → 26 Apr 2026'],
            ['Backup database',                'PASSED · 06:09 WIB'],
            ['Selisih kas drawer',             'NIHIL · IDR 0'],
            ['No-show & cancellation',         '1 no-show diproses'],
          ].map(([k,v],i)=>(
            <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'0.5px dotted #cbd5e1'}}>
              <span style={{color:'#475569'}}>{k}</span>
              <span style={{color:'#0f172a', fontWeight:500}}>✓ {v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:32, marginTop:24}}>
        <div style={sty.sigBox}>Night Auditor<br/><strong style={{color:'#0f172a'}}>Hadi Suryanto</strong></div>
        <div style={sty.sigBox}>Acc. Manager<br/><strong style={{color:'#0f172a'}}>Linda Hartati</strong></div>
        <div style={sty.sigBox}>General Manager<br/><strong style={{color:'#0f172a'}}>Bambang R.</strong></div>
      </div>

      <div style={sty.pageFoot}>
        <span>Night Audit · 25 Apr 2026</span>
        <span>ZADD Hotel · Bandung</span>
        <span>Halaman 1 dari 1</span>
      </div>
    </div>
  );
}

Object.assign(window, { PrintFolio, PrintNightReport });
