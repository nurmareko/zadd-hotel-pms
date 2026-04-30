// Shared bits: icons, sidebars, topbar, helpers
const { useState } = React;

const fmtIDR = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID').replace(/,/g, '.');
const fmtNum = (n) => Math.round(n).toLocaleString('id-ID').replace(/,/g, '.');

// ─── Icons (lucide-style, 16/18px) ───
const I = {
  home: (p)    => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V21H3z"/><path d="M9 21V12h6v9"/></svg>,
  grid: (p)    => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  list: (p)    => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
  bed: (p)     => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9V20M2 14h20M22 14V9a3 3 0 0 0-3-3H10v8"/><circle cx="6" cy="11" r="1.5"/></svg>,
  user: (p)    => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users: (p)   => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  receipt: (p) => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>,
  logout: (p)  => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  search: (p)  => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  plus: (p)    => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  filter: (p)  => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.5V19l4 2v-8.5z"/></svg>,
  download: (p)=> <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  printer: (p) => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  arrow: (p)   => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  arrowDown: (p)=> <svg width={p?.s||10} height={p?.s||10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>,
  sort: (p)    => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 5v14M11 9L7 5 3 9M17 19V5M21 15l-4 4-4-4"/></svg>,
  caretUp: (p) => <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7l6 8H6z"/></svg>,
  more: (p)    => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>,
  edit: (p)    => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>,
  trash: (p)   => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>,
  check: (p)   => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>,
  x: (p)       => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  chev: (p)    => <svg width={p?.s||12} height={p?.s||12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>,
  chevL: (p)   => <svg width={p?.s||12} height={p?.s||12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6"/></svg>,
  cal: (p)     => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  clock: (p)   => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  alert: (p)   => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>,
  shield: (p)  => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  utensils: (p)=> <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2M7 2v20M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>,
  coffee: (p)  => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v3M10 2v3M14 2v3"/></svg>,
  calc: (p)    => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01M8 10h.01M12 10h.01M16 10h.01"/></svg>,
  moon: (p)    => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  cog: (p)     => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  tag: (p)     => <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/></svg>,
  building: (p)=> <svg width={p?.s||16} height={p?.s||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zM6 12H2v10h4M18 9h4v13h-4M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>,
  refresh: (p) => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>,
  loc: (p)     => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  bell: (p)    => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>,
  key: (p)     => <svg width={p?.s||14} height={p?.s||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></svg>,
};

// ─── Sidebar nav (desktop) ───
function Sidebar({ module, active }) {
  const data = {
    fo: {
      label: 'Front Office', short: 'FO',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' },
        { id: 'tape',      label: 'Tape Chart', icon: 'grid' },
        { id: 'res-list',  label: 'Reservasi', icon: 'list' },
        { id: 'res-new',   label: 'Reservasi Baru', icon: 'plus' },
        { id: 'checkin',   label: 'Check-in', icon: 'arrow' },
        { id: 'folio',     label: 'Guest Folio', icon: 'receipt' },
        { id: 'checkout',  label: 'Check-out', icon: 'logout' },
      ],
    },
    fb: {
      label: 'Food & Beverage', short: 'F&B',
      items: [
        { id: 'tables',  label: 'Daftar Meja', icon: 'grid' },
        { id: 'order',   label: 'Captain Order', icon: 'utensils' },
        { id: 'bill',    label: 'Bill Detail', icon: 'receipt' },
        { id: 'payment', label: 'Pembayaran', icon: 'tag' },
      ],
    },
    acc: {
      label: 'Akuntansi', short: 'ACC',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'home' },
        { id: 'audit',     label: 'Night Audit', icon: 'moon' },
        { id: 'report',    label: 'Night Report', icon: 'receipt' },
      ],
    },
    admin: {
      label: 'Admin', short: 'ADM',
      items: [
        { id: 'users',    label: 'Pengguna', icon: 'users' },
        { id: 'rooms',    label: 'Kamar & Tipe', icon: 'bed' },
        { id: 'articles', label: 'Articles', icon: 'tag' },
        { id: 'menu',     label: 'F&B Menu', icon: 'coffee' },
        { id: 'settings', label: 'Pengaturan Hotel', icon: 'cog' },
      ],
    },
  }[module];
  return (
    <aside className="zd-side">
      <div className="brand">
        <div className="mark">Z</div>
        <div className="name">ZADD PMS<small>{data.label}</small></div>
      </div>
      <div className="group">
        <div className="group-label">{data.short} Module</div>
        {data.items.map(it => (
          <div key={it.id} className={'nav-item ' + (active === it.id ? 'active' : '')}>
            {I[it.icon]({s:15})}
            <span>{it.label}</span>
          </div>
        ))}
      </div>
      <div className="footer">
        <div className="avatar">DW</div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{color:'white', fontWeight:500, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Dewi Wulandari</div>
          <div style={{fontSize:11}}>{data.label}</div>
        </div>
        {I.logout({s:14})}
      </div>
    </aside>
  );
}

function Topbar({ crumbs = [], date = '26 Apr 2026', user = 'Dewi W.', userRole = 'FO Officer' }) {
  return (
    <header className="zd-topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            {i === crumbs.length - 1 ? <strong>{c}</strong> : <span>{c}</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="biz-date">
        <span className="dot"/>
        <span>Business Date</span>
        <strong style={{color:'var(--slate-900)', fontWeight:600}}>{date}</strong>
      </div>
      <div className="user">
        <div className="av">{user.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
        <div>
          <div style={{fontWeight:500, color:'var(--slate-900)'}}>{user}</div>
          <div className="muted" style={{fontSize:11}}>{userRole}</div>
        </div>
      </div>
    </header>
  );
}

function Badge({ kind, children }) {
  return <span className={'badge ' + kind}><span className="pip"/>{children}</span>;
}

function Field({ label, required, hint, error, children, span }) {
  return (
    <div className={'fld ' + (error ? 'invalid' : '') + (span ? ' full' : '')}>
      <label>{label}{required && <span className="req">*</span>}</label>
      {children}
      {error && <div className="err">{error}</div>}
      {hint && !error && <div className="hint">{hint}</div>}
    </div>
  );
}

function PageHeader({ title, sub, actions }) {
  return (
    <div className="zd-page-h">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

// Mobile bottom nav (housekeeping)
function HKBottomNav({ active }) {
  const items = [
    { id: 'rooms',    label: 'Kamar', icon: 'bed' },
    { id: 'tasks',    label: 'Tugas', icon: 'list' },
    { id: 'history',  label: 'Riwayat', icon: 'clock' },
    { id: 'profile',  label: 'Profil', icon: 'user' },
  ];
  return (
    <div className="m-bottom">
      {items.map(it => (
        <div key={it.id} className={'nav ' + (active === it.id ? 'active' : '')}>
          {I[it.icon]({s:20})}
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { I, fmtIDR, fmtNum, Sidebar, Topbar, Badge, Field, PageHeader, HKBottomNav });
