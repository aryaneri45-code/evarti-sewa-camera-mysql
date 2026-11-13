import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Banknote,
  BarChart3, Bell, CalendarDays, Camera, Check, CheckCircle2, ChevronDown,
  ChevronRight, Clock3, CreditCard, FileText, Filter, ImagePlus, LayoutDashboard,
  LogOut, Menu, MoreHorizontal, Plus, Printer, Search, Settings2, ShieldCheck,
  ShoppingBag, SlidersHorizontal, Sparkles, Store, UserRound, Users, Wallet,
  Trash2, X, FolderInput, Save, RotateCcw,
} from 'lucide-react';
import { api, assetUrl, imageCredentials } from './services/api.js';
import { printer, testReceipt } from './services/printer.js';
import { printGeometry } from './services/receipt-encoder.js';
import PrinterSettings, { usePrinter } from './components/PrinterSettings.jsx';
import DailyTransactionReport from './components/DailyTransactionReport.jsx';
import { loadDailyTransactions } from './services/history-report.js';

const demoUsers = [
  { username: 'owner', name: 'Akbar', role: 'owner', title: 'Owner' },
  { username: 'kasir1', name: 'Tanada', role: 'kasir', title: 'Kasir 1' },
  { username: 'kasir2', name: 'Stand', role: 'kasir', title: 'Kasir 2' },
];

const currentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};
const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(amount) || 0);
const formatDate = (value = new Date()) => new Intl.DateTimeFormat('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(value));
const addonCategoryLabels = {
  property: 'Properti',
  photographer: 'Fotografer',
  print: 'Print foto',
  transfer: 'Pemindahan file',
};
const jakartaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
});
const addonCategoryIcons = { property: Camera, photographer: Users, print: Printer, transfer: FolderInput };
const formatJakartaDate = (date = new Date()) => jakartaDateFormatter.format(date);
const calcEndTime = (start, minutes) => {
  if (!start || !minutes) return '';
  const [hours, mins] = start.split(':').map(Number);
  const total = (hours * 60 + mins + Number(minutes)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const normalizeWhatsapp = (input) => {
  const digits = input.replace(/\D/g, '');
  if (!/^(?:\+?62|08)\d{7,13}$/.test(input)) return null;
  return digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
};

function CameraArtwork({ tone = 'pink', image, large = false }) {
  if (image) return <img className={`camera-art camera-art-${tone} ${large ? 'camera-art-large' : ''}`} src={assetUrl(image)} crossOrigin={imageCredentials} alt="" />;
  return (
    <div className={`camera-art camera-art-${tone} ${large ? 'camera-art-large' : ''}`}>
      <div className="camera-glow" />
      <svg viewBox="0 0 220 135" role="img" aria-label="Ilustrasi kamera">
        <ellipse cx="112" cy="112" rx="78" ry="10" fill="rgba(48, 31, 37, .10)" />
        <path d="M41 48h31l10-14h54l10 14h26a9 9 0 0 1 9 9v45a10 10 0 0 1-10 10H48a10 10 0 0 1-10-10V58a10 10 0 0 1 3-10Z" fill="#f8f7f5" stroke="#d5d1d1" strokeWidth="2" />
        <path d="M41 58h140v42a10 10 0 0 1-10 10H48a10 10 0 0 1-10-10V58Z" fill="#e9e6e4" />
        <path d="M43 49h25v5H43zM150 43h15v4h-15z" fill="#aaa4a4" />
        <circle cx="111" cy="77" r="29" fill="#555358" stroke="#c4bebe" strokeWidth="5" />
        <circle cx="111" cy="77" r="20" fill="#25272e" />
        <circle cx="105" cy="71" r="10" fill="#5e7180" />
        <circle cx="102" cy="68" r="4" fill="#c1dce8" opacity=".8" />
        <rect x="55" y="59" width="18" height="5" rx="2.5" fill="#d4cfd0" />
        <circle cx="163" cy="58" r="4" fill="#f08b9e" />
        <rect x="51" y="93" width="19" height="3" rx="1.5" fill="#cac5c5" />
      </svg>
      <span className="camera-art-caption">EVARTI CAMERA</span>
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <img className="brand-logo" src="/evarti-logo.png" alt="Evarti — Weaving stories into your life" />
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onLogin(username, password);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="login-page">
      <div className="login-visual">
        <div className="login-orb login-orb-one" /><div className="login-orb login-orb-two" />
        <Brand />
        <div className="login-visual-copy">
          <span className="eyebrow eyebrow-light"><Sparkles size={13} /> RENTAL STUDIO</span>
          <h1>Setiap cerita,<br /><em>punya caranya.</em></h1>
          <p>Kelola penyewaan kamera dengan mudah, dari awal sampai momen terakhir.</p>
          <div className="login-camera"><CameraArtwork large /></div>
        </div>
        <div className="login-visual-foot"><span>01 / 03</span><div className="login-progress"><i /></div><span>EVARTI RENTAL</span></div>
      </div>
      <div className="login-panel">
        <div className="login-mobile-brand"><Brand /></div>
        <div className="login-box">
          <span className="eyebrow">SELAMAT DATANG KEMBALI</span>
          <h2>Masuk ke Evarti</h2>
          <p className="login-subtitle">Gunakan akun kasir atau owner untuk melanjutkan.</p>
          <form onSubmit={submit} className="login-form">
            <label className="field-label" htmlFor="username">Username</label>
            <div className="input-icon-wrap"><UserRound size={17} /><select id="username" value={username} onChange={(event) => setUsername(event.target.value)}>
              {demoUsers.map((user) => <option key={user.username} value={user.username}>{user.title} — {user.name}</option>)}
            </select><ChevronDown size={16} className="select-chevron" /></div>
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" className="text-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" autoComplete="current-password" />
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="button button-primary button-full login-submit" type="submit" disabled={submitting}>{submitting ? 'Memeriksa akun...' : 'Masuk ke dashboard'} <ArrowRight size={17} /></button>
          </form>
          <div className="login-hint"><ShieldCheck size={16} /><span>Akses terbatas untuk tim Evarti</span></div>
        </div>
        <div className="login-foot">© 2026 Evarti Rental Studio <span>•</span> Weaving stories into your life</div>
      </div>
    </main>
  );
}

function StatCard({ label, value, detail, icon: Icon, tone = 'pink', trend }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={18} /></div></div>
      <strong>{value}</strong>
      <div className="stat-foot">{trend && <span className="stat-trend"><ArrowUpRight size={13} /> {trend}</span>}<span>{detail}</span></div>
    </div>
  );
}

function Receipt({ transaction, variant = 'customer' }) {
  const { settings: { paperWidth } } = usePrinter();
  const geometry = printGeometry(paperWidth);
  const paperStyle = { '--receipt-paper-width': `${paperWidth}mm`, '--receipt-side-padding': `${geometry.sidePadding}mm` };
  const printRoot = useRef(null);
  const pageStyle = useRef(null);

  useLayoutEffect(() => {
    const paper = printRoot.current?.querySelector('.receipt-paper');
    if (!paper) return undefined;
    const updatePageSize = () => {
      // CSS pixels are 1/96 inch. Round up and allow 1 mm for print rounding.
      const heightMm = Math.ceil(paper.getBoundingClientRect().height * 25.4 / 96) + 1;
      pageStyle.current.textContent = `@page { size: ${paperWidth}mm ${heightMm}mm; margin: 0; }`;
    };
    updatePageSize();
    const observer = new ResizeObserver(updatePageSize);
    observer.observe(paper);
    window.addEventListener('beforeprint', updatePageSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('beforeprint', updatePageSize);
    };
  }, [transaction, variant, paperWidth]);

  if (!transaction) return null;
  return <>
    <div className="receipt-preview-root" style={paperStyle}><ReceiptContent transaction={transaction} variant={variant} /></div>
    {createPortal(<div className="receipt-print-root" ref={printRoot} style={paperStyle} data-receipt-id={transaction.id || transaction.receiptNo} data-receipt-variant={variant} data-paper-width={paperWidth} aria-hidden="true">
      <style ref={pageStyle} media="print" />
      <ReceiptContent transaction={transaction} variant={variant} />
    </div>, document.body)}
  </>;
}

function ReceiptContent({ transaction, variant = 'customer' }) {
  if (!transaction) return null;
  const currency = (value) => formatCurrency(value).replace('IDR', 'Rp');
  const items = transaction.items?.length ? transaction.items : [{
    cameraId: transaction.cameraId,
    cameraName: transaction.cameraName || 'Pilih kamera',
    durationLabel: transaction.durationLabel,
    price: transaction.total,
    isManualPrice: transaction.isManualPrice,
  }];
  const addons = transaction.addons || [];
  if (variant === 'admin') {
    return (
      <div className="receipt-paper receipt-admin">
        <img className="receipt-logo" src="/evarti-logo.png" alt="Evarti — Weaving stories into your life" />
        <div className="receipt-admin-title">NEW ORDER</div>
        <div className="receipt-rule" />
        <div className="receipt-row"><span>No. Struk</span><b>{transaction.receiptNo}</b></div>
        <div className="receipt-row"><span>Tanggal</span><b>{new Intl.DateTimeFormat('id-ID').format(new Date(transaction.createdAt))}</b></div>
        <div className="receipt-row"><span>Jam Mulai</span><b>{transaction.startTime}</b></div>
        <div className="receipt-row"><span>Jam Selesai</span><b>{transaction.endTime}</b></div>
        <div className="receipt-row"><span>Penyewa</span><b>{transaction.customerName}</b></div>
        <div className="receipt-row"><span>No. WA</span><b>{transaction.customerWhatsapp}</b></div>
        {transaction.customerPagerNumber && <div className="receipt-row"><span>No. Pager</span><b>{transaction.customerPagerNumber}</b></div>}
        <div className="receipt-rule" />
        {items.map((item, index) => <div className="receipt-admin-item" key={`${item.cameraId || item.cameraName}-${index}`}>
          {item.durationLabel}{item.isManualPrice ? ' (Manual)' : ''} - {item.cameraName}
        </div>)}
        {addons.map((addon) => <div className="receipt-admin-item" key={addon.id}>
          {addon.isManual ? 'Add-on' : addonCategoryLabels[addon.category]} - {addon.label}{addon.price > 0 ? ` - ${currency(addon.price)}` : ''}
        </div>)}
      </div>
    );
  }
  return (
    <div className="receipt-paper">
      <img className="receipt-logo" src="/evarti-logo.png" alt="Evarti — Weaving stories into your life" />
      <div className="receipt-rule" />
      <div className="receipt-row"><span>No. Struk</span><b>{transaction.receiptNo}</b></div>
      <div className="receipt-row"><span>Tanggal</span><b>{new Intl.DateTimeFormat('id-ID').format(new Date(transaction.createdAt))}</b></div>
      <div className="receipt-row"><span>Jam Mulai</span><b>{transaction.startTime}</b></div>
      <div className="receipt-row"><span>Jam Selesai</span><b>{transaction.endTime}</b></div>
      <div className="receipt-row"><span>Penyewa</span><b>{transaction.customerName || 'Nama penyewa'}</b></div>
      <div className="receipt-row"><span>No. WA</span><b>{transaction.customerWhatsapp || '08xxxxxxxxxx'}</b></div>
      {transaction.customerPagerNumber && <div className="receipt-row"><span>No. Pager</span><b>{transaction.customerPagerNumber}</b></div>}
      <div className="receipt-rule" />
      {items.map((item, index) => <React.Fragment key={`${item.cameraId || item.cameraName}-${index}`}>
        <div className="receipt-item-name">{item.cameraName}</div>
        <div className="receipt-row receipt-item-price"><span>{item.durationLabel}{item.isManualPrice ? ' · Tarif Manual' : ''}</span><b>{currency(item.price)}</b></div>
      </React.Fragment>)}
      {addons.map((addon) => <React.Fragment key={addon.id}>
        <div className="receipt-item-name">{addon.isManual ? 'Add-on' : addonCategoryLabels[addon.category]} · {addon.label}</div>
        <div className="receipt-row receipt-item-price"><span>Add-on</span><b>{addon.price > 0 ? currency(addon.price) : 'Gratis'}</b></div>
      </React.Fragment>)}
      <div className="receipt-rule" />
      <div className="receipt-row receipt-total"><span>TOTAL</span><b>{currency(transaction.total)}</b></div>
      <div className="receipt-row"><span>Bayar</span><b>{transaction.paymentMethod === 'qris_dana' ? 'QRIS DANA' : 'Tunai'}</b></div>
      {transaction.paymentMethod === 'cash' && <>
        <div className="receipt-row"><span>Diterima</span><b>{currency(transaction.amountReceived)}</b></div>
        <div className="receipt-row"><span>Kembali</span><b>{currency(transaction.change)}</b></div>
      </>}
      <div className="receipt-rule" />
      <div className="receipt-terms">Keterlambatan dikenakan denda.<br />Kerusakan/kehilangan menjadi<br />tanggung jawab penyewa.</div>
      <div className="receipt-rule" />
      <div className="receipt-social">TikTok &amp; IG: @evartistore</div>
      <div className="receipt-thanks">Terima kasih!</div>
    </div>
  );
}

function App() {
  const printerState = usePrinter();
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [appError, setAppError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [addons, setAddons] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportDate, setReportDate] = useState(formatJakartaDate);
  const [reportPeriod, setReportPeriod] = useState('weekly');
  const [reportCashier, setReportCashier] = useState('all');
  const [reportLocation, setReportLocation] = useState('all');
  const [page, setPage] = useState('dashboard');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [notice, setNotice] = useState('');
  const [savedTransaction, setSavedTransaction] = useState(null);
  const [catalogDraft, setCatalogDraft] = useState(null);
  const [addonDraft, setAddonDraft] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLocation, setHistoryLocation] = useState('all');
  const [historyCashier, setHistoryCashier] = useState('all');
  const [historyDate, setHistoryDate] = useState('');
  const [printSelection, setPrintSelection] = useState(null);
  const [printSubmitting, setPrintSubmitting] = useState(false);
  const [printVariant, setPrintVariant] = useState('customer');
  const printTimer = useRef(null);

  useEffect(() => {
    if (!user) return undefined;
    printer.reconnect();
    const serial = navigator.serial;
    const connected = () => printer.reconnect();
    const disconnected = (event) => printer.handleDisconnect(event.target);
    serial?.addEventListener('connect', connected);
    serial?.addEventListener('disconnect', disconnected);
    return () => {
      serial?.removeEventListener('connect', connected);
      serial?.removeEventListener('disconnect', disconnected);
    };
  }, [user]);

  const refreshWorkspace = useCallback(async () => {
    setWorkspaceLoading(true);
    setAppError('');
    try {
      const [cameraResult, addonResult, transactionResult] = await Promise.all([
        api.cameras(),
        api.addons(),
        api.transactions({ limit: 100 }),
      ]);
      setCameras(cameraResult.cameras);
      setAddons(addonResult.addons);
      setTransactions(transactionResult.transactions);
    } catch (error) {
      if (error.status !== 401) setAppError(error.message);
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  useEffect(() => {
    const unauthorized = () => {
      setUser(null);
      setCameras([]);
      setAddons([]);
      setTransactions([]);
      setPage('dashboard');
    };
    window.addEventListener('evarti:unauthorized', unauthorized);
    api.me().then(({ user: currentUser }) => {
      setUser(currentUser);
    }).catch((error) => {
      if (error.status !== 401) setAppError(error.message);
    }).finally(() => setBooting(false));
    return () => window.removeEventListener('evarti:unauthorized', unauthorized);
  }, []);

  useEffect(() => {
    if (!user) {
      setCameras([]);
      setAddons([]);
      setTransactions([]);
      return;
    }
    refreshWorkspace();
  }, [user, refreshWorkspace]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => () => window.clearTimeout(printTimer.current), []);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => { setIsMobile(media.matches); if (!media.matches) setMobileMenu(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobileMenu || !isMobile) return undefined;
    const previousFocus = document.activeElement;
    const sidebar = document.getElementById('workspace-navigation');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar?.querySelector('button')?.focus();
    const keyboard = (event) => {
      if (event.key === 'Escape') setMobileMenu(false);
      if (event.key !== 'Tab' || !sidebar) return;
      const controls = [...sidebar.querySelectorAll('button:not(:disabled), a[href]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard);
      previousFocus?.focus();
    };
  }, [mobileMenu, isMobile]);
  useEffect(() => {
    const dirty = addonDraft?.some((local) => {
      const saved = addons.find((entry) => entry.id === local.id);
      return saved && ['label', 'price', 'active'].some((field) => String(local[field]) !== String(saved[field]));
    });
    if (!user || !dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [addonDraft, addons, user]);

  const login = async (username, password) => {
    const result = await api.login(username, password);
    setAppError('');
    setUser(result.user);
    setAddonDraft(null);
    setPage('dashboard');
  };
  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUser(null);
      setCameras([]);
      setTransactions([]);
      setPage('dashboard');
    }
  };
  const isOwner = user?.role === 'owner';
  const visibleCameras = cameras.filter((camera) => camera.active);
  const visibleTransactions = transactions.filter((transaction) => (
    isOwner || transaction.cashierId === user?.username
  ));
  const todayDate = formatJakartaDate();
  const todayTransactions = visibleTransactions.filter((transaction) => (
    formatJakartaDate(new Date(transaction.createdAt)) === todayDate
  ));
  const paidToday = todayTransactions.filter((transaction) => transaction.paymentStatus === 'paid');
  const revenueToday = paidToday.reduce((sum, transaction) => sum + Number(transaction.total), 0);

  const openPrint = (transaction) => {
    if (transaction.paymentStatus !== 'paid') {
      setNotice('Struk hanya dapat dicetak setelah pembayaran lunas.');
      return;
    }
    setPrintSelection(transaction);
  };

  const selectPrintVariant = async (variant) => {
    const transaction = printSelection;
    if (!transaction || printSubmitting) return;
    setPrintSubmitting(true);
    try {
      const result = await api.markPrinted(transaction.id);
      setSavedTransaction(result.transaction);
      setTransactions((previous) => previous.map((item) => item.id === transaction.id ? result.transaction : item));
      setPrintVariant(variant);
      setPrintSelection(null);
      setPage(`print-${variant}`);
      await sendToPrinter(result.transaction, variant, 220);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPrintSubmitting(false);
    }
  };

  const printSelectedVariant = async () => {
    if (!savedTransaction || printSubmitting) return;
    setPrintSubmitting(true);
    try {
      const result = await api.markPrinted(savedTransaction.id);
      setSavedTransaction(result.transaction);
      setTransactions((previous) => previous.map((item) => item.id === savedTransaction.id ? result.transaction : item));
      await sendToPrinter(result.transaction, printVariant, 100);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPrintSubmitting(false);
    }
  };

  const sendToPrinter = async (transaction, variant, delay) => {
    await new Promise((resolve) => { printTimer.current = window.setTimeout(resolve, delay); });
    const result = await printer.print(transaction, variant);
    if (result === 'sent') setNotice('Data struk dikirim. Periksa hasil cetak pada printer.');
    if (result === 'handoff') setNotice('Struk diserahkan ke RawBT. Periksa hasil cetak di aplikasi tersebut.');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'create', label: 'Buat struk', icon: Plus },
    { id: 'history', label: 'Riwayat transaksi', icon: FileText, count: visibleTransactions.length },
    ...(isOwner ? [{ id: 'catalog', label: 'Katalog sewa', icon: Camera }] : []),
    ...(isOwner ? [{ id: 'reports', label: 'Laporan', icon: BarChart3 }] : []),
    { id: 'printer', label: 'Printer', icon: Printer },
  ];

  if (booting) return <main className="login-page"><div className="login-panel"><div className="login-box"><span className="eyebrow">EVARTI RENTAL STUDIO</span><h2>Memeriksa sesi...</h2><p className="login-subtitle">Menghubungkan ke server dengan aman.</p></div></div></main>;
  if (!user) return <><Login onLogin={login} />{appError && <div className="toast"><X size={17} />{appError}</div>}</>;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Langsung ke konten</a>
      <aside id="workspace-navigation" aria-label="Menu workspace" inert={isMobile && !mobileMenu ? '' : undefined} className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand"><Brand /><button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Tutup menu"><X size={19} /></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {navItems.map(({ id, label, icon: Icon, count }) => (
            <button aria-current={page === id ? 'page' : undefined} className={`nav-item ${page === id ? 'nav-active' : ''}`} key={id} onClick={() => { setPage(id); setMobileMenu(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{count > 0 && id === 'history' && <small>{count}</small>}
              {page === id && <ChevronRight className="nav-chevron" size={16} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-note"><div className="side-note-icon"><Sparkles size={16} /></div><strong>Keep the moments</strong><p>Setiap momen punya cerita. Terima kasih sudah jadi bagian darinya.</p><span>EVARTI · 2026</span></div>
          <button className="nav-item nav-logout" onClick={logout}><LogOut size={18} /><span>Keluar akun</span></button>
          <div className="profile-row"><div className="avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="profile-meta"><strong>{user.name}</strong><span>{user.title}</span></div><MoreHorizontal size={18} className="profile-more" /></div>
        </div>
      </aside>
      {mobileMenu && <button className="sidebar-backdrop" aria-label="Tutup menu" onClick={() => setMobileMenu(false)} />}
      <main className="main-panel" inert={isMobile && mobileMenu ? '' : undefined}>
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Buka menu" aria-expanded={mobileMenu} aria-controls="workspace-navigation" onClick={() => setMobileMenu(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Evarti Studio</span><ChevronRight size={15} /><strong>{navItems.find((item) => item.id === page)?.label || 'Struk'}</strong></div>
          <div className="topbar-actions"><span className="topbar-date"><CalendarDays size={15} /> {formatDate()}</span><span className="workspace-role"><ShieldCheck size={14} /> {user.title}</span><div className="topbar-avatar" aria-hidden="true">{user.name.slice(0, 1)}</div></div>
        </header>
        <div className="page-content" id="main-content" tabIndex={-1}>
          {appError && <div className="error-banner"><X size={16} />{appError}<button onClick={refreshWorkspace}>Coba lagi</button></div>}
          {workspaceLoading && <div className="loading-banner"><span className="loading-spinner" /> Memuat data terbaru dari server...</div>}
          {page === 'dashboard' && <Dashboard
            user={user} transactions={visibleTransactions} todayTransactions={todayTransactions}
            revenueToday={revenueToday} onNavigate={setPage} onPrint={openPrint}
          />}
          {page === 'create' && <CreateTransaction paperWidth={printerState.settings.paperWidth}
            user={user} cameras={visibleCameras} addons={addons.filter((addon) => addon.active)} onSave={(transaction) => {
              return api.createTransaction(transaction.payload, transaction.guaranteePhoto).then(({ transaction: saved }) => {
                setTransactions((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
                setSavedTransaction(saved);
                setNotice(saved.paymentStatus === 'pending_verification' ? 'Transaksi tersimpan · menunggu verifikasi QRIS' : 'Struk berhasil disimpan');
                return saved;
              });
            }} onVerify={async (transaction) => {
              const { transaction: updated } = await api.verifyTransaction(transaction.id);
              setTransactions((previous) => previous.map((item) => item.id === updated.id ? updated : item));
              setSavedTransaction(updated);
              return updated;
            }} notice={notice} onNotice={setNotice} onPrint={openPrint} savedTransaction={savedTransaction}
          />}
          {page === 'history' && <History
            transactions={visibleTransactions} isOwner={isOwner} search={historySearch}
            setSearch={setHistorySearch} location={historyLocation} setLocation={setHistoryLocation}
            cashier={historyCashier} setCashier={setHistoryCashier} date={historyDate} setDate={setHistoryDate}
            onPrint={openPrint} onVoid={async (transaction) => {
              const reason = window.prompt(`Alasan membatalkan ${transaction.receiptNo}:`);
              if (reason == null) return;
              try {
                const { transaction: updated } = await api.voidTransaction(transaction.id, reason);
                setTransactions((previous) => previous.map((item) => item.id === updated.id ? updated : item));
                setNotice(`${updated.receiptNo} berhasil dibatalkan.`);
              } catch (error) {
                setNotice(error.message);
              }
            }}
          />}
          {page === 'catalog' && isOwner && <Catalog
            cameras={cameras} addons={addons} draft={catalogDraft} setDraft={setCatalogDraft}
            addonDraft={addonDraft} setAddonDraft={setAddonDraft}
            onCreate={async (camera, image) => {
              const { camera: created } = await api.createCamera(camera);
              if (image) await api.uploadCameraImage(created.id, image);
              await refreshWorkspace();
              setNotice('Kamera berhasil ditambahkan ke katalog.');
            }}
            onUpdate={async (id, camera, image) => {
              await api.updateCamera(id, camera);
              if (image) await api.uploadCameraImage(id, image);
              await refreshWorkspace();
              setNotice('Perubahan kamera berhasil disimpan.');
            }}
            onToggle={async (id, active) => {
              await api.toggleCamera(id, active);
              await refreshWorkspace();
              setNotice(active ? 'Kamera kembali aktif di katalog.' : 'Kamera dinonaktifkan dari katalog kasir.');
            }}
            onDeleteCamera={async (camera) => {
              if (!window.confirm(`Hapus kamera "${camera.name}" dari katalog? Detail transaksi lama tetap tersimpan.`)) return;
              await api.deleteCamera(camera.id);
              if (catalogDraft?.id === camera.id) setCatalogDraft(null);
              await refreshWorkspace();
              setNotice('Kamera berhasil dihapus dari katalog.');
            }}
            onCreateAddon={async (addon) => {
              const result = await api.createAddon(addon);
              setAddons((previous) => [...previous, result.addon]);
              setNotice('Add-on berhasil ditambahkan ke katalog.');
            }}
            onDeleteAddon={async (addon) => {
              if (!window.confirm(`Hapus add-on "${addon.label}"? Detail transaksi lama tetap tersimpan.`)) return;
              await api.deleteAddon(addon.id);
              setAddons((previous) => previous.filter((entry) => entry.id !== addon.id));
              setNotice('Add-on berhasil dihapus dari katalog.');
            }}
            onUpdateAddons={async (updatedAddons) => {
              const result = await api.updateAddons(updatedAddons);
              setAddons(result.addons);
              setNotice('Katalog add-on berhasil diperbarui.');
            }}
            onNotice={setNotice}
          />}
          {page === 'reports' && isOwner && <Reports
            report={report} loading={reportLoading} error={reportError}
            date={reportDate} setDate={setReportDate}
            period={reportPeriod} setPeriod={setReportPeriod}
            cashier={reportCashier} setCashier={setReportCashier}
            location={reportLocation} setLocation={setReportLocation}
            onLoad={async () => {
              setReportLoading(true);
              setReportError('');
              try {
                const nextReport = await api.reportSummary({
                  period: reportPeriod,
                  date: reportDate,
                  cashier: reportCashier,
                  location: reportLocation,
                });
                setReport(nextReport);
              } catch (error) {
                setReportError(error.message);
              } finally {
                setReportLoading(false);
              }
            }}
            onExport={async () => {
              try {
                const blob = await api.reportPdf({
                  period: reportPeriod,
                  date: reportDate,
                  cashier: reportCashier,
                  location: reportLocation,
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'evarti-ringkasan-transaksi.pdf';
                link.click();
                URL.revokeObjectURL(url);
              } catch (error) {
                setReportError(error.message);
              }
            }}
          />}
          {page === 'printer' && <><PageHeading eyebrow="PENGATURAN PERANGKAT" title="Printer struk." description="Pilih metode cetak dan printer yang digunakan pada perangkat kasir ini." /><PrinterSettings receiptPreview={<Receipt transaction={testReceipt} />} /></>}
          {(page === 'print-admin' || page === 'print-customer') && savedTransaction && <PrintView transaction={savedTransaction} variant={printVariant} settings={printerState.settings} busy={printSubmitting} onSettings={() => setPage('printer')} onBack={() => setPage('history')} onPrint={printSelectedVariant} onChangeFormat={() => setPrintSelection(savedTransaction)} />}
        </div>
      </main>
      {printSelection && <div className="print-choice-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPrintSelection(null); }}>
        <section className="print-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="print-choice-title">
          <button className="print-choice-close" type="button" onClick={() => setPrintSelection(null)} aria-label="Tutup pilihan cetak"><X size={18} /></button>
          <div className="print-help-icon"><Printer size={21} /></div>
          <span className="eyebrow">PILIH FORMAT</span>
          <h2 id="print-choice-title">Struk yang akan dicetak</h2>
          <p>{printSelection.receiptNo} · Pilih salinan sesuai keperluan.</p>
          <div className="print-choice-options">
            <button className="button button-secondary" type="button" disabled={printSubmitting} onClick={() => selectPrintVariant('admin')}><Printer size={16} /> Struk Admin</button>
            <button className="button button-primary" type="button" disabled={printSubmitting} onClick={() => selectPrintVariant('customer')}><Printer size={16} /> Struk Pelanggan</button>
          </div>
        </section>
      </div>}
      {notice && page !== 'create' && <div className="toast" role="status"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Tutup"><X size={15} /></button></div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dashboard({ user, transactions, todayTransactions, revenueToday, onNavigate, onPrint }) {
  const todayPaid = todayTransactions.filter((transaction) => transaction.paymentStatus === 'paid');
  const pendingCount = todayTransactions.filter((transaction) => transaction.paymentStatus === 'pending_verification').length;
  const voidCount = todayTransactions.filter((transaction) => transaction.paymentStatus === 'void').length;
  const cashTransactions = todayPaid.filter((transaction) => transaction.paymentMethod === 'cash');
  const qrisTransactions = todayPaid.filter((transaction) => transaction.paymentMethod === 'qris_dana');
  const cashRevenue = cashTransactions.reduce((sum, transaction) => sum + Number(transaction.total), 0);
  const qrisRevenue = qrisTransactions.reduce((sum, transaction) => sum + Number(transaction.total), 0);
  const newest = [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const popular = new Set(todayPaid.flatMap((transaction) =>
    (transaction.items || [{ cameraName: transaction.cameraName }]).map((item) => item.cameraName),
  )).size;
  const cameraSummary = (transaction) => (transaction.items || [{ cameraName: transaction.cameraName }])
    .map((item) => item.cameraName).join(', ');
  return (
    <>
      <PageHeading eyebrow={`DASHBOARD · ${formatDate()}`} title={`Halo, ${user.name.split(' ')[0]}.`} description="Ringkasan operasional Evarti hari ini." action={<button className="button button-primary" onClick={() => onNavigate('create')}><Plus size={17} /> Buat transaksi</button>} />
      <div className="section-heading dashboard-section-heading"><div><h2>Ringkasan hari ini</h2><p>Performa operasional hari ini</p></div><span className="live-pill"><i /> HARI INI</span></div>
      <section className="stats-grid">
        <StatCard label="Pendapatan lunas" value={formatCurrency(revenueToday)} detail="Pemasukan hari ini" icon={Wallet} tone="pink" />
        <StatCard label="Total transaksi" value={todayTransactions.length} detail={`${todayPaid.length} lunas · ${pendingCount} menunggu`} icon={ShoppingBag} tone="lavender" />
        <StatCard label="Kamera disewa" value={popular} detail="Model berbeda hari ini" icon={Camera} tone="mint" />
        <StatCard label="Menunggu verifikasi" value={pendingCount} detail={`${voidCount} transaksi dibatalkan`} icon={Clock3} tone="peach" />
      </section>
      <section className="dashboard-middle">
        <div className="panel payment-summary-panel">
          <div className="panel-heading"><div><h2>Ringkasan pembayaran</h2><p>Pemasukan berdasarkan metode pembayaran</p></div><CreditCard size={17} className="muted-icon" /></div>
          <div className="payment-summary-grid">
            <article className="payment-summary-card">
              <div className="payment-summary-icon cash-icon"><Banknote size={18} /></div>
              <div className="payment-summary-copy"><span>Tunai</span><strong>{formatCurrency(cashRevenue)}</strong><small>{cashTransactions.length} transaksi lunas</small></div>
              <button className="text-button" onClick={() => onNavigate('history')} aria-label="Lihat riwayat pembayaran tunai"><ArrowUpRight size={17} /></button>
            </article>
            <article className="payment-summary-card">
              <div className="payment-summary-icon qris-icon"><CreditCard size={18} /></div>
              <div className="payment-summary-copy"><span>QRIS DANA</span><strong>{formatCurrency(qrisRevenue)}</strong><small>{qrisTransactions.length} transaksi lunas</small></div>
              <button className="text-button" onClick={() => onNavigate('history')} aria-label="Lihat riwayat pembayaran QRIS"><ArrowUpRight size={17} /></button>
            </article>
          </div>
        </div>
        <aside className="panel balance-panel">
          <div className="balance-panel-heading"><span className="eyebrow">PEMASUKAN HARI INI</span><div className="balance-icon"><Wallet size={17} /></div></div>
          <strong className="balance-amount">{formatCurrency(revenueToday)}</strong>
          <div className="balance-divider" />
          <div className="balance-meta"><span>Transaksi lunas</span><b>{todayPaid.length}</b></div>
          <div className="balance-meta"><span>Menunggu verifikasi</span><b>{pendingCount}</b></div>
        </aside>
      </section>
      <section className="dashboard-lower">
        <div className="panel recent-panel">
          <div className="panel-heading"><div><h2>Transaksi terbaru</h2><p>Aktivitas penyewaan terakhir</p></div><button className="text-button" onClick={() => onNavigate('history')}>Lihat semua <ArrowRight size={15} /></button></div>
          {newest.length === 0 ? <EmptyState title="Belum ada transaksi" body="Transaksi yang dibuat akan muncul di sini." /> : <div className="table-wrap"><table><thead><tr><th>No. struk</th><th>Penyewa</th><th>Kamera</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>
            {newest.map((transaction) => <tr key={transaction.id}><td><strong className="receipt-id">{transaction.receiptNo}</strong><small>{formatDate(transaction.createdAt)}</small></td><td>{transaction.customerName}<small>{transaction.location === 'cafe' ? 'Cafe' : 'Event'}</small></td><td>{cameraSummary(transaction)}</td><td className="money-cell">{formatCurrency(transaction.total)}</td><td><StatusBadge transaction={transaction} /></td><td><button className="table-icon-button" onClick={() => onPrint(transaction)} aria-label="Cetak struk"><Printer size={16} /></button></td></tr>)}
          </tbody></table></div>}
        </div>
        <div className="panel quick-panel"><div className="panel-heading"><div><h2>Akses cepat</h2><p>Yang sering kamu butuhkan</p></div><SlidersHorizontal size={17} className="muted-icon" /></div>
          <button className="quick-link" onClick={() => onNavigate('create')}><div className="quick-icon quick-pink"><Plus size={19} /></div><span><strong>Buat struk baru</strong><small>Mulai transaksi penyewaan</small></span><ChevronRight size={17} /></button>
          <button className="quick-link" onClick={() => onNavigate('history')}><div className="quick-icon quick-purple"><FileText size={18} /></div><span><strong>Riwayat transaksi</strong><small>Lihat transaksi tersimpan</small></span><ChevronRight size={17} /></button>
          {user.role === 'owner' && <button className="quick-link" onClick={() => onNavigate('catalog')}><div className="quick-icon quick-peach"><Settings2 size={18} /></div><span><strong>Kelola katalog</strong><small>Harga dan kamera</small></span><ChevronRight size={17} /></button>}
          <div className="quick-footer"><ShieldCheck size={15} /> Data transaksi hanya terlihat oleh tim berwenang</div>
        </div>
      </section>
    </>
  );
}

function StatusBadge({ transaction }) {
  if (transaction.paymentStatus === 'void') return <span className="status-badge status-void">Void</span>;
  if (transaction.paymentStatus === 'pending_verification') return <span className="status-badge status-pending"><i /> Menunggu verifikasi</span>;
  return <span className="status-badge status-paid"><Check size={12} /> Lunas</span>;
}

function EmptyState({ title, body }) {
  return <div className="empty-state"><div className="empty-icon"><FileText size={21} /></div><strong>{title}</strong><p>{body}</p></div>;
}

function CreateTransaction({ user, cameras, addons, onSave, onVerify, onNotice, onPrint, savedTransaction, paperWidth }) {
  const [location, setLocation] = useState(user.username === 'kasir2' ? 'event' : 'cafe');
  const assignedLocation = user.username === 'kasir1' ? 'cafe' : user.username === 'kasir2' ? 'event' : null;
  const activeLocation = assignedLocation || location;
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pagerNumber, setPagerNumber] = useState('');
  const [guaranteeType, setGuaranteeType] = useState('none');
  const [guaranteeId, setGuaranteeId] = useState('');
  const [guaranteeImage, setGuaranteeImage] = useState('');
  const [guaranteePhotoFile, setGuaranteePhotoFile] = useState(null);
  const [guaranteeError, setGuaranteeError] = useState('');
  const [selectedCameraIds, setSelectedCameraIds] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [manualAddonEnabled, setManualAddonEnabled] = useState(false);
  const [manualAddonLabel, setManualAddonLabel] = useState('');
  const [manualAddonPrice, setManualAddonPrice] = useState('');
  const [cameraSettings, setCameraSettings] = useState({});
  const [startTime, setStartTime] = useState(currentTime);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState(null);
  const [savedHere, setSavedHere] = useState(false);
  const [showPostSaveDialog, setShowPostSaveDialog] = useState(false);
  const [postSaveError, setPostSaveError] = useState('');
  const submissionLock = useRef(false);
  const formErrorSummary = useRef(null);
  const selectedItems = selectedCameraIds.flatMap((cameraId) => {
    const camera = cameras.find((entry) => entry.id === cameraId);
    if (!camera) return [];
    const settings = cameraSettings[cameraId] || { duration: '1', manualHours: '', manualMinutes: '', manualPrice: '', manualNote: '' };
    const isManualPrice = settings.duration === 'manual';
    const durationMinutes = isManualPrice
      ? Number(settings.manualHours || 0) * 60 + Number(settings.manualMinutes || 0)
      : Number(settings.duration) * 60;
    const price = isManualPrice ? Number(settings.manualPrice) || 0 : Number(camera.prices[settings.duration]) || 0;
    const durationHours = Math.floor(durationMinutes / 60);
    const durationRemainder = durationMinutes % 60;
    const durationLabel = isManualPrice
      ? `${durationHours} Jam${durationRemainder ? ` ${durationRemainder} mnt` : ''}`
      : `${settings.duration} Jam`;
    return [{
      camera,
      cameraId,
      cameraName: camera.name,
      duration: settings.duration,
      durationMinutes,
      durationLabel,
      price,
      isManualPrice,
      manualNote: settings.manualNote || '',
    }];
  });
  const selectedAddons = selectedAddonIds.flatMap((addonId) => {
    const addon = addons.find((entry) => entry.id === addonId);
    return addon ? [addon] : [];
  });
  const durationMinutes = selectedItems.length ? Math.max(...selectedItems.map((item) => item.durationMinutes)) : 0;
  const endTime = calcEndTime(startTime, durationMinutes);
  const rentalSubtotal = selectedItems.reduce((sum, item) => sum + item.price, 0);
  const transactionAddons = [...selectedAddons, ...(manualAddonEnabled ? [{
    id: 'manual-addon-preview', category: 'property', isManual: true,
    label: manualAddonLabel.trim() || 'Layanan manual', price: Number(manualAddonPrice) || 0,
  }] : [])];
  const addonSubtotal = transactionAddons.reduce((sum, addon) => sum + addon.price, 0);
  const total = rentalSubtotal + addonSubtotal;
  const normalizedWhatsapp = normalizeWhatsapp(whatsapp);
  const change = Math.max(0, Number(amountReceived) - total);
  const clearErrors = (...names) => {
    setErrors((previous) => {
      if (!names.some((name) => previous[name])) return previous;
      const next = { ...previous };
      names.forEach((name) => delete next[name]);
      return next;
    });
  };
  const updateCameraSettings = (cameraId, key, value) => {
    setCameraSettings((previous) => ({
      ...previous,
      [cameraId]: {
        ...(previous[cameraId] || { duration: '1', manualHours: '', manualMinutes: '', manualPrice: '', manualNote: '' }),
        [key]: value,
      },
    }));
    clearErrors(`duration-${cameraId}`, `price-${cameraId}`, 'submit');
  };
  const toggleCamera = (cameraId) => {
    setSelectedCameraIds((previous) => previous.includes(cameraId)
      ? previous.filter((id) => id !== cameraId)
      : [...previous, cameraId]);
    clearErrors('camera', 'submit');
  };
  const toggleAddon = (addon) => {
    setSelectedAddonIds((previous) => {
      const selected = previous.includes(addon.id);
      if (selected) return previous.filter((id) => id !== addon.id);
      if (addon.category !== 'property') {
        const singleChoice = addons.find((entry) => entry.category === addon.category && previous.includes(entry.id));
        return [...previous.filter((id) => id !== singleChoice?.id), addon.id];
      }
      return [...previous, addon.id];
    });
  };
  const preview = activeTransaction || {
    receiptNo: `${activeLocation === 'event' ? 'EVT' : 'CAF'}-YYYYMMDD-000`,
    createdAt: new Date().toISOString(),
    startTime,
    endTime,
    customerName,
    customerWhatsapp: normalizedWhatsapp || whatsapp || '',
    customerPagerNumber: pagerNumber.trim(),
    cameraName: selectedItems[0]?.cameraName || '',
    durationLabel: selectedItems[0]?.durationLabel || '',
    items: selectedItems.map((item) => ({
      cameraId: item.cameraId,
      cameraName: item.cameraName,
      durationLabel: item.durationLabel,
      durationMinutes: item.durationMinutes,
      price: item.price,
      isManualPrice: item.isManualPrice,
      manualNote: item.manualNote,
    })),
    addons: transactionAddons,
    total,
    isManualPrice: selectedItems.some((item) => item.isManualPrice),
    paymentMethod,
    amountReceived: Number(amountReceived) || 0,
    change,
  };
  const needsVerification = activeTransaction?.paymentStatus === 'pending_verification';
  const isSavedPaid = activeTransaction?.paymentStatus === 'paid';

  useEffect(() => {
    setSavedHere(false);
    setActiveTransaction(null);
    setShowPostSaveDialog(false);
    setPostSaveError('');
  }, [activeLocation, customerName, whatsapp, pagerNumber, guaranteeType, guaranteeId, guaranteeImage, guaranteePhotoFile, selectedCameraIds, selectedAddonIds, manualAddonEnabled, manualAddonLabel, manualAddonPrice, cameraSettings, startTime, paymentMethod, amountReceived]);

  const fieldError = (name, message) => <div className="field-error">{message || errors[name]}</div>;
  const validate = () => {
    const nextErrors = {};
    if (!customerName.trim()) nextErrors.customerName = 'Nama penyewa wajib diisi.';
    if (!whatsapp.trim()) nextErrors.whatsapp = 'No. WhatsApp wajib diisi.';
    else if (!normalizedWhatsapp) nextErrors.whatsapp = 'Format nomor tidak valid. Gunakan 08, 62, atau +62 (9–15 digit).';
    if (selectedItems.length === 0) nextErrors.camera = 'Pilih minimal satu kamera yang akan disewa.';
    if (selectedItems.length > 20) nextErrors.camera = 'Maksimal 20 kamera dapat dimasukkan dalam satu transaksi.';
    for (const item of selectedItems) {
      if (item.isManualPrice && (
        !Number.isInteger(Number(cameraSettings[item.cameraId]?.manualHours || 0)) || Number(cameraSettings[item.cameraId]?.manualHours || 0) < 0 ||
        !Number.isInteger(Number(cameraSettings[item.cameraId]?.manualMinutes || 0)) || Number(cameraSettings[item.cameraId]?.manualMinutes || 0) < 0 ||
        Number(cameraSettings[item.cameraId]?.manualMinutes || 0) > 59 || item.durationMinutes <= 120
      )) nextErrors[`duration-${item.cameraId}`] = 'Isi durasi manual lebih dari 2 jam.';
      if (item.isManualPrice && !(item.price > 0)) nextErrors[`price-${item.cameraId}`] = 'Isi tarif manual lebih dari Rp 0.';
    }
    if (selectedItems.some((item) => item.durationMinutes <= 0)) nextErrors.camera = 'Isi durasi untuk semua kamera yang dipilih.';
    if (manualAddonEnabled) {
      if (!manualAddonLabel.trim() || manualAddonLabel.trim().length > 100) nextErrors.manualAddonLabel = 'Isi nama layanan manual (maksimal 100 karakter).';
      if (manualAddonPrice === '' || !Number.isSafeInteger(Number(manualAddonPrice)) || Number(manualAddonPrice) < 0 || Number(manualAddonPrice) > 100_000_000) nextErrors.manualAddonPrice = 'Isi harga berupa angka bulat antara Rp 0 dan Rp 100.000.000.';
    }
    if (!startTime || !endTime || durationMinutes <= 0) nextErrors.time = 'Jam mulai dan durasi harus menghasilkan jam selesai.';
    if (paymentMethod === 'cash' && Number(amountReceived) < total) nextErrors.amountReceived = 'Uang diterima tidak boleh kurang dari total.';
    if (guaranteeType === 'id_number' && !guaranteeId.trim()) nextErrors.guaranteeId = 'Nomor ID wajib diisi jika jaminan dipilih.';
    if (guaranteeType === 'photo' && !guaranteeImage) nextErrors.guaranteeImage = 'Foto jaminan wajib diunggah.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submissionLock.current) return;
    if (!validate()) {
      onNotice('Periksa kembali data transaksi yang wajib diisi.');
      window.requestAnimationFrame(() => {
        formErrorSummary.current?.focus();
        formErrorSummary.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    submissionLock.current = true;
    setSaving(true);
    const firstItem = selectedItems[0];
    const payload = {
      location: activeLocation,
      customerName: customerName.trim(),
      customerWhatsapp: normalizedWhatsapp,
      customerPagerNumber: pagerNumber.trim(),
      guaranteeType,
      guaranteeIdNumber: guaranteeType === 'id_number' ? guaranteeId.trim() : null,
      addonIds: selectedAddons.map((addon) => addon.id),
      ...(manualAddonEnabled ? { manualAddon: { label: manualAddonLabel.trim(), price: Number(manualAddonPrice) } } : {}),
      cameraId: firstItem.cameraId,
      items: selectedItems.map((item) => ({
        cameraId: item.cameraId,
        durationMinutes: item.durationMinutes,
        price: item.price,
        isManualPrice: item.isManualPrice,
        manualNote: item.manualNote.trim(),
      })),
      durationLabel: firstItem.durationLabel,
      durationMinutes,
      startTime,
      endTime,
      price: rentalSubtotal,
      isManualPrice: selectedItems.some((item) => item.isManualPrice),
      manualNote: selectedItems.find((item) => item.isManualPrice)?.manualNote.trim() || '',
      total,
      paymentMethod,
      amountReceived: paymentMethod === 'cash' ? Number(amountReceived) : total,
    };
    try {
      const transaction = await onSave({
        payload,
        guaranteePhoto: guaranteeType === 'photo' ? guaranteePhotoFile : null,
      });
      setActiveTransaction(transaction);
      setSavedHere(true);
      setPostSaveError('');
      setShowPostSaveDialog(true);
    } catch (error) {
      setErrors((previous) => ({ ...previous, submit: error.message }));
      onNotice(error.message);
    } finally {
      submissionLock.current = false;
      setSaving(false);
    }
  };

  const verifyPayment = async () => {
    if (verifyingPayment) return;
    setVerifyingPayment(true);
    setPostSaveError('');
    try {
      const updated = await onVerify(activeTransaction);
      setActiveTransaction(updated);
      setSavedHere(true);
      onNotice('Pembayaran QRIS terverifikasi. Struk siap dicetak.');
    } catch (error) {
      setPostSaveError(error.message);
      onNotice(error.message);
    } finally {
      setVerifyingPayment(false);
    }
  };

  const onGuaranteeUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setGuaranteeError('Format file harus JPG, PNG, atau WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setGuaranteeError('Ukuran foto maksimal 2 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    setGuaranteePhotoFile(file);
    event.target.value = '';
    reader.onload = () => {
      setGuaranteeImage(String(reader.result));
      setGuaranteeError('');
      clearErrors('guaranteeImage', 'submit');
    };
    reader.onerror = () => {
      setGuaranteePhotoFile(null);
      setGuaranteeError('Foto tidak dapat dibaca. Silakan pilih file lain.');
    };
    reader.readAsDataURL(file);
  };

  const addonGroups = ['property', 'photographer', 'print', 'transfer'].map((category) => ({
    category,
    options: addons.filter((addon) => addon.category === category),
  })).filter((group) => group.options.length > 0);

  return (
    <>
      <PageHeading eyebrow="TRANSAKSI BARU" title="Buat struk sewa." description="Lengkapi detail penyewaan, lalu cek pratinjau sebelum disimpan." action={<div className="secure-note"><ShieldCheck size={15} /> Data tersimpan aman</div>} />
      {savedHere && activeTransaction && <div className={`saved-banner ${needsVerification ? 'saved-pending' : ''}`}><div className="saved-banner-icon">{needsVerification ? <Clock3 size={19} /> : <CheckCircle2 size={20} />}</div><div><strong>{needsVerification ? 'Transaksi tersimpan · menunggu verifikasi' : 'Transaksi berhasil disimpan'}</strong><span>{activeTransaction.receiptNo} · {needsVerification ? 'Verifikasi pembayaran untuk membuka cetak struk.' : 'Struk siap dicetak atau bisa dicetak ulang nanti.'}</span></div>{isSavedPaid && <button className="button button-primary button-small" onClick={() => onPrint(activeTransaction)}><Printer size={15} /> Cetak struk</button>}</div>}
      {showPostSaveDialog && activeTransaction && <div className="print-choice-backdrop" role="presentation">
        <section className="print-choice-dialog post-save-dialog" role="dialog" aria-modal="true" aria-labelledby="post-save-title">
          <button className="print-choice-close" type="button" onClick={() => setShowPostSaveDialog(false)} aria-label="Tutup dialog transaksi"><X size={18} /></button>
          <div className="print-help-icon">{needsVerification ? <CreditCard size={21} /> : <CheckCircle2 size={21} />}</div>
          <span className="eyebrow">{needsVerification ? 'PEMBAYARAN QRIS' : 'TRANSAKSI TUNAI'}</span>
          <h2 id="post-save-title">{needsVerification ? 'Verifikasi pembayaran' : 'Transaksi berhasil disimpan'}</h2>
          <p>{activeTransaction.receiptNo} · {needsVerification ? `Pastikan pembayaran ${formatCurrency(activeTransaction.total)} telah diterima.` : 'Transaksi tunai sudah tercatat dan struk siap dicetak.'}</p>
          {postSaveError && <div className="post-save-error" role="alert">{postSaveError}</div>}
          <div className="post-save-actions">
            {needsVerification ? <button className="button button-primary button-full" type="button" onClick={verifyPayment} disabled={verifyingPayment} aria-busy={verifyingPayment}>{verifyingPayment ? <><span className="button-spinner" /> Memverifikasi...</> : <><BadgeCheck size={17} /> Verifikasi pembayaran</>}</button> : isSavedPaid && <button className="button button-primary button-full" type="button" onClick={() => { setShowPostSaveDialog(false); onPrint(activeTransaction); }}><Printer size={17} /> Cetak struk</button>}
          </div>
        </section>
      </div>}
      <div className="transaction-layout">
        <form className="transaction-form" onSubmit={submit} noValidate>
          {Object.keys(errors).length > 0 && <div className="form-error-summary" ref={formErrorSummary} role="alert" tabIndex="-1">
            <strong>Periksa kembali isian transaksi</strong>
            <span>{errors.submit || `${Object.keys(errors).length} bagian perlu diperbaiki sebelum transaksi bisa disimpan.`}</span>
          </div>}
          <section className="form-section">
            <SectionTitle number="01" title="Detail penyewaan" subtitle="Tentukan lokasi dan informasi penyewa" />
            <div className="form-grid">
              <div className="form-field full-field"><label className="field-label">Lokasi penyewaan</label>{assignedLocation ? <div className="assigned-location"><div className={`choice-icon ${activeLocation === 'cafe' ? 'choice-icon-pink' : 'choice-icon-blue'}`}>{activeLocation === 'cafe' ? <Store size={18} /> : <Sparkles size={18} />}</div><span><strong>{activeLocation === 'cafe' ? 'Cafe' : 'Event'}</strong><small>Otomatis mengikuti akun {user.title}</small></span><span className="choice-check"><Check size={12} /></span></div> : <div className="choice-row">
                <button type="button" className={`choice-card ${activeLocation === 'cafe' ? 'choice-selected' : ''}`} onClick={() => setLocation('cafe')}><div className="choice-icon choice-icon-pink"><Store size={18} /></div><span><strong>Cafe</strong><small>Penyewaan di cafe</small></span>{activeLocation === 'cafe' && <span className="choice-check"><Check size={12} /></span>}</button>
                <button type="button" className={`choice-card ${activeLocation === 'event' ? 'choice-selected' : ''}`} onClick={() => setLocation('event')}><div className="choice-icon choice-icon-blue"><Sparkles size={18} /></div><span><strong>Event</strong><small>Penyewaan di event</small></span>{activeLocation === 'event' && <span className="choice-check"><Check size={12} /></span>}</button>
              </div>}</div>
              <div className="form-field"><label className="field-label" htmlFor="customerName">Nama penyewa <span>*</span></label><input id="customerName" className={`text-input ${errors.customerName ? 'input-invalid' : ''}`} aria-invalid={Boolean(errors.customerName)} value={customerName} onChange={(event) => { setCustomerName(event.target.value); clearErrors('customerName', 'submit'); }} placeholder="Contoh: Alya Putri" />{errors.customerName && fieldError('customerName')}</div>
              <div className="form-field"><label className="field-label" htmlFor="whatsapp">No. WhatsApp <span>*</span></label><div className={`phone-input ${errors.whatsapp ? 'input-invalid' : ''}`}><input id="whatsapp" aria-invalid={Boolean(errors.whatsapp)} value={whatsapp} onChange={(event) => { setWhatsapp(event.target.value); clearErrors('whatsapp', 'submit'); }} placeholder="08xxxxxxxxxx atau +628..." inputMode="tel" /></div>{errors.whatsapp ? fieldError('whatsapp') : <small className="field-hint">Gunakan format 08, 62, atau +62. Nomor dinormalisasi saat disimpan.</small>}</div>
              <div className="form-field"><label className="field-label" htmlFor="pagerNumber">Nomor pager <span className="optional-tag">OPSIONAL</span></label><input id="pagerNumber" className="text-input" value={pagerNumber} onChange={(event) => setPagerNumber(event.target.value)} placeholder="Nomor pager untuk pengingat waktu sewa" maxLength={40} /></div>
              <div className="form-field full-field"><label className="field-label">Jaminan <span className="optional-tag">OPSIONAL</span></label><div className="guarantee-options">
                {[['none', 'Tidak ada'], ['photo', 'Foto'], ['id_number', 'Nomor ID']].map(([value, label]) => <button key={value} type="button" aria-pressed={guaranteeType === value} onClick={() => { setGuaranteeType(value); setGuaranteeError(''); clearErrors('guaranteeId', 'guaranteeImage', 'submit'); }} className={`pill-option ${guaranteeType === value ? 'pill-option-active' : ''}`}>{guaranteeType === value && <Check size={13} />}{label}</button>)}
              </div></div>
              {guaranteeType === 'photo' && <div className="form-field full-field"><label className="field-label">Foto jaminan <span>*</span></label><label className={`upload-box ${guaranteeImage ? 'upload-has-file' : ''}`}><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onGuaranteeUpload} />{guaranteeImage ? <><img src={guaranteeImage} alt="Pratinjau jaminan" /><span><strong>Foto berhasil ditambahkan</strong><small>Ketuk untuk mengganti foto</small></span></> : <><ImagePlus size={22} /><span><strong>Unggah atau ambil foto</strong><small>JPG, PNG, WebP · maks. 2 MB</small></span></>}</label>{(guaranteeError || errors.guaranteeImage) && fieldError('guaranteeImage', guaranteeError || errors.guaranteeImage)}</div>}
              {guaranteeType === 'id_number' && <div className="form-field full-field"><label className="field-label" htmlFor="guaranteeId">Nomor ID <span>*</span></label><input id="guaranteeId" className={`text-input ${errors.guaranteeId ? 'input-invalid' : ''}`} aria-invalid={Boolean(errors.guaranteeId)} value={guaranteeId} onChange={(event) => { setGuaranteeId(event.target.value); clearErrors('guaranteeId', 'submit'); }} placeholder="Masukkan nomor ID" />{errors.guaranteeId && fieldError('guaranteeId')}</div>}
            </div>
            <div className="privacy-note"><ShieldCheck size={15} /><span>Data jaminan hanya dapat dilihat oleh Owner dan kasir yang membuat transaksi. Tidak dicetak di struk.</span></div>
          </section>
          <section className="form-section">
            <SectionTitle number="02" title="Pilih kamera" subtitle="Pilih satu atau lebih kamera yang akan disewa" />
            <div className="selection-summary" aria-live="polite">
              <strong>{selectedCameraIds.length}</strong> kamera dipilih
            </div>
            {errors.camera && fieldError('camera')}
            {cameras.length === 0 ? <EmptyState title="Katalog belum tersedia" body="Belum ada kamera aktif di katalog." /> : <div className="camera-grid">
              {cameras.map((camera) => <button type="button" aria-pressed={selectedCameraIds.includes(camera.id)} className={`camera-option ${selectedCameraIds.includes(camera.id) ? 'camera-option-selected' : ''}`} key={camera.id} onClick={() => toggleCamera(camera.id)}><div className="camera-option-visual"><CameraArtwork tone={camera.tone} image={camera.image} /><span className="camera-select-check"><Check size={13} /></span></div><div className="camera-option-info"><strong>{camera.name}</strong><span>{formatCurrency(camera.prices[1])} <small>/ jam</small></span></div></button>)}
            </div>}
          </section>
          <section className="form-section">
            <SectionTitle number="03" title="Add-on & pemindahan file" subtitle="Pilih layanan tambahan yang diinginkan (opsional)" />
            <div className="addon-groups">
              {addonGroups.map(({ category, options }) => <div className="addon-group" key={category}>
                <h3>{addonCategoryLabels[category]}</h3>
                <div className="addon-options">
                  {options.map((addon) => {
                    const selected = selectedAddonIds.includes(addon.id);
                    return <button type="button" key={addon.id} aria-pressed={selected} className={`addon-option ${selected ? 'addon-option-selected' : ''}`} onClick={() => toggleAddon(addon)}>
                      <span className="addon-option-check">{selected && <Check size={12} />}</span>
                      <span className="addon-option-label">{addon.label}</span>
                      <strong>{addon.price > 0 ? formatCurrency(addon.price) : 'Gratis'}</strong>
                    </button>;
                  })}
                </div>
              </div>)}
            </div>
            <div className="manual-addon-panel">
              <div className="manual-addon-heading"><div><h3>Layanan di luar katalog?</h3><p>Isi nama dan harga layanan untuk transaksi ini.</p></div><button type="button" className={`button ${manualAddonEnabled ? 'button-primary' : 'button-secondary'}`} aria-pressed={manualAddonEnabled} aria-expanded={manualAddonEnabled} aria-controls="manual-addon-fields" onClick={() => { setManualAddonEnabled((enabled) => !enabled); clearErrors('manualAddonLabel', 'manualAddonPrice', 'submit'); }}>{manualAddonEnabled ? <X size={16} /> : <Plus size={16} />}{manualAddonEnabled ? 'Batalkan manual' : 'Isi manual'}</button></div>
              {manualAddonEnabled && <div id="manual-addon-fields" className="form-grid">
                <div className="form-field"><label className="field-label" htmlFor="manual-addon-label">Add-on &amp; pemindahan file <span>*</span></label><input id="manual-addon-label" className="text-input" value={manualAddonLabel} maxLength={100} aria-required="true" aria-invalid={Boolean(errors.manualAddonLabel)} aria-describedby={errors.manualAddonLabel ? 'manual-addon-label-error' : undefined} onChange={(event) => { setManualAddonLabel(event.target.value); clearErrors('manualAddonLabel', 'submit'); }} placeholder="Contoh: Transfer 200 foto" />{errors.manualAddonLabel && <div id="manual-addon-label-error" className="field-error" role="alert">{errors.manualAddonLabel}</div>}</div>
                <div className="form-field"><label className="field-label" htmlFor="manual-addon-price">Harga layanan manual <span>*</span></label><div className="currency-input"><span>Rp</span><input id="manual-addon-price" className="text-input" type="number" min="0" max="100000000" step="1" value={manualAddonPrice} aria-required="true" aria-invalid={Boolean(errors.manualAddonPrice)} aria-describedby={errors.manualAddonPrice ? 'manual-addon-price-error' : 'manual-addon-hint'} onChange={(event) => { setManualAddonPrice(event.target.value); clearErrors('manualAddonPrice', 'submit'); }} placeholder="Masukkan harga" /></div>{errors.manualAddonPrice && <div id="manual-addon-price-error" className="field-error" role="alert">{errors.manualAddonPrice}</div>}</div>
                <small id="manual-addon-hint" className="field-hint full-field">Harga ditambahkan ke total transaksi. Isi 0 untuk layanan gratis. Layanan manual tidak ditambahkan ke katalog.</small>
              </div>}
            </div>
          </section>
          <section className="form-section">
            <SectionTitle number="04" title="Durasi & pembayaran" subtitle="Tentukan durasi dan tarif untuk setiap kamera" />
            {selectedItems.length > 0 && <div className="selected-rentals">{selectedItems.map((item) => {
              const settings = cameraSettings[item.cameraId] || { duration: '1', manualHours: '', manualMinutes: '', manualPrice: '', manualNote: '' };
              return <div className="rental-item-config" key={item.cameraId}>
                <div className="rental-item-heading"><strong>{item.cameraName}</strong><button type="button" onClick={() => toggleCamera(item.cameraId)}>Hapus</button></div>
                <div className="duration-options">
                  {[['1', '1 jam', formatCurrency(item.camera.prices[1])], ['2', '2 jam', formatCurrency(item.camera.prices[2])], ['manual', 'Manual', 'Lebih dari 2 jam']].map(([value, title, desc]) => <button type="button" key={value} onClick={() => updateCameraSettings(item.cameraId, 'duration', value)} className={`duration-card ${settings.duration === value ? 'duration-selected' : ''}`}><span className="duration-check">{settings.duration === value && <Check size={12} />}</span><strong>{title}</strong><small>{desc}</small></button>)}
                </div>
                {item.isManualPrice && <div className="form-grid rental-manual-fields">
                  <div className="form-field"><label className="field-label">Durasi manual <span>*</span></label><div className="duration-inputs"><div><input className="text-input" type="number" min="0" max="23" value={settings.manualHours} onChange={(event) => updateCameraSettings(item.cameraId, 'manualHours', event.target.value)} placeholder="3" /><span>Jam</span></div><div><input className="text-input" type="number" min="0" max="59" value={settings.manualMinutes} onChange={(event) => updateCameraSettings(item.cameraId, 'manualMinutes', event.target.value)} placeholder="00" /><span>Menit</span></div></div>{errors[`duration-${item.cameraId}`] && fieldError(`duration-${item.cameraId}`)}</div>
                  <div className="form-field"><label className="field-label">Tarif manual <span>*</span></label><div className="currency-input"><span>Rp</span><input className="text-input" type="number" min="1" value={settings.manualPrice} onChange={(event) => updateCameraSettings(item.cameraId, 'manualPrice', event.target.value)} placeholder="45.000" /></div>{errors[`price-${item.cameraId}`] && fieldError(`price-${item.cameraId}`)}</div>
                  <div className="form-field full-field"><label className="field-label">Catatan alasan <span className="optional-tag">OPSIONAL</span></label><input className="text-input" value={settings.manualNote} onChange={(event) => updateCameraSettings(item.cameraId, 'manualNote', event.target.value)} placeholder="Contoh: harga paket event" /></div>
                </div>}
              </div>;
            })}</div>}
            {transactionAddons.length > 0 && <div className="addon-price-summary">
              <span>Subtotal kamera</span><strong>{formatCurrency(rentalSubtotal)}</strong>
              {transactionAddons.map((addon) => <React.Fragment key={addon.id}><span>{addon.label}</span><strong>{addon.price > 0 ? formatCurrency(addon.price) : 'Gratis'}</strong></React.Fragment>)}
              <span>Total transaksi</span><strong>{formatCurrency(total)}</strong>
            </div>}
            {selectedItems.length > 1 && transactionAddons.length === 0 && <div className="rental-total"><span>Total semua kamera</span><strong>{formatCurrency(rentalSubtotal)}</strong></div>}
            <div className="form-grid time-grid">
              <div className="form-field"><label className="field-label" htmlFor="startTime">Jam mulai <span>*</span></label><input id="startTime" className="text-input time-input" type="time" value={startTime} onChange={(event) => { setStartTime(event.target.value); clearErrors('time', 'submit'); }} /></div>
              <div className="form-field"><label className="field-label">Jam selesai <span className="auto-tag">OTOMATIS</span></label><div className="readonly-input"><Clock3 size={16} /><strong>{endTime || '--:--'}</strong><span>{durationMinutes > 0 ? `Durasi ${Math.floor(durationMinutes / 60)}j ${durationMinutes % 60 ? `${durationMinutes % 60}m` : ''}` : 'Isi durasi'}</span></div></div>
            </div>
            {errors.time && fieldError('time')}
            <div className="form-field payment-field"><label className="field-label">Metode pembayaran <span>*</span></label><div className="payment-methods">
              <button type="button" aria-pressed={paymentMethod === 'cash'} onClick={() => { setPaymentMethod('cash'); clearErrors('amountReceived', 'submit'); }} className={`payment-option ${paymentMethod === 'cash' ? 'payment-selected' : ''}`}><div className="payment-icon cash-icon"><Banknote size={19} /></div><span><strong>Tunai</strong><small>Bayar langsung</small></span>{paymentMethod === 'cash' && <CheckCircle2 size={17} className="payment-check" />}</button>
              <button type="button" aria-pressed={paymentMethod === 'qris_dana'} onClick={() => { setPaymentMethod('qris_dana'); clearErrors('amountReceived', 'submit'); }} className={`payment-option ${paymentMethod === 'qris_dana' ? 'payment-selected' : ''}`}><div className="payment-icon qris-icon"><CreditCard size={18} /></div><span><strong>QRIS DANA</strong><small>Transfer non-tunai</small></span>{paymentMethod === 'qris_dana' && <CheckCircle2 size={17} className="payment-check" />}</button>
            </div></div>
            {paymentMethod === 'cash' ? <div className="form-grid cash-grid"><div className="form-field"><label className="field-label" htmlFor="amountReceived">Uang diterima <span>*</span></label><div className={`currency-input ${errors.amountReceived ? 'input-invalid' : ''}`}><span>Rp</span><input id="amountReceived" className="text-input" type="number" min={total} value={amountReceived} onChange={(event) => { setAmountReceived(event.target.value); clearErrors('amountReceived', 'submit'); }} placeholder="0" /></div>{errors.amountReceived && fieldError('amountReceived')}</div><div className="change-card"><span>Kembali</span><strong>{formatCurrency(change)}</strong>{Number(amountReceived) > 0 && Number(amountReceived) < total && <small>Uang diterima kurang dari total.</small>}</div></div> : <div className="qris-panel"><div className="qris-symbol">D</div><div className="qris-copy"><strong>QRIS DANA Evarti</strong><span>Tampilkan QRIS statis resmi Evarti kepada penyewa, lalu verifikasi pembayaran secara manual.</span></div><div className="qris-total"><small>Total pembayaran</small><strong>{formatCurrency(total)}</strong></div></div>}
            {paymentMethod === 'qris_dana' && <div className="manual-verification-note"><ShieldCheck size={15} /> Pembayaran diverifikasi kasir secara manual setelah dana diterima.</div>}
          </section>
          <div className="form-submit-row"><span><ShieldCheck size={15} /> Pastikan semua data sudah benar.</span><button className="button button-primary button-submit" type="submit" disabled={saving} aria-busy={saving}>{saving ? <><span className="button-spinner" /> Menyimpan transaksi...</> : <><CheckCircle2 size={17} /> Simpan transaksi</>}</button></div>
        </form>
        <aside className="preview-column">
          <div className="preview-sticky">
            <div className="preview-heading"><div><span className="eyebrow">LIVE PREVIEW</span><h2>Pratinjau struk</h2></div><span className="preview-live-dot"><i /> LIVE</span></div>
            <div className="receipt-location-tag">{activeLocation === 'cafe' ? 'CAF' : 'EVT'} <span>•</span> {activeLocation === 'cafe' ? 'Cafe' : 'Event'}</div>
            <Receipt transaction={preview} />
            <div className="preview-footer"><span><Printer size={14} /> Thermal receipt · {paperWidth} mm</span><span>Tinjau detail sebelum cetak</span></div>
            {needsVerification && <button className="button button-primary button-full verify-button" onClick={verifyPayment} disabled={verifyingPayment} aria-busy={verifyingPayment}>{verifyingPayment ? <><span className="button-spinner" /> Memverifikasi...</> : <><BadgeCheck size={17} /> Pembayaran Terverifikasi</>}</button>}
            {isSavedPaid && <button className="button button-primary button-full verify-button" onClick={() => onPrint(activeTransaction)}><Printer size={17} /> Cetak struk</button>}
            {savedTransaction && !savedHere && <button className="button button-secondary button-full verify-button" onClick={() => onPrint(savedTransaction)}><Printer size={17} /> Cetak struk terakhir</button>}
            <div className="preview-security"><ShieldCheck size={14} /> Nomor WhatsApp tampil pada struk. Data jaminan tetap privat.</div>
          </div>
        </aside>
      </div>
    </>
  );
}

function SectionTitle({ number, title, subtitle }) {
  return <div className="form-section-title"><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div>;
}

function History({ transactions, isOwner, search, setSearch, location, setLocation, cashier, setCashier, date, setDate, onPrint, onVoid }) {
  const { settings: printerSettings, status: printerStatus } = usePrinter();
  const [tab, setTab] = useState('all');
  const [dailyReport, setDailyReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [printError, setPrintError] = useState('');
  const [printMessage, setPrintMessage] = useState('');
  const closeDailyReport = useCallback(() => { setDailyReport(null); setReportLoading(false); }, []);
  const completeDailyReport = useCallback((result) => {
    setPrintMessage(result === 'sent' ? 'Rekap dikirim ke printer thermal. Periksa hasil cetak pada printer.'
      : result === 'handoff' ? 'Rekap diserahkan ke RawBT. Periksa hasil cetak di aplikasi tersebut.'
        : 'Dialog cetak thermal dibuka.');
  }, []);
  const printDate = date || formatJakartaDate();
  const printDailyTransactions = async () => {
    if (reportLoading) return;
    setReportLoading(true);
    setPrintError('');
    setPrintMessage('');
    try {
      const allTransactions = await loadDailyTransactions(printDate, api.transactions);
      if (!allTransactions.length) {
        setPrintError('Tidak ada transaksi pada tanggal tersebut untuk dicetak.');
        setReportLoading(false);
        return;
      }
      setDailyReport({ date: printDate, transactions: allTransactions });
    } catch (error) {
      setPrintError(error.message);
      setReportLoading(false);
    }
  };
  const cameraSummary = (transaction) => (transaction.items || [{
    cameraName: transaction.cameraName,
    durationLabel: transaction.durationLabel,
    isManualPrice: transaction.isManualPrice,
  }]).map((item) => `${item.cameraName} · ${item.durationLabel}${item.isManualPrice ? ' (Manual)' : ''}`).join(', ');
  const filtered = useMemo(() => transactions.filter((transaction) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [transaction.receiptNo, transaction.customerName, transaction.customerWhatsapp].some((value) => value?.toLowerCase().includes(query));
    return matchesSearch && (location === 'all' || transaction.location === location) &&
      (!isOwner || cashier === 'all' || transaction.cashierId === cashier) &&
      (!date || formatJakartaDate(new Date(transaction.createdAt)) === date) &&
      (tab === 'all' || transaction.location === tab);
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [transactions, search, location, cashier, date, tab, isOwner]);
  const countFor = (value) => transactions.filter((transaction) => value === 'all' || transaction.location === value).length;
  return (
    <>
      <PageHeading eyebrow="ARSIP PENYEWAAN" title="Riwayat transaksi." description="Temukan transaksi, tinjau pembayaran, dan cetak ulang struk." action={
        <button className="button button-primary" type="button" onClick={printDailyTransactions} disabled={reportLoading || printerStatus === 'printing'} aria-busy={reportLoading} aria-describedby="daily-print-help">
          {reportLoading ? <><span className="button-spinner" /> Mencetak rekap...</> : <><Printer size={17} aria-hidden="true" /> {date ? 'Cetak tanggal ini' : 'Cetak hari ini'}</>}
        </button>
      } />
      <p className="history-print-help" id="daily-print-help">Cetak rekap semua transaksi {formatDate(`${printDate}T12:00:00+07:00`)} (WIB) ke printer thermal {printerSettings.paperWidth} mm sesuai pengaturan menu Printer. Rekap mencakup semua lokasi{isOwner ? ' dan kasir' : ' untuk akun ini'}, tanpa filter pencarian.</p>
      {printError && <div className="form-error" role="alert">{printError}</div>}
      {printMessage && <p className="printer-message" role="status">{printMessage}</p>}
      {dailyReport && <DailyTransactionReport {...dailyReport} isOwner={isOwner} paperWidth={printerSettings.paperWidth} onClose={closeDailyReport} onError={setPrintError} onComplete={completeDailyReport} />}
      <div className="history-tabs"><button aria-pressed={tab === 'all'} onClick={() => setTab('all')} className={tab === 'all' ? 'history-tab-active' : ''}>Semua <span>{countFor('all')}</span></button><button aria-pressed={tab === 'cafe'} onClick={() => setTab('cafe')} className={tab === 'cafe' ? 'history-tab-active' : ''}>Cafe <span>{countFor('cafe')}</span></button><button aria-pressed={tab === 'event'} onClick={() => setTab('event')} className={tab === 'event' ? 'history-tab-active' : ''}>Event <span>{countFor('event')}</span></button></div>
      <div className="panel history-panel">
        <div className="history-toolbar"><div className="search-input"><Search size={17} /><input aria-label="Cari transaksi" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari no. struk, nama, atau WhatsApp..." /></div><div className="filter-controls"><label className="select-filter"><Filter size={15} /><select aria-label="Filter lokasi transaksi" value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">Semua lokasi</option><option value="cafe">Cafe</option><option value="event">Event</option></select><ChevronDown size={14} /></label>{isOwner && <label className="select-filter"><Users size={15} /><select aria-label="Filter kasir transaksi" value={cashier} onChange={(event) => setCashier(event.target.value)}><option value="all">Semua kasir</option><option value="kasir1">Kasir 1</option><option value="kasir2">Kasir 2</option></select><ChevronDown size={14} /></label>}<label className="date-filter"><CalendarDays size={15} /><input aria-label="Tanggal transaksi" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div></div>
        {filtered.length === 0 ? <EmptyState title="Transaksi tidak ditemukan" body={transactions.length ? 'Coba ubah kata kunci atau filter yang digunakan.' : 'Transaksi yang sudah dibuat akan muncul di sini.'} /> : <div className="table-wrap"><table className="history-table"><thead><tr><th>No. struk</th><th>Penyewa</th><th>Kamera & durasi</th><th>Lokasi</th>{isOwner && <th>Kasir</th>}<th>Pembayaran</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((transaction) => <tr key={transaction.id}><td><strong className="receipt-id">{transaction.receiptNo}</strong><small>{formatDate(transaction.createdAt)} · {transaction.startTime}</small></td><td><strong>{transaction.customerName}</strong><small>{transaction.customerWhatsapp}</small></td><td>{cameraSummary(transaction)}{transaction.isManualPrice && <span className="manual-flag">TARIF MANUAL</span>}</td><td><span className={`location-pill location-${transaction.location}`}>{transaction.location === 'cafe' ? 'Cafe' : 'Event'}</span></td>{isOwner && <td>{transaction.cashierName}<small>{transaction.cashierId}</small></td>}<td>{transaction.paymentMethod === 'cash' ? 'Tunai' : 'QRIS DANA'}{transaction.paymentMethod === 'qris_dana' && transaction.verifiedBy && <small>Diverifikasi {transaction.verifiedBy.split(' ')[0]}</small>}</td><td className="money-cell">{formatCurrency(transaction.total)}</td><td><StatusBadge transaction={transaction} /></td><td><div className="history-actions"><button className="table-action-button" disabled={transaction.paymentStatus !== 'paid'} onClick={() => onPrint(transaction)}><Printer size={14} /> Cetak ulang</button>{isOwner && transaction.paymentStatus !== 'void' && <button className="table-action-button table-void-button" onClick={() => onVoid(transaction)}><X size={13} /> Void</button>}</div></td></tr>)}</tbody></table></div>}
        <div className="table-footer"><span>Menampilkan <strong>{filtered.length}</strong> dari <strong>{transactions.length}</strong> transaksi termuat</span><span>Riwayat bersumber dari server</span></div>
      </div>
    </>
  );
}

function Catalog({ cameras, addons, draft, setDraft, addonDraft, setAddonDraft, onCreate, onUpdate, onToggle, onDeleteCamera, onCreateAddon, onDeleteAddon, onUpdateAddons, onNotice }) {
  const [form, setForm] = useState({ name: '', price1: '', price2: '', image: '', tone: 'pink', active: true });
  const addonForm = addonDraft ?? addons;
  const setAddonForm = setAddonDraft;
  const previousAddons = useRef(addons);
  const [newAddon, setNewAddon] = useState({ category: 'property', label: '', price: '' });
  const [showNewAddon, setShowNewAddon] = useState(false);
  const [error, setError] = useState('');
  const [addonError, setAddonError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingAddons, setSavingAddons] = useState(false);
  const [savingNewAddon, setSavingNewAddon] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => {
    const baseline = previousAddons.current;
    setAddonDraft((current) => addons.map((next) => {
      const local = current?.find((entry) => entry.id === next.id);
      const old = baseline.find((entry) => entry.id === next.id);
      if (!local || !old) return next;
      const merged = { ...next };
      for (const field of ['label', 'price', 'active']) {
        if (String(local[field]) !== String(old[field])) merged[field] = local[field];
      }
      return merged;
    }));
    previousAddons.current = addons;
  }, [addons, setAddonDraft]);
  const dirtyAddons = addonForm.filter((local) => {
    const saved = addons.find((entry) => entry.id === local.id);
    return saved && ['label', 'price', 'active'].some((field) => String(local[field]) !== String(saved[field]));
  }).length;
  useEffect(() => {
    if (draft) setForm({ name: draft.name, price1: draft.prices[1], price2: draft.prices[2], image: draft.image || '', tone: draft.tone || 'pink', active: draft.active });
    else setForm({ name: '', price1: '', price2: '', image: '', tone: 'pink', active: true });
    setImageFile(null);
    setError('');
  }, [draft]);
  const change = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const uploadImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Ukuran foto maksimal 3 MB.');
      return;
    }
    const reader = new FileReader();
    setImageFile(file);
    reader.onload = () => change('image', String(reader.result));
    reader.onerror = () => setError('Foto tidak dapat dibaca. Silakan pilih file lain.');
    reader.readAsDataURL(file);
  };
  const saveCamera = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || Number(form.price1) <= 0 || Number(form.price2) <= 0) {
      setError('Nama kamera dan harga 1 jam / 2 jam wajib diisi lebih dari Rp 0.');
      return;
    }
    setSaving(true);
    setError('');
    const cameraData = { name: form.name.trim(), price1: Number(form.price1), price2: Number(form.price2) };
    try {
      if (draft) await onUpdate(draft.id, cameraData, imageFile);
      else await onCreate(cameraData, imageFile);
      setImageFile(null);
      setDraft(null);
    } catch (saveError) {
      setError(saveError.message);
      onNotice(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  const toggleActive = async (camera) => {
    try {
      await onToggle(camera.id, !camera.active);
    } catch (toggleError) {
      setError(toggleError.message);
      onNotice(toggleError.message);
    }
  };
  const deleteCamera = async (camera) => {
    try {
      await onDeleteCamera(camera);
    } catch (deleteError) {
      setError(deleteError.message);
      onNotice(deleteError.message);
    }
  };
  const deleteAddon = async (addon) => {
    try {
      await onDeleteAddon(addon);
    } catch (deleteError) {
      setAddonError(deleteError.message);
      onNotice(deleteError.message);
    }
  };
  const updateAddonField = (id, key, value) => {
    setAddonForm((previous) => previous.map((addon) => addon.id === id ? { ...addon, [key]: value } : addon));
  };
  const saveAddonCatalog = async (event) => {
    event.preventDefault();
    const invalidAddon = addonForm.find((addon) => !addon.label.trim()
      || addon.price === '' || addon.price == null
      || !Number.isSafeInteger(Number(addon.price))
      || Number(addon.price) < 0
      || Number(addon.price) > 100_000_000);
    if (invalidAddon) {
      setAddonError('Nama layanan wajib diisi dan harga harus berupa angka minimal Rp 0.');
      return;
    }
    setSavingAddons(true);
    setAddonError('');
    try {
      const normalized = addonForm.map((addon) => ({
        ...addon,
        label: addon.label.trim(),
        price: Number(addon.price),
      }));
      await onUpdateAddons(normalized);
      setAddonForm(normalized);
    } catch (saveError) {
      setAddonError(saveError.message);
      onNotice(saveError.message);
    } finally {
      setSavingAddons(false);
    }
  };
  const createAddon = async (event) => {
    event.preventDefault();
    if (!newAddon.label.trim() || newAddon.price === '' || !Number.isSafeInteger(Number(newAddon.price)) || Number(newAddon.price) < 0) {
      setAddonError('Nama add-on wajib diisi dan harga harus berupa angka minimal Rp 0.');
      return;
    }
    setSavingNewAddon(true);
    setAddonError('');
    try {
      await onCreateAddon({
        category: newAddon.category,
        label: newAddon.label.trim(),
        price: Number(newAddon.price),
      });
      setNewAddon({ category: 'property', label: '', price: '' });
      setShowNewAddon(false);
    } catch (saveError) {
      setAddonError(saveError.message);
      onNotice(saveError.message);
    } finally {
      setSavingNewAddon(false);
    }
  };
  const addonGroups = ['property', 'photographer', 'print', 'transfer'].map((category) => ({
    category,
    options: addonForm.filter((addon) => addon.category === category),
  }));
  return (
    <>
      <PageHeading eyebrow="PENGELOLAAN KATALOG" title="Katalog sewa." description="Kelola kamera dan layanan tambahan dalam satu tempat." action={<button className="button button-primary" onClick={() => { setDraft(null); document.getElementById('catalog-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}><Plus size={17} /> Tambah kamera</button>} />
      <nav className="catalog-jump-nav" aria-label="Bagian katalog"><a href="#camera-catalog"><Camera size={16} aria-hidden="true" /> Kamera <span>{cameras.length}</span></a><a href="#addon-catalog"><ShoppingBag size={16} aria-hidden="true" /> Add-on <span>{addons.length}</span></a></nav>
      <div className="catalog-summary"><div><div className="summary-icon"><Camera size={19} /></div><span><strong>{cameras.length} kamera</strong><small>{cameras.filter((camera) => camera.active).length} kamera aktif di katalog kasir</small></span></div><span className="catalog-tip"><ShieldCheck size={15} /> Harga transaksi tersimpan sebagai snapshot</span></div>
      <div className="catalog-layout">
        <section className="catalog-list" id="camera-catalog">
          <div className="section-heading catalog-section-heading"><div><h2>Daftar kamera</h2><p>Kelola kamera yang tersedia untuk disewa</p></div><span className="catalog-count">{cameras.length} ITEM</span></div>
          <div className="catalog-grid">{cameras.map((camera) => <article className={`catalog-card ${!camera.active ? 'catalog-inactive' : ''}`} key={camera.id}><div className="catalog-camera-visual"><CameraArtwork tone={camera.tone} image={camera.image} /><span className={`catalog-status ${camera.active ? '' : 'catalog-status-off'}`}>{camera.active ? 'Aktif' : 'Nonaktif'}</span><button className="catalog-edit" onClick={() => { setDraft(camera); document.getElementById('catalog-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} aria-label={`Edit ${camera.name}`}><Settings2 size={16} /></button></div><div className="catalog-card-body"><h3>{camera.name}</h3><div className="catalog-prices"><span><small>1 JAM</small><strong>{formatCurrency(camera.prices[1])}</strong></span><i /><span><small>2 JAM</small><strong>{formatCurrency(camera.prices[2])}</strong></span></div><div className="catalog-card-footer"><button className="edit-link" onClick={() => { setDraft(camera); document.getElementById('catalog-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Edit detail <ArrowRight size={14} /></button><div className="catalog-card-actions"><button className={`toggle-switch ${camera.active ? 'toggle-on' : ''}`} onClick={() => toggleActive(camera)} role="switch" aria-checked={camera.active} aria-label={camera.active ? 'Nonaktifkan kamera' : 'Aktifkan kamera'}><i /></button><button type="button" className="catalog-delete" onClick={() => deleteCamera(camera)} aria-label={`Hapus ${camera.name}`} title="Hapus kamera"><Trash2 size={14} /></button></div></div></div></article>)}</div>
        </section>
        <form id="catalog-form" className="panel catalog-form" onSubmit={saveCamera}>
          <div className="catalog-form-heading"><div className="catalog-form-icon"><Camera size={18} /></div><div><h2>{draft ? 'Edit kamera' : 'Tambah kamera'}</h2><p>{draft ? 'Perbarui detail katalog' : 'Tambahkan kamera ke katalog'}</p></div>{draft && <button type="button" className="icon-button" onClick={() => setDraft(null)} aria-label="Batal edit"><X size={17} /></button>}</div>
          <div className="form-field"><label className="field-label" htmlFor="cameraName">Nama kamera <span>*</span></label><input id="cameraName" className="text-input" value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="Contoh: Canon Ixus 185" /></div>
          <div className="form-grid catalog-price-grid"><div className="form-field"><label className="field-label" htmlFor="camera-price-1">Harga 1 jam <span>*</span></label><div className="currency-input"><span>Rp</span><input className="text-input" id="camera-price-1" type="number" min="1" value={form.price1} onChange={(event) => change('price1', event.target.value)} placeholder="25.000" /></div></div><div className="form-field"><label className="field-label" htmlFor="camera-price-2">Harga 2 jam <span>*</span></label><div className="currency-input"><span>Rp</span><input className="text-input" id="camera-price-2" type="number" min="1" value={form.price2} onChange={(event) => change('price2', event.target.value)} placeholder="35.000" /></div></div></div>
          <div className="form-field"><label className="field-label">Foto kamera <span className="optional-tag">OPSIONAL</span></label><input className="hidden-input" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} /><div className="catalog-image-preview"><CameraArtwork tone={form.tone} image={form.image} /><button type="button" className="image-upload-button" onClick={() => fileRef.current?.click()}><ImagePlus size={15} /> {form.image ? 'Ganti foto' : 'Pilih foto'}</button></div><small className="field-hint">JPG, PNG, atau WebP · maksimal 3 MB.</small></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-primary button-full catalog-save" type="submit" disabled={saving}>{draft ? <Check size={16} /> : <Plus size={16} />}{saving ? 'Menyimpan...' : draft ? 'Simpan perubahan' : 'Tambah ke katalog'}</button>
          <p className="catalog-form-note"><ShieldCheck size={14} /> Kamera nonaktif tetap tersimpan di riwayat transaksi.</p>
        </form>
      </div>
      <div className="panel addon-catalog-panel" id="addon-catalog">
        <div className="catalog-form-heading addon-panel-heading">
          <div className="catalog-form-icon"><ShoppingBag size={20} aria-hidden="true" /></div>
          <div><span className="eyebrow">LAYANAN TAMBAHAN</span><h2>Katalog add-on</h2><p>Sesuaikan layanan yang bisa dipilih saat transaksi.</p></div>
          <button type="button" className="button button-secondary" aria-expanded={showNewAddon} aria-controls="new-addon-form" onClick={() => setShowNewAddon((visible) => !visible)}>{showNewAddon ? <X size={16} /> : <Plus size={16} />} {showNewAddon ? 'Tutup form' : 'Tambah add-on'}</button>
        </div>
        <div className="addon-catalog-groups">
          {addonGroups.map(({ category, options }) => {
            const Icon = addonCategoryIcons[category];
            return <section className="addon-catalog-group" key={category} aria-labelledby={`addon-category-${category}`}>
              <div className="addon-category-heading"><span className="addon-category-icon"><Icon size={18} aria-hidden="true" /></span><h3 id={`addon-category-${category}`}>{addonCategoryLabels[category]}</h3><span className="addon-category-count">{options.length} layanan</span></div>
              {options.length === 0 && <p className="addon-empty">Belum ada layanan. Gunakan Tambah add-on untuk memulai.</p>}
              {options.map((addon) => <div className={`addon-catalog-row ${!addon.active ? 'addon-catalog-inactive' : ''}`} key={addon.id}>
                <label className="addon-name-field"><span>Nama layanan</span><input aria-label={`Nama ${addon.label}`} value={addon.label} maxLength={100} disabled={savingAddons} onChange={(event) => updateAddonField(addon.id, 'label', event.target.value)} /></label>
                <label className="addon-price-field"><span>Harga</span><span className="addon-price-input"><span>Rp</span><input aria-label={`Harga ${addon.label}`} type="number" min="0" max="100000000" step="1" value={addon.price} disabled={savingAddons} onChange={(event) => updateAddonField(addon.id, 'price', event.target.value)} /></span></label>
                <label className="addon-active-control"><input type="checkbox" aria-label={`Aktifkan ${addon.label}`} checked={addon.active} disabled={savingAddons} onChange={(event) => updateAddonField(addon.id, 'active', event.target.checked)} /><span>{addon.active ? 'Aktif' : 'Nonaktif'}</span></label>
                <button type="button" className="catalog-delete addon-delete" disabled={savingAddons} onClick={() => deleteAddon(addon)} aria-label={`Hapus add-on ${addon.label}`} title="Hapus add-on"><Trash2 size={17} /></button>
              </div>)}
            </section>;
          })}
        </div>
        {showNewAddon && <form id="new-addon-form" className="addon-create-form" onSubmit={createAddon}>
          <label className="addon-create-field"><span>Kategori</span><select value={newAddon.category} onChange={(event) => setNewAddon((previous) => ({ ...previous, category: event.target.value }))}><option value="property">Properti</option><option value="photographer">Fotografer</option><option value="print">Print foto</option><option value="transfer">Pemindahan file</option></select></label>
          <label className="addon-create-field"><span>Nama layanan</span><input value={newAddon.label} maxLength={100} onChange={(event) => setNewAddon((previous) => ({ ...previous, label: event.target.value }))} placeholder="Nama produk atau layanan" /></label>
          <label className="addon-create-field"><span>Harga</span><span className="addon-price-input"><b>Rp</b><input type="number" min="0" max="100000000" value={newAddon.price} onChange={(event) => setNewAddon((previous) => ({ ...previous, price: event.target.value }))} /></span></label>
          <button className="button button-primary button-small" type="submit" disabled={savingNewAddon}>{savingNewAddon ? 'Menambahkan...' : 'Simpan add-on'}</button>
        </form>}
        {addonError && <div className="form-error" role="alert">{addonError}</div>}
        <div className={`addon-save-bar ${dirtyAddons ? 'addon-save-bar-dirty' : ''}`}>
          <div className="addon-save-status" role="status" aria-live="polite">{dirtyAddons ? <Clock3 size={19} aria-hidden="true" /> : <CheckCircle2 size={19} aria-hidden="true" />}<span><strong>{dirtyAddons ? `${dirtyAddons} layanan belum disimpan` : 'Katalog sudah tersimpan'}</strong><small>{dirtyAddons ? 'Simpan perubahan agar tersedia untuk transaksi baru.' : 'Perubahan nama, harga, dan status disimpan melalui tombol ini.'}</small></span></div>
          <div className="addon-save-actions">{dirtyAddons > 0 && <button type="button" className="button button-secondary" disabled={savingAddons} onClick={() => { setAddonForm(addons); setAddonError(''); }}><RotateCcw size={16} /> Batalkan</button>}<button className="button button-primary" type="button" onClick={saveAddonCatalog} disabled={savingAddons || !dirtyAddons}><Save size={17} /> {savingAddons ? 'Menyimpan…' : 'Simpan katalog add-on'}</button></div>
        </div>
      </div>
    </>
  );
}

function Reports({
  report, loading, error, date, setDate, period, setPeriod, cashier, setCashier,
  location, setLocation, onLoad, onExport,
}) {
  useEffect(() => {
    onLoad();
  }, []);
  return (
    <>
      <PageHeading
        eyebrow="LAPORAN OPERASIONAL"
        title="Cerita dalam angka."
        description="Pantau pendapatan dan aktivitas penyewaan berdasarkan periode, kasir, dan lokasi."
        action={<button className="button button-secondary" onClick={onExport}><FileText size={16} /> Unduh PDF</button>}
      />
      <div className="panel report-filters">
        <label className="select-filter"><CalendarDays size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Periode laporan"><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option></select><ChevronDown size={14} /></label>
        <div className="date-filter"><CalendarDays size={15} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Tanggal laporan" /></div>
        <label className="select-filter"><Users size={15} /><select value={cashier} onChange={(event) => setCashier(event.target.value)} aria-label="Filter kasir"><option value="all">Semua kasir</option><option value="kasir1">Kasir 1</option><option value="kasir2">Kasir 2</option></select><ChevronDown size={14} /></label>
        <label className="select-filter"><Filter size={15} /><select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Filter lokasi"><option value="all">Semua lokasi</option><option value="cafe">Cafe</option><option value="event">Event</option></select><ChevronDown size={14} /></label>
        <button className="button button-primary button-small" onClick={onLoad} disabled={loading}>{loading ? 'Memuat...' : 'Terapkan filter'}</button>
        <span className="report-period">{report ? `${report.period.from} — ${report.period.to}` : 'Pilih periode laporan'}</span>
      </div>
      {error && <div className="error-banner"><X size={16} />{error}</div>}
      {loading && !report ? <div className="loading-banner"><span className="loading-spinner" /> Memuat laporan...</div> : report && <>
        <section className="stats-grid report-stats">
          <StatCard label="Pendapatan lunas" value={formatCurrency(report.totals.revenue)} detail={`${report.totals.paidCount} transaksi lunas`} icon={Wallet} tone="pink" />
          <StatCard label="Jumlah transaksi" value={report.totals.transactionCount} detail={`${report.totals.voidCount} void`} icon={ShoppingBag} tone="lavender" />
          <StatCard label="Menunggu verifikasi" value={report.totals.pendingCount} detail="Pembayaran QRIS DANA" icon={Clock3} tone="peach" />
          <StatCard label="Tarif manual" value={report.totals.manualPriceCount} detail="Transaksi berdurasi > 2 jam" icon={SlidersHorizontal} tone="mint" />
        </section>
        <div className="report-panels">
          <section className="panel report-panel"><div className="panel-heading"><div><h2>Pendapatan per metode bayar</h2><p>Transaksi lunas pada periode ini</p></div><CreditCard size={17} className="muted-icon" /></div>
            <div className="report-metric-row"><span><i className="report-dot report-dot-cash" /> Tunai</span><strong>{formatCurrency(report.totals.paymentMethods.cash)}</strong></div>
            <div className="report-metric-row"><span><i className="report-dot report-dot-qris" /> QRIS DANA</span><strong>{formatCurrency(report.totals.paymentMethods.qrisDana)}</strong></div>
          </section>
          <section className="panel report-panel"><div className="panel-heading"><div><h2>Pendapatan per lokasi</h2><p>Perbandingan Cafe dan Event</p></div><Store size={17} className="muted-icon" /></div>
            {report.byLocation.length ? report.byLocation.map((item) => <div className="report-metric-row" key={item.location}><span><i className={`report-dot ${item.location === 'cafe' ? 'report-dot-cash' : 'report-dot-qris'}`} /> {item.location === 'cafe' ? 'Cafe' : 'Event'} <small>· {item.transactionCount} transaksi</small></span><strong>{formatCurrency(item.revenue)}</strong></div>) : <p className="report-empty">Belum ada transaksi pada periode ini.</p>}
          </section>
          <section className="panel report-panel report-wide"><div className="panel-heading"><div><h2>Performa kasir</h2><p>Jumlah transaksi dan pendapatan</p></div><Users size={17} className="muted-icon" /></div>
            {report.byCashier.length ? <div className="table-wrap"><table><thead><tr><th>Kasir</th><th>Transaksi</th><th>Pendapatan</th></tr></thead><tbody>{report.byCashier.map((item) => <tr key={item.cashierId}><td>{item.cashierName}<small>{item.cashierId}</small></td><td>{item.transactionCount}</td><td className="money-cell">{formatCurrency(item.revenue)}</td></tr>)}</tbody></table></div> : <p className="report-empty">Belum ada aktivitas kasir pada periode ini.</p>}
          </section>
          <section className="panel report-panel report-wide"><div className="panel-heading"><div><h2>Kamera terlaris</h2><p>Model dengan penyewaan terbanyak</p></div><Camera size={17} className="muted-icon" /></div>
            {report.popularCameras.length ? <div className="popular-camera-list">{report.popularCameras.map((item, index) => <div className="popular-camera-row" key={`${item.cameraId}-${item.cameraName}`}><span className="popular-rank">{String(index + 1).padStart(2, '0')}</span><strong>{item.cameraName}</strong><span>{item.rentalCount} sewa</span><b>{formatCurrency(item.revenue)}</b></div>)}</div> : <p className="report-empty">Belum ada kamera yang disewa pada periode ini.</p>}
          </section>
        </div>
        <p className="report-footnote"><ShieldCheck size={14} /> Data laporan berasal dari transaksi server. Pendapatan menghitung transaksi lunas dan mengecualikan void.</p>
      </>}
    </>
  );
}

function PrintView({ transaction, variant, settings, busy, onSettings, onBack, onPrint, onChangeFormat }) {
  const isAdmin = variant === 'admin';
  return <div className="print-page">
    <PageHeading eyebrow={isAdmin ? 'STRUK ADMIN' : 'STRUK PELANGGAN'} title="Siap untuk dicetak." description={`${transaction.receiptNo} · ${transaction.location === 'cafe' ? 'Cafe' : 'Event'}`} action={<button className="button button-secondary" disabled={busy} onClick={onBack}><ArrowLeft size={16} /> Kembali</button>} />
    <div className="print-layout">
      <div className="panel print-help">
        <div className="print-help-icon"><Printer size={22} /></div><h2>Struk {isAdmin ? 'admin' : 'pelanggan'}</h2>
        <p>Kertas {settings.paperWidth} mm · {settings.mode === 'browser' ? 'Printer sistem' : settings.mode === 'rawbt' ? 'Penghubung RawBT Android' : settings.label || 'Printer ESC/POS'}</p>
        <p>{settings.mode === 'browser' ? 'Pilih printer dengan kertas roll dan panjang otomatis, skala 100%, serta nonaktifkan header/footer browser.' : settings.mode === 'rawbt' ? 'Printer default mengikuti pengaturan di aplikasi RawBT. Periksa hasil cetak melalui aplikasi tersebut.' : 'Struk dikirim langsung ke printer yang telah dipilih. Jika printer diganti, pilih perangkat baru di pengaturan.'}</p>
        <button className="button button-primary" disabled={busy} aria-busy={busy} onClick={onPrint}><Printer size={17} /> {busy ? 'Memproses…' : `Cetak struk ${isAdmin ? 'admin' : 'pelanggan'}`}</button>
        <button className="button button-secondary print-change-format" disabled={busy} onClick={onChangeFormat}>Pilih format struk lainnya</button>
        <button className="button button-secondary print-change-format" disabled={busy} onClick={onSettings}><Settings2 size={16} /> Pengaturan printer</button>
      </div>
      <div className="print-preview"><span className="eyebrow">PRATINJAU · {settings.paperWidth} MM · {isAdmin ? 'ADMIN' : 'PELANGGAN'}</span><Receipt transaction={transaction} variant={variant} /></div>
    </div>
  </div>;
}

export default App;
