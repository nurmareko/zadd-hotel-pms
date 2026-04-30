// Permission Matrix — roles × actions/use-cases
// Lives under Admin module. Designed for review and audit.

function PermissionMatrix() {
  const ROLES = [
    { id: 'admin',    label: 'Admin',           short: 'ADM', color: 'var(--slate-700)' },
    { id: 'fo',       label: 'FO Officer',      short: 'FO',  color: 'var(--blue-600)' },
    { id: 'hk',       label: 'HK Staff',        short: 'HK',  color: 'var(--emerald-600)' },
    { id: 'fb',       label: 'F&B Officer',     short: 'F&B', color: 'var(--amber-600)' },
    { id: 'aud',      label: 'Night Auditor',   short: 'AUD', color: 'var(--slate-900)' },
  ];

  // Permissions: F = full, R = read-only, '—' = no access
  // Rows are use-cases drawn from feature_list_mvp.md
  const G = (...cells) => cells; // typing helper
  const GROUPS = [
    {
      label: 'Front Office',
      rows: [
        ['Lihat dashboard FO',           G('R','F','—','—','R')],
        ['Lihat & buka Tape Chart',      G('R','F','R','—','R')],
        ['Buat reservasi baru',          G('F','F','—','—','—')],
        ['Edit / batal reservasi',       G('F','F','—','—','—')],
        ['Proses check-in',              G('—','F','—','—','—')],
        ['Posting charge ke folio',      G('F','F','—','F','F')],
        ['Buka & cetak folio',           G('F','F','—','—','R')],
        ['Proses check-out',             G('—','F','—','—','—')],
        ['Verifikasi zero-balance',      G('R','F','—','—','F')],
      ],
    },
    {
      label: 'Housekeeping',
      rows: [
        ['Lihat status semua kamar',     G('R','R','F','—','R')],
        ['Update status kamar',          G('F','—','F','—','—')],
        ['Tandai Out of Order (OOO)',    G('F','F','F','—','—')],
        ['Lihat catatan/log HK',         G('F','R','F','—','R')],
      ],
    },
    {
      label: 'Food & Beverage',
      rows: [
        ['Lihat status meja',            G('R','R','—','F','R')],
        ['Buat captain order',           G('—','—','—','F','—')],
        ['Edit / void item order',       G('F','—','—','F','—')],
        ['Print bill',                   G('F','—','—','F','—')],
        ['Charge to room',               G('F','F','—','F','—')],
        ['Pembayaran tunai/non-tunai',   G('F','—','—','F','—')],
      ],
    },
    {
      label: 'Akuntansi',
      rows: [
        ['Lihat dashboard akuntansi',    G('F','—','—','—','F')],
        ['Jalankan night audit',         G('—','—','—','—','F')],
        ['Cetak Night Report',           G('F','—','—','—','F')],
        ['Adjust posting (jurnal)',      G('F','—','—','—','F')],
        ['Lihat revenue & RevPAR',       G('F','—','—','—','F')],
      ],
    },
    {
      label: 'Admin & Master Data',
      rows: [
        ['Kelola pengguna & role',       G('F','—','—','—','—')],
        ['Master kamar & tipe kamar',    G('F','R','R','—','R')],
        ['Master Articles & tarif',      G('F','R','—','R','R')],
        ['Master menu F&B',              G('F','—','—','R','—')],
        ['Pengaturan hotel & pajak',     G('F','—','—','—','—')],
        ['Reset password pengguna',      G('F','—','—','—','—')],
        ['Lihat audit log sistem',       G('F','—','—','—','F')],
      ],
    },
  ];

  // Cell renderer
  const Cell = ({ v }) => {
    if (v === 'F') return (
      <div title="Full access" style={{
        width: 26, height: 26, borderRadius: 4, margin: '0 auto',
        background: 'var(--accent, #0f172a)', color: 'var(--accent-fg, white)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
      }}>●</div>
    );
    if (v === 'R') return (
      <div title="Read-only" style={{
        width: 26, height: 26, borderRadius: 4, margin: '0 auto',
        background: 'var(--accent-soft, #e2e8f0)', color: 'var(--accent-soft-fg, #0f172a)',
        border: '1px solid var(--slate-200)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600,
      }}>○</div>
    );
    return (
      <div title="No access" style={{
        width: 26, height: 26, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--slate-300)', fontSize: 14,
      }}>—</div>
    );
  };

  // Count totals per role for footer
  const totals = ROLES.map((_, ri) => {
    let f = 0, r = 0, n = 0;
    GROUPS.forEach(g => g.rows.forEach(([_lbl, cells]) => {
      const v = cells[ri];
      if (v === 'F') f++; else if (v === 'R') r++; else n++;
    }));
    return { f, r, n, total: f+r+n };
  });

  return (
    <div className="zd"><div className="zd-app">
      <Sidebar module="admin" active="users"/>
      <main className="zd-main">
        <Topbar crumbs={['Admin', 'Permission Matrix']}/>
        <div className="zd-content">
          <PageHeader
            title="Permission Matrix"
            sub="Hak akses per role × use-case. Setiap akun MVP dibatasi pada satu role."
            actions={<>
              <button className="btn">{I.refresh()} Sinkron Role</button>
              <button className="btn">Export CSV</button>
              <button className="btn primary">Edit Matrix</button>
            </>}
          />

          {/* Legend */}
          <div className="card" style={{marginBottom:12}}>
            <div style={{display:'flex', alignItems:'center', gap:24, padding:'10px 14px', flexWrap:'wrap'}}>
              <div style={{fontSize:11, fontWeight:600, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em'}}>Legend</div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
                <Cell v="F"/>
                <span style={{color:'var(--slate-700)'}}><strong>Full</strong> · dapat membaca, membuat, mengubah, dan menghapus</span>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
                <Cell v="R"/>
                <span style={{color:'var(--slate-700)'}}><strong>Read-only</strong> · hanya dapat melihat, tidak dapat mengubah</span>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
                <Cell v=""/>
                <span style={{color:'var(--slate-700)'}}><strong>None</strong> · tidak memiliki akses</span>
              </div>
              <div style={{marginLeft:'auto', fontSize:11.5, color:'var(--slate-500)'}}>
                Terakhir diperbarui · 24 Apr 2026 oleh <strong style={{color:'var(--slate-700)'}}>Bambang R. (Admin)</strong>
              </div>
            </div>
          </div>

          {/* Matrix */}
          <div className="card">
            <div className="card-h">
              <h3>Matrix · 30 use-case × 5 role</h3>
              <span className="meta">Skema RBAC · Versi 1.4</span>
            </div>
            <div style={{padding:0, overflow:'auto'}}>
              <table className="tbl" style={{minWidth: 760}}>
                <thead>
                  <tr>
                    <th style={{width: 280, position:'sticky', left:0, background:'var(--slate-50)', zIndex:2}}>Use-case</th>
                    {ROLES.map(r => (
                      <th key={r.id} style={{textAlign:'center', minWidth: 110}}>
                        <div style={{fontSize:11, fontWeight:700, color:'var(--slate-900)', textTransform:'none', letterSpacing:0}}>{r.label}</div>
                        <div style={{fontSize:10, fontWeight:500, color:'var(--slate-500)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2}}>{r.short}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((g, gi) => (
                    <React.Fragment key={gi}>
                      <tr>
                        <td colSpan={6} style={{
                          background:'var(--slate-100)',
                          padding:'7px 12px',
                          fontSize:10.5, fontWeight:700,
                          color:'var(--slate-600)',
                          textTransform:'uppercase', letterSpacing:'0.08em',
                          borderBottom:'1px solid var(--slate-200)',
                          position:'sticky', left:0,
                        }}>{g.label} · {g.rows.length} use-case</td>
                      </tr>
                      {g.rows.map(([label, cells], ri) => (
                        <tr key={gi+'-'+ri}>
                          <td style={{position:'sticky', left:0, background:'white', borderRight:'1px solid var(--slate-100)', fontWeight: 500, color:'var(--slate-900)'}}>{label}</td>
                          {cells.map((v, ci) => (
                            <td key={ci} style={{textAlign:'center', padding:'6px 4px'}}><Cell v={v}/></td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {/* Totals row */}
                  <tr style={{borderTop:'2px solid var(--slate-300)'}}>
                    <td style={{position:'sticky', left:0, background:'var(--slate-50)', fontWeight:700, color:'var(--slate-900)', borderRight:'1px solid var(--slate-200)'}}>Ringkasan Akses</td>
                    {totals.map((t, i) => (
                      <td key={i} style={{textAlign:'center', background:'var(--slate-50)', padding:'10px 6px', fontVariantNumeric:'tabular-nums'}}>
                        <div style={{fontSize:11, color:'var(--slate-500)', display:'flex', justifyContent:'center', gap:6}}>
                          <span><strong style={{color:'var(--slate-900)'}}>{t.f}</strong> F</span>
                          <span style={{color:'var(--slate-300)'}}>·</span>
                          <span><strong style={{color:'var(--slate-700)'}}>{t.r}</strong> R</span>
                          <span style={{color:'var(--slate-300)'}}>·</span>
                          <span><strong style={{color:'var(--slate-400)'}}>{t.n}</strong> —</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="card-f" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:11.5, color:'var(--slate-500)'}}>
                Perubahan matrix akan tercatat pada <strong style={{color:'var(--slate-700)'}}>Audit Log</strong> dan berlaku setelah pengguna login ulang.
              </span>
              <span style={{fontSize:11, color:'var(--slate-400)', fontFamily:'ui-monospace, monospace'}}>RBAC-v1.4 · 30×5 = 150 cells</span>
            </div>
          </div>
        </div>
      </main>
    </div></div>
  );
}

Object.assign(window, { PermissionMatrix });
