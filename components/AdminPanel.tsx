import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authenticateAdmin } from '../adminConfig';
import { MENU_ITEMS } from '../constants';
import { deleteSharedOrder, getSharedOrders, updateSharedOrderStatus } from '../services/orderApi';
import { getNotificationPermission, safeStorage } from '../services/browserSupport';
import { StorageService } from '../services/storage';
import { AdminRole, AdminSession, MonthlySalesReport, Order, OrderStatus, OrderType, OutletConfig } from '../types';
import OrderCard, { formatRelativeTime } from './admin/OrderCard';

type AdminPanelView = 'login' | 'outlet_select' | 'dashboard';
type AdminTab = 'overview' | 'all' | 'outlet' | 'analytics' | 'reports' | 'controls';
type ManagerTab = 'live' | 'history' | 'reports' | 'info';
type DateFilter = 'today' | 'week' | 'month' | 'all';

interface AdminPanelProps {
  session: AdminSession | null;
  onSessionChange: (session: AdminSession | null) => void;
  onClose: () => void;
  onLogout: () => void;
  outlets: OutletConfig[];
}

const roleClasses: Record<AdminRole, string> = {
  admin: 'border border-red-700 bg-red-900 text-red-300',
  manager: 'border border-amber-700 bg-amber-900 text-amber-300',
  staff: 'border border-green-700 bg-green-900 text-green-300',
};

const typeLabels: Record<OrderType, string> = {
  delivery: 'Delivery',
  takeaway: 'Takeaway',
  dinein: 'Dine-in',
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const orderDate = (order: Order) => new Date(order.receivedAt ?? order.date);
const currency = (value: number) => `Rs ${Math.round(value).toLocaleString('en-IN')}`;
const isToday = (order: Order) => orderDate(order).toISOString().slice(0, 10) === todayKey();
const isDoneToday = (order: Order) => order.status === 'done' && isToday(order);
const outletName = (outletId?: string) =>
  StorageService.getMergedOutlets().find((outlet) => outlet.id === outletId)?.name ?? outletId ?? 'Unknown outlet';

const filterByDate = (orders: Order[], dateFilter: DateFilter): Order[] => {
  const now = Date.now();
  const ranges: Record<DateFilter, number> = {
    today: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 31 * 24 * 60 * 60 * 1000,
    all: Number.POSITIVE_INFINITY,
  };

  if (dateFilter === 'today') {
    return orders.filter(isToday);
  }

  return orders.filter((order) => now - orderDate(order).getTime() <= ranges[dateFilter]);
};

const advanceOrderStatus = (
  order: Order,
  requestedStatus?: OrderStatus,
): OrderStatus | null => {
  if (requestedStatus) return requestedStatus;
  if ((order.status ?? 'new') === 'new') return 'preparing';
  if (order.status === 'preparing') return order.orderType === 'delivery' ? 'out_for_delivery' : 'ready';
  if (order.status === 'ready' || order.status === 'out_for_delivery') return 'done';
  return null;
};

const useOutletOrders = (outletId: string | null, role: AdminRole, alertOnIncrease = false) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const previousCountRef = useRef<number | null>(null);

  const triggerNewOrderAlert = useCallback(async (order: Order) => {
    navigator.vibrate?.([300, 100, 300, 100, 300]);
    setIsFlashing(true);
    window.setTimeout(() => setIsFlashing(false), 600);

    try {
      const audio = new Audio('/sounds/order-ding.mp3');
      audio.volume = 0.8;
      await audio.play();
    } catch {
      setSoundBlocked(true);
    }

    if (getNotificationPermission() === 'granted') {
      new Notification("New Order at Harino's!", {
        body: `#${order.id} · ${order.orderType.toUpperCase()} · Rs ${Math.round(order.total)}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: order.id,
        requireInteraction: true,
      });
    }
  }, []);

  const refreshOrders = useCallback(() => {
    if (!outletId) return;

    const applyFreshOrders = (freshOrders: Order[]) => {
      setOrders(freshOrders);

      if (alertOnIncrease) {
        if (previousCountRef.current === null) {
          previousCountRef.current = freshOrders.length;
          return;
        }

        if (freshOrders.length > previousCountRef.current && freshOrders[0]) {
          void triggerNewOrderAlert(freshOrders[0]);
        }
        previousCountRef.current = freshOrders.length;
      }
    };

    void getSharedOrders(outletId)
      .then((freshOrders) => {
        freshOrders.forEach((order) => StorageService.saveOrderToOutlet(order));
        applyFreshOrders(freshOrders);
      })
      .catch(() => {
        applyFreshOrders(StorageService.getOutletOrders(outletId));
      });
  }, [alertOnIncrease, outletId, triggerNewOrderAlert]);

  useEffect(() => {
    refreshOrders();
    const interval = window.setInterval(refreshOrders, role === 'staff' ? 3000 : 5000);
    return () => window.clearInterval(interval);
  }, [refreshOrders, role]);

  useEffect(() => {
    if (!outletId) return;

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('harinos_orders');
      channel.onmessage = (event) => {
        if (event.data?.outletId === outletId) {
          refreshOrders();
        }
      };
    } catch {
      // Same-browser real-time updates fall back to polling when BroadcastChannel is unavailable.
    }

    const storageHandler = (event: StorageEvent) => {
      if (event.key === `harinos_outlet_orders_${outletId}`) {
        refreshOrders();
      }
    };

    window.addEventListener('storage', storageHandler);
    return () => {
      channel?.close();
      window.removeEventListener('storage', storageHandler);
    };
  }, [outletId, refreshOrders]);

  return { orders, refreshOrders, isFlashing, soundBlocked, setSoundBlocked };
};

const AdminPanel: React.FC<AdminPanelProps> = ({
  session,
  onSessionChange,
  onClose,
  onLogout,
  outlets,
}) => {
  const allOutlets = outlets;
  const [currentSession, setCurrentSession] = useState<AdminSession | null>(session);
  const initialView = (): AdminPanelView => {
    if (!session) return 'login';
    if (session.role !== 'admin' && session.outletId === null) return 'outlet_select';
    return 'dashboard';
  };
  const [view, setView] = useState<AdminPanelView>(initialView);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setCurrentSession(session);
    if (!session) {
      setView('login');
      return;
    }
    setView(session.role !== 'admin' && session.outletId === null ? 'outlet_select' : 'dashboard');
  }, [session]);

  const saveSession = (nextSession: AdminSession) => {
    StorageService.saveAdminSession(nextSession);
    setCurrentSession(nextSession);
    onSessionChange(nextSession);
  };

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    const user = authenticateAdmin(username.trim(), password);
    if (!user) {
      setError('Invalid credentials. Please try again.');
      return;
    }

    const now = new Date().toISOString();
    const nextSession: AdminSession = {
      role: user.role,
      username: user.username,
      outletId: user.outletId,
      loginTime: now,
      lastActivityTime: now,
    };
    saveSession(nextSession);
    setPassword('');
    setError('');
    setView(user.role !== 'admin' && user.outletId === null ? 'outlet_select' : 'dashboard');
  };

  const handleLogout = () => {
    onLogout();
    setCurrentSession(null);
    setUsername('');
    setPassword('');
    setView('login');
  };

  const handleActivity = () => {
    if (view === 'dashboard') {
      StorageService.updateAdminSessionActivity();
    }
  };

  const chooseOutlet = (outletId: string) => {
    if (!currentSession) return;

    const nextSession = {
      ...currentSession,
      outletId,
      lastActivityTime: new Date().toISOString(),
    };
    saveSession(nextSession);
    setView('dashboard');
  };

  return (
    <div
      className="admin-panel-root fixed inset-0 z-[200] overflow-hidden text-white"
      style={{ background: 'var(--admin-bg)' }}
      onClick={handleActivity}
      onKeyDown={handleActivity}
    >
      <style>{`
        .admin-panel-root {
          --admin-bg: #0a0a0f;
          --admin-surface: #111118;
          --admin-surface-2: #1a1a24;
          --admin-border: #2a2a38;
          --admin-red: #dc2626;
          --admin-red-hover: #b91c1c;
          --admin-red-glow: rgba(220,38,38,0.15);
          --admin-gold: #f59e0b;
          --admin-green: #10b981;
          --admin-purple: #8b5cf6;
          --admin-text: #f8fafc;
          --admin-text-muted: #94a3b8;
          --admin-text-dim: #475569;
        }
        @keyframes flashFade { from { opacity: 0.5; } to { opacity: 0; } }
        @keyframes pulseGold { 0%,100% { border-color: #f59e0b; } 50% { border-color: transparent; } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes holdSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      {view === 'login' && (
        <LoginScreen
          username={username}
          password={password}
          error={error}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onSubmit={handleLogin}
          onClose={onClose}
        />
      )}

      {view === 'outlet_select' && currentSession && (
        <OutletSelectScreen
          outlets={allOutlets}
          onSelect={chooseOutlet}
          onBack={() => {
            StorageService.clearAdminSession();
            onSessionChange(null);
            setCurrentSession(null);
            setView('login');
          }}
        />
      )}

      {view === 'dashboard' && currentSession && (
        <>
          <DashboardTopBar session={currentSession} onLogout={handleLogout} onClose={onClose} />
          {currentSession.role === 'admin' && <AdminDashboard session={currentSession} outlets={outlets} />}
          {currentSession.role === 'manager' && <ManagerDashboard session={currentSession} outlets={allOutlets} />}
          {currentSession.role === 'staff' && <StaffDashboard session={currentSession} outlets={allOutlets} />}
        </>
      )}
    </div>
  );
};

interface LoginScreenProps {
  username: string;
  password: string;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
  username,
  password,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onClose,
}) => (
  <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.28),transparent_58%)]" />
    <button
      type="button"
      onClick={onClose}
      className="absolute right-4 top-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-slate-300"
      aria-label="Close admin panel"
    >
      x
    </button>
    <form onSubmit={onSubmit} className="relative w-full max-w-[380px] rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-2xl">
      <img src="/icon-192.png" alt="Harino's" className="mx-auto h-16 w-16 rounded-2xl" />
      <h2 className="mt-4 text-center font-display text-3xl font-bold text-red-500">Harino&apos;s</h2>
      <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
        Administration Access
      </div>
      <div className="my-6 h-px bg-slate-800" />
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        Username
        <input
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-red-500 focus:outline-none"
          autoComplete="username"
        />
      </label>
      <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-slate-500">
        Password
        <input
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-red-500 focus:outline-none"
          type="password"
          autoComplete="current-password"
        />
      </label>
      <div className="mt-3 min-h-5 text-xs text-red-400">{error}</div>
      <button type="submit" className="mt-2 w-full rounded-2xl bg-red-600 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-white transition-all duration-200 hover:bg-red-700">
        Sign In
      </button>
      <div className="mt-5 flex justify-center gap-2">
        {['Admin', 'Manager', 'Staff'].map((role) => (
          <span key={role} className="rounded-full border border-slate-700 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
            {role}
          </span>
        ))}
      </div>
    </form>
  </div>
);

const OutletSelectScreen: React.FC<{
  outlets: OutletConfig[];
  onSelect: (outletId: string) => void;
  onBack: () => void;
}> = ({ outlets, onSelect, onBack }) => (
  <div className="flex min-h-screen flex-col bg-slate-950 px-4 py-8">
    <h2 className="text-center font-display text-3xl font-bold text-white">Which outlet are you at?</h2>
    <div className="mx-auto mt-8 w-full max-w-2xl flex-1 space-y-3 overflow-y-auto pb-6">
      {outlets.map((outlet) => (
        <div key={outlet.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-black text-white">{outlet.name}</div>
              <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest ${outlet.enabled ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                {outlet.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-500">{outlet.address ?? 'No address set'}</div>
          </div>
          <button type="button" onClick={() => onSelect(outlet.id)} className="flex-shrink-0 rounded-xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white">
            Enter
          </button>
        </div>
      ))}
    </div>
    <button type="button" onClick={onBack} className="mx-auto text-sm font-bold text-slate-400 underline">
      Back to Login
    </button>
  </div>
);

const DashboardTopBar: React.FC<{
  session: AdminSession;
  onLogout: () => void;
  onClose: () => void;
}> = ({ session, onLogout, onClose }) => (
  <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <img src="/icon-192.png" alt="Harino's" className="h-8 w-8 rounded-xl" />
        <div className="font-black text-white">Admin Panel</div>
      </div>
      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${roleClasses[session.role]}`}>
          {session.role}
        </span>
        <span className="truncate text-sm text-slate-400">{session.username}</span>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <button type="button" onClick={onLogout} className="text-xs font-bold text-slate-400">
          Sign Out
        </button>
        <button type="button" onClick={onClose} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-slate-300">
          x Close
        </button>
      </div>
    </div>
  </header>
);

const AdminDashboard: React.FC<{ session: AdminSession; outlets: OutletConfig[] }> = ({ session }) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [selectedOutletId, setSelectedOutletId] = useState(StorageService.getMergedOutlets()[0]?.id ?? '');
  const [refreshKey, setRefreshKey] = useState(0);
  const [sharedOrders, setSharedOrders] = useState<Order[]>(StorageService.getAllOrders());
  const allOrders = useMemo(() => sharedOrders, [sharedOrders, refreshKey]);
  const refresh = () => setRefreshKey((key) => key + 1);
  const handleStatus = (outletId: string, orderId: string, status: OrderStatus) => {
    StorageService.updateOrderStatus(outletId, orderId, status, session.username);
    void updateSharedOrderStatus(outletId, orderId, status, session.username).catch(() => undefined);
    refresh();
  };

  useEffect(() => {
    const refreshSharedOrders = () => {
      void getSharedOrders()
        .then((orders) => {
          orders.forEach((order) => StorageService.saveOrderToOutlet(order));
          setSharedOrders(orders);
        })
        .catch(() => setSharedOrders(StorageService.getAllOrders()));
    };
    refreshSharedOrders();
    const interval = window.setInterval(refreshSharedOrders, 5000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="h-[calc(100vh-57px)] overflow-y-auto bg-slate-950 pb-24">
      <PillTabs
        tabs={[
          ['overview', 'Overview'],
          ['all', 'All Orders'],
          ['outlet', 'By Outlet'],
          ['analytics', 'Analytics'],
          ['reports', 'Reports'],
          ['controls', 'Controls'],
        ]}
        active={tab}
        onChange={(nextTab) => setTab(nextTab as AdminTab)}
      />
      {tab === 'overview' && <AdminOverview orders={allOrders} outlets={StorageService.getMergedOutlets()} />}
      {tab === 'all' && <AdminAllOrders orders={allOrders} session={session} outlets={StorageService.getMergedOutlets()} onStatus={handleStatus} />}
      {tab === 'outlet' && (
        <AdminByOutlet
          outlets={StorageService.getMergedOutlets()}
          selectedOutletId={selectedOutletId}
          onSelectOutlet={setSelectedOutletId}
          session={session}
          onStatus={handleStatus}
        />
      )}
      {tab === 'analytics' && <AdminAnalytics orders={allOrders} outlets={StorageService.getMergedOutlets()} />}
      {tab === 'reports' && <ReportsTab role="admin" />}
      {tab === 'controls' && <AdminControls outlets={StorageService.getMergedOutlets()} onChange={refresh} />}
    </main>
  );
};

const PillTabs: React.FC<{
  tabs: [string, string][];
  active: string;
  onChange: (value: string) => void;
}> = ({ tabs, active, onChange }) => (
  <div className="sticky top-0 z-[9] flex gap-2 overflow-x-auto border-b border-slate-800 bg-slate-950 px-4 py-3 snap-x snap-mandatory">
    {tabs.map(([value, label]) => (
      <button
        key={value}
        type="button"
        onClick={() => onChange(value)}
        className={`flex-shrink-0 snap-start rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
          active === value ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

const AdminOverview: React.FC<{ orders: Order[]; outlets: OutletConfig[] }> = ({ orders, outlets }) => {
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const todayOrders = orders.filter(isToday);
  return (
    <section className="space-y-5 p-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Orders" value={orders.length.toString()} />
        <StatCard label="Total Revenue" value={currency(totalRevenue)} />
        <StatCard label="Active Outlets" value={`${outlets.filter((outlet) => outlet.enabled).length}/${outlets.length}`} />
        <StatCard label="Today's Orders" value={todayOrders.length.toString()} />
      </div>
      <h3 className="font-display text-2xl font-bold text-white">Recent Orders</h3>
      <div className="space-y-2">
        {orders.slice(0, 10).map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black text-white">#{order.id}</span>
              <span className="text-xs text-slate-400">{outletName(order.outletId)}</span>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-300">
                {order.orderType}
              </span>
              <span className="font-black text-red-300">{currency(order.total)}</span>
              <span className="text-xs text-slate-500">{formatRelativeTime(order.receivedAt ?? order.date)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</div>
    <div className="mt-2 text-2xl font-black text-white">{value}</div>
  </div>
);

const AdminAllOrders: React.FC<{
  orders: Order[];
  session: AdminSession;
  outlets: OutletConfig[];
  onStatus: (outletId: string, orderId: string, status: OrderStatus) => void;
}> = ({ orders, outlets, onStatus }) => {
  const [outletFilter, setOutletFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<OrderType | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const filteredOrders = filterByDate(orders, dateFilter).filter((order) => {
    const outletMatches = outletFilter === 'all' || order.outletId === outletFilter;
    const typeMatches = typeFilter === 'all' || order.orderType === typeFilter;
    return outletMatches && typeMatches;
  });

  return (
    <section className="p-4">
      <div className="sticky top-[57px] z-[8] mb-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-3">
        <select value={outletFilter} onChange={(event) => setOutletFilter(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white">
          <option value="all">All outlets</option>
          {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
        </select>
        <div className="flex gap-2 overflow-x-auto">
          {(['all', 'delivery', 'takeaway', 'dinein'] as const).map((type) => (
            <button key={type} onClick={() => setTypeFilter(type)} className={`flex-shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest ${typeFilter === type ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {type === 'all' ? 'All' : typeLabels[type]}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {(['today', 'week', 'month', 'all'] as const).map((date) => (
            <button key={date} onClick={() => setDateFilter(date)} className={`flex-shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest ${dateFilter === date ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {date === 'week' ? 'This Week' : date === 'month' ? 'This Month' : date === 'all' ? 'All Time' : 'Today'}
            </button>
          ))}
        </div>
      </div>
      {filteredOrders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          role="admin"
          outlet={outlets.find((outlet) => outlet.id === order.outletId)}
          showOutletName
          onStatusChange={(orderId, status) => order.outletId && onStatus(order.outletId, orderId, status)}
          defaultExpanded={false}
        />
      ))}
      {!filteredOrders.length && <EmptyState label="No orders match these filters." />}
    </section>
  );
};

const AdminByOutlet: React.FC<{
  outlets: OutletConfig[];
  selectedOutletId: string;
  onSelectOutlet: (outletId: string) => void;
  session: AdminSession;
  onStatus: (outletId: string, orderId: string, status: OrderStatus) => void;
}> = ({ outlets, selectedOutletId, onSelectOutlet, session, onStatus }) => {
  const selectedOutlet = outlets.find((outlet) => outlet.id === selectedOutletId) ?? outlets[0];
  const orders = StorageService.getOutletOrders(selectedOutlet?.id ?? '');
  return (
    <section className="p-4">
      <div className="mb-4 flex gap-2 overflow-x-auto snap-x snap-mandatory">
        {outlets.map((outlet) => (
          <button key={outlet.id} onClick={() => onSelectOutlet(outlet.id)} className={`flex-shrink-0 snap-start rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${selectedOutlet?.id === outlet.id ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {outlet.name}
          </button>
        ))}
      </div>
      {selectedOutlet && (
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <div className="font-display text-2xl font-bold text-white">{selectedOutlet.name}</div>
          <div className="mt-2">Phone: {selectedOutlet.phone}</div>
          <div>Address: {selectedOutlet.address ?? 'Not set'}</div>
          <div>Delivery radius: {selectedOutlet.deliveryRadiusKm} km</div>
          <div>Coordinates: {selectedOutlet.latitude}, {selectedOutlet.longitude}</div>
          <div>Open override: {String(StorageService.getOutletOpen(selectedOutlet.id) ?? 'time-based')}</div>
          <div>Announcement: {StorageService.getOutletAnnouncement(selectedOutlet.id) ?? '-'}</div>
        </div>
      )}
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} role={session.role} outlet={selectedOutlet} onStatusChange={(orderId, status) => selectedOutlet && onStatus(selectedOutlet.id, orderId, status)} />
      ))}
      {!orders.length && <EmptyState label="No orders for this outlet yet." />}
    </section>
  );
};

const AdminAnalytics: React.FC<{ orders: Order[]; outlets: OutletConfig[] }> = ({ orders, outlets }) => {
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0) || 1;
  const revenueByOutlet = outlets.map((outlet) => ({
    outlet,
    revenue: orders.filter((order) => order.outletId === outlet.id).reduce((sum, order) => sum + order.total, 0),
  }));
  const items = new Map<string, { quantity: number; revenue: number }>();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const current = items.get(item.name) ?? { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.totalPrice;
      items.set(item.name, current);
    });
  });
  const topItems = [...items.entries()].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 10);
  const typeCounts = (['delivery', 'takeaway', 'dinein'] as OrderType[]).map((type) => ({
    type,
    count: orders.filter((order) => order.orderType === type).length,
  }));
  const hourly = Array.from({ length: 24 }, (_, hour) => orders.filter((order) => orderDate(order).getHours() === hour).length);
  const maxHour = Math.max(1, ...hourly);
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, count: orders.filter((order) => orderDate(order).toISOString().slice(0, 10) === key).length };
  });
  const maxTrend = Math.max(1, ...trend.map((day) => day.count));

  return (
    <section className="space-y-6 p-4">
      <AnalyticsSection title="Revenue by Outlet">
        {revenueByOutlet.map(({ outlet, revenue }) => <BarRow key={outlet.id} label={outlet.name} value={currency(revenue)} percentage={(revenue / totalRevenue) * 100} />)}
      </AnalyticsSection>
      <AnalyticsSection title="Top 10 Items">
        {topItems.map(([name, stats]) => <BarRow key={name} label={`${name} · ${stats.quantity} sold`} value={currency(stats.revenue)} percentage={(stats.quantity / Math.max(1, topItems[0]?.[1].quantity ?? 1)) * 100} />)}
      </AnalyticsSection>
      <AnalyticsSection title="Order Type Split">
        <div className="grid grid-cols-3 gap-3">
          {typeCounts.map(({ type, count }) => (
            <div key={type} className="rounded-2xl bg-slate-900 p-4 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-8 border-red-600 text-xl font-black text-white">
                {Math.round((count / Math.max(1, orders.length)) * 100)}%
              </div>
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{typeLabels[type]}</div>
            </div>
          ))}
        </div>
      </AnalyticsSection>
      <AnalyticsSection title="Busiest Hours">
        <div className="flex h-32 items-end gap-1 overflow-x-auto rounded-2xl bg-slate-900 p-3">
          {hourly.map((count, hour) => (
            <div key={hour} className="flex w-8 flex-shrink-0 flex-col items-center justify-end gap-1">
              <div className={`w-full rounded-t ${count === maxHour ? 'bg-red-600' : 'bg-slate-700'}`} style={{ height: `${Math.max(4, (count / maxHour) * 100)}%` }} />
              <div className="text-[9px] text-slate-500">{hour}</div>
            </div>
          ))}
        </div>
      </AnalyticsSection>
      <AnalyticsSection title="Daily Order Trend">
        <div className="flex h-32 items-end gap-2 overflow-x-auto rounded-2xl bg-slate-900 p-3">
          {trend.map((day) => (
            <div key={day.key} className="flex w-10 flex-shrink-0 flex-col items-center justify-end gap-1">
              <div className="w-full rounded-t bg-red-600" style={{ height: `${Math.max(4, (day.count / maxTrend) * 100)}%` }} />
              <div className="text-[9px] text-slate-500">{day.key.slice(5)}</div>
            </div>
          ))}
        </div>
      </AnalyticsSection>
    </section>
  );
};

const AnalyticsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h3 className="mb-3 font-display text-2xl font-bold text-white">{title}</h3>
    {children}
  </section>
);

const BarRow: React.FC<{ label: string; value: string; percentage: number }> = ({ label, value, percentage }) => (
  <div className="mb-3 rounded-2xl bg-slate-900 p-3">
    <div className="mb-2 flex justify-between gap-3 text-sm">
      <span className="truncate text-slate-300">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.min(100, percentage)}%` }} />
    </div>
  </div>
);

const getCompletedMonths = (count: number): Array<{ year: number; month: number; label: string; value: string }> => {
  const months = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() - 1);

  for (let index = 0; index < count; index += 1) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    months.push({
      year,
      month,
      label: cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      value: `${year}-${String(month).padStart(2, '0')}`,
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return months;
};

const downloadReportAsCSV = (report: MonthlySalesReport): void => {
  const rows = [
    ['Harinos Monthly Sales Report', report.monthLabel, report.outletName],
    [],
    ['Metric', 'Value'],
    ['Total Orders', report.totalOrders],
    ['Total Revenue (Rs)', report.totalRevenue],
    ['Avg Order Value (Rs)', report.avgOrderValue.toFixed(2)],
    ['Peak Hour', `${report.peakHour}:00`],
    [],
    ['Order Type', 'Orders', 'Revenue'],
    ['Delivery', report.orderTypeSplit.delivery, report.deliveryVsPickupRevenue.delivery],
    ['Takeaway + Dine-in', report.orderTypeSplit.takeaway + report.orderTypeSplit.dinein, report.deliveryVsPickupRevenue.pickup],
    [],
    ['Item Name', 'Qty Sold', 'Revenue (Rs)'],
    ...report.topItems.map((item) => [item.name, item.qty, item.revenue]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Harinos_Report_${report.month}_${report.outletId ?? 'All'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const ReportsTab: React.FC<{ role: AdminRole; outletId?: string | null }> = ({ role, outletId = null }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const months = getCompletedMonths(role === 'admin' ? 3 : 1);
  const outlets = StorageService.getMergedOutlets();
  const [selectedMonth, setSelectedMonth] = useState(months[0]?.value ?? '');
  const [selectedOutlet, setSelectedOutlet] = useState<string | null>(role === 'admin' ? null : outletId);
  const monthParts = selectedMonth.split('-').map(Number);
  const report = StorageService.generateMonthlyReport(selectedOutlet, monthParts[0], monthParts[1]);

  const printReport = () => {
    if (!reportRef.current) return;
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(`
      <html><head><title>Harinos Sales Report</title>
      <style>
        body { font-family: sans-serif; color: #111; padding: 32px; }
        h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 8px 12px; border-bottom: 1px solid #eee; text-align: left; }
        th { font-weight: 700; background: #f5f5f5; }
        .section-title { margin-top: 24px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #555; }
      </style></head><body>${reportRef.current.innerHTML}</body></html>
    `);
    printWindow?.document.close();
    printWindow?.print();
  };

  return (
    <section className="space-y-4 p-4">
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-3">
        <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">
          {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
        </select>
        <select
          value={selectedOutlet ?? 'all'}
          disabled={role !== 'admin'}
          onChange={(event) => setSelectedOutlet(event.target.value === 'all' ? null : event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white disabled:opacity-60"
        >
          <option value="all">All Outlets</option>
          {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={printReport} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white">PDF</button>
          <button onClick={() => downloadReportAsCSV(report)} className="flex-1 rounded-xl border border-slate-700 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300">CSV</button>
        </div>
      </div>

      <div ref={reportRef} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-200">
        <h1 className="text-center font-display text-2xl font-black text-white">Harino&apos;s Monthly Sales Report</h1>
        <div className="mt-1 text-center text-sm text-slate-400">{report.monthLabel} - {report.outletName}</div>
        <div className="section-title mt-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Summary</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard label="Total Orders" value={report.totalOrders.toString()} />
          <StatCard label="Total Revenue" value={currency(report.totalRevenue)} />
          <StatCard label="Avg Order" value={currency(report.avgOrderValue)} />
          <StatCard label="Peak Hour" value={`${report.peakHour}:00`} />
        </div>
        <div className="section-title mt-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Order Type Breakdown</div>
        <div className="mt-3 space-y-2 text-sm">
          <div>Delivery: {report.orderTypeSplit.delivery} orders - {currency(report.deliveryVsPickupRevenue.delivery)}</div>
          <div>Takeaway: {report.orderTypeSplit.takeaway} orders</div>
          <div>Dine-in: {report.orderTypeSplit.dinein} orders</div>
          <div>Pickup Revenue: {currency(report.deliveryVsPickupRevenue.pickup)}</div>
        </div>
        <div className="section-title mt-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Top Items</div>
        <div className="mt-3 space-y-2">
          {report.topItems.slice(0, 5).map((item, index) => (
            <div key={item.name} className="flex justify-between gap-3 rounded-xl bg-slate-800 p-3 text-sm">
              <span>{index + 1}. {item.name} - {item.qty} sold</span>
              <span className="font-bold text-white">{currency(item.revenue)}</span>
            </div>
          ))}
          {!report.topItems.length && <div className="text-sm text-slate-500">No orders in this report period.</div>}
        </div>
      </div>
    </section>
  );
};

const AdminControls: React.FC<{ outlets: OutletConfig[]; onChange: () => void }> = ({ outlets, onChange }) => {
  const [announcementText, setAnnouncementText] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState(StorageService.getItemAvailabilityOverrides());
  const [outletDrafts, setOutletDrafts] = useState<OutletConfig[]>(outlets);
  const refreshAvailability = () => setAvailability(StorageService.getItemAvailabilityOverrides());
  const persistOutletDrafts = (nextDrafts: OutletConfig[]) => {
    setOutletDrafts(nextDrafts);
    StorageService.saveOutletConfigOverrides(nextDrafts);
    onChange();
  };
  return (
    <section className="space-y-6 p-4">
      <AnalyticsSection title="Outlet Manager">
        {outletDrafts.map((outlet, index) => (
          <div key={outlet.id} className="mb-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 font-black text-white">{outlet.name || outlet.id}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['name', 'Name'],
                ['phone', 'Phone'],
                ['address', 'Address'],
                ['deliveryRadiusKm', 'Delivery radius km'],
                ['freeDeliveryRadiusKm', 'Free radius km'],
                ['freeDeliveryMinimumOrder', 'Free min Rs'],
                ['deliveryChargePerKm', 'Charge/km Rs'],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {label}
                  <input
                    value={String(outlet[field] ?? '')}
                    type={typeof outlet[field] === 'number' ? 'number' : 'text'}
                    onChange={(event) => {
                      const nextDrafts = [...outletDrafts];
                      nextDrafts[index] = {
                        ...outlet,
                        [field]: typeof outlet[field] === 'number' ? Number(event.target.value) : event.target.value,
                      };
                      setOutletDrafts(nextDrafts);
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => persistOutletDrafts(outletDrafts)} className="rounded-xl bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">Save Outlet</button>
              <button
                onClick={() => {
                  const nextDrafts = [...outletDrafts];
                  nextDrafts[index] = { ...outlet, enabled: !outlet.enabled };
                  persistOutletDrafts(nextDrafts);
                }}
                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest ${outlet.enabled ? 'bg-green-800 text-green-200' : 'bg-slate-800 text-slate-300'}`}
              >
                {outlet.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => {
            const nextId = `outlet-${outletDrafts.length + 1}`;
            persistOutletDrafts([
              ...outletDrafts,
              {
                id: nextId,
                enabled: false,
                name: `New Outlet ${outletDrafts.length + 1}`,
                phone: '',
                address: '',
                latitude: 0,
                longitude: 0,
                deliveryRadiusKm: 7,
                freeDeliveryRadiusKm: 3,
                freeDeliveryMinimumOrder: 150,
                minimumOrderIncrementPerKm: 100,
                deliveryChargePerKm: 15,
              },
            ]);
          }}
          className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300"
        >
          Add New Outlet
        </button>
      </AnalyticsSection>
      <AnalyticsSection title="Outlet Open / Closed">
        {outlets.map((outlet) => (
          <div key={outlet.id} className="mb-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="font-black text-white">{outlet.name}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => { StorageService.setOutletOpen(outlet.id, true); onChange(); }} className="rounded-xl bg-green-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">Open</button>
              <button onClick={() => { StorageService.setOutletOpen(outlet.id, false); onChange(); }} className="rounded-xl bg-red-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">Closed</button>
              <button onClick={() => { StorageService.setOutletOpen(outlet.id, null); onChange(); }} className="rounded-xl bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300">Auto</button>
            </div>
          </div>
        ))}
      </AnalyticsSection>
      <AnalyticsSection title="Announcement Banner">
        {outlets.map((outlet) => (
          <div key={outlet.id} className="mb-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 font-black text-white">{outlet.name}</div>
            <input value={announcementText[outlet.id] ?? StorageService.getOutletAnnouncement(outlet.id) ?? ''} onChange={(event) => setAnnouncementText((current) => ({ ...current, [outlet.id]: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-red-500 focus:outline-none" />
            <div className="mt-3 flex gap-2">
              <button onClick={() => { StorageService.setOutletAnnouncement(outlet.id, announcementText[outlet.id] ?? ''); onChange(); }} className="rounded-xl bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">Publish</button>
              <button onClick={() => { StorageService.clearOutletAnnouncement(outlet.id); setAnnouncementText((current) => ({ ...current, [outlet.id]: '' })); onChange(); }} className="rounded-xl bg-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300">Clear</button>
            </div>
          </div>
        ))}
      </AnalyticsSection>
      <AnalyticsSection title="Menu Item Availability">
        {MENU_ITEMS.map((item) => {
          const effectiveAvailable = availability[item.id] ?? item.available;
          return (
            <div key={item.id} className="mb-2 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 p-3">
              <div className="min-w-0">
                <div className="truncate font-bold text-white">{item.name}</div>
                <div className="text-xs text-slate-500">{item.category}</div>
              </div>
              <button onClick={() => { StorageService.setItemAvailability(item.id, !effectiveAvailable); refreshAvailability(); onChange(); }} className={`flex-shrink-0 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest ${effectiveAvailable ? 'bg-green-800 text-green-200' : 'bg-red-900 text-red-200'}`}>
                {effectiveAvailable ? 'Available' : 'Unavailable'}
              </button>
            </div>
          );
        })}
      </AnalyticsSection>
    </section>
  );
};

const ManagerDashboard: React.FC<{ session: AdminSession; outlets: OutletConfig[] }> = ({ session, outlets }) => {
  const [tab, setTab] = useState<ManagerTab>('live');
  const { orders, refreshOrders } = useOutletOrders(session.outletId, 'manager');
  const outlet = outlets.find((item) => item.id === session.outletId);
  const handleStatus = (orderId: string, status: OrderStatus) => {
    if (!session.outletId) return;
    StorageService.updateOrderStatus(session.outletId, orderId, status, session.username);
    void updateSharedOrderStatus(session.outletId, orderId, status, session.username).catch(() => undefined);
    refreshOrders();
  };
  return (
    <main className="h-[calc(100vh-57px)] overflow-y-auto bg-slate-950 pb-24">
      <PillTabs tabs={[['live', 'Live Orders'], ['history', 'History'], ['reports', 'Reports'], ['info', 'Outlet Info']]} active={tab} onChange={(value) => setTab(value as ManagerTab)} />
      {tab === 'live' && <LiveOrders orders={orders} session={session} outlet={outlet} onStatus={handleStatus} />}
      {tab === 'history' && <HistoryOrders orders={orders} session={session} outlet={outlet} onStatus={handleStatus} />}
      {tab === 'reports' && <ReportsTab role="manager" outletId={session.outletId} />}
      {tab === 'info' && outlet && <OutletInfo outlet={outlet} />}
    </main>
  );
};

const LiveOrders: React.FC<{ orders: Order[]; session: AdminSession; outlet?: OutletConfig; onStatus: (orderId: string, status: OrderStatus) => void }> = ({ orders, session, outlet, onStatus }) => {
  const activeOrders = orders.filter((order) => order.status !== 'done' && order.status !== 'cancelled');
  const recent = activeOrders.filter((order) => Date.now() - orderDate(order).getTime() <= 60 * 60 * 1000);
  const older = activeOrders.filter((order) => Date.now() - orderDate(order).getTime() > 60 * 60 * 1000);
  const doneToday = orders.filter(isDoneToday);
  return (
    <section className="p-4">
      <div className="mb-4 flex justify-end text-[10px] font-black uppercase tracking-widest text-red-400"><span className="mr-2 animate-pulse">●</span> Live</div>
      <OrderSection title="New" orders={recent} role={session.role} outlet={outlet} onStatus={onStatus} highlight="amber" />
      <OrderSection title="Active" orders={older} role={session.role} outlet={outlet} onStatus={onStatus} />
      <details className="mt-5">
        <summary className="cursor-pointer font-display text-xl font-bold text-white">Completed Today ({doneToday.length})</summary>
        <OrderSection title="" orders={doneToday} role={session.role} outlet={outlet} onStatus={onStatus} />
      </details>
    </section>
  );
};

const HistoryOrders: React.FC<{ orders: Order[]; session: AdminSession; outlet?: OutletConfig; onStatus: (orderId: string, status: OrderStatus) => void }> = ({ orders, session, outlet, onStatus }) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [query, setQuery] = useState('');
  const filtered = filterByDate(orders, dateFilter).filter((order) => order.id.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="p-4">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order ID" className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none" />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(['today', 'week', 'all'] as DateFilter[]).map((filter) => (
          <button key={filter} onClick={() => setDateFilter(filter)} className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${dateFilter === filter ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{filter}</button>
        ))}
      </div>
      <OrderSection title="" orders={filtered} role={session.role} outlet={outlet} onStatus={onStatus} />
    </section>
  );
};

const StaffDashboard: React.FC<{ session: AdminSession; outlets: OutletConfig[] }> = ({ session, outlets }) => {
  const { orders, refreshOrders, isFlashing, soundBlocked, setSoundBlocked } = useOutletOrders(session.outletId, 'staff', true);
  const [notificationStatus, setNotificationStatus] = useState(getNotificationPermission());
  const [bannerDismissed, setBannerDismissed] = useState(
    safeStorage.getItem(window.localStorage, 'harinos_staff_notifications_enabled') === 'true',
  );
  const outlet = outlets.find((item) => item.id === session.outletId);
  const pending = orders.filter((order) => order.status !== 'done' && order.status !== 'cancelled');
  const recent = pending.filter((order) => Date.now() - orderDate(order).getTime() <= 30 * 60 * 1000);
  const progress = pending.filter((order) => !recent.includes(order));
  const doneToday = orders.filter(isDoneToday);
  const handleStatus = (orderId: string, status: OrderStatus) => {
    if (!session.outletId) return;
    StorageService.updateOrderStatus(session.outletId, orderId, status, session.username);
    void updateSharedOrderStatus(session.outletId, orderId, status, session.username).catch(() => undefined);
    refreshOrders();
  };
  const requestNotifications = async () => {
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
    if (permission === 'granted') {
      safeStorage.setItem(window.localStorage, 'harinos_staff_notifications_enabled', 'true');
      setBannerDismissed(true);
    }
  };
  return (
    <main className="h-[calc(100vh-57px)] overflow-y-auto bg-slate-950 pb-24">
      {isFlashing && <div className="pointer-events-none fixed inset-0 z-[300] bg-red-500/40" style={{ animation: 'flashFade 0.6s ease-out forwards' }} />}
      <section className="sticky top-0 z-[9] border-b border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-2xl font-bold text-white">Incoming Orders</div>
            <div className="mt-1 text-xs text-slate-500">{outlet?.name ?? 'Outlet'}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-red-400"><span className="animate-pulse">●</span> Live</div>
            <div className="mt-2 rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">{pending.length} pending</div>
          </div>
        </div>
      </section>
      {notificationStatus === 'default' && !bannerDismissed && (
        <div className="m-4 rounded-2xl border border-amber-700 bg-amber-950 p-4 text-amber-100">
          <div className="font-bold">Enable notifications to get alerted when new orders arrive.</div>
          <button onClick={requestNotifications} className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-950">Allow</button>
        </div>
      )}
      {soundBlocked && (
        <button onClick={() => setSoundBlocked(false)} className="mx-4 mt-4 w-[calc(100%-2rem)] rounded-2xl bg-slate-800 p-3 text-sm font-bold text-slate-300">
          Tap anywhere to enable sound alerts.
        </button>
      )}
      <section className="p-4">
        <StaffStats orders={orders} />
        <OrderSection title="New" orders={recent} role="staff" outlet={outlet} onStatus={handleStatus} highlight="red" defaultExpanded />
        <OrderSection title="In Progress" orders={progress} role="staff" outlet={outlet} onStatus={handleStatus} highlight="amber" defaultExpanded />
        <details className="mt-5">
          <summary className="cursor-pointer font-display text-xl font-bold text-white">Earlier Today ({doneToday.length})</summary>
          <OrderSection title="" orders={doneToday} role="staff" outlet={outlet} onStatus={handleStatus} />
        </details>
      </section>
    </main>
  );
};

const OrderSection: React.FC<{
  title: string;
  orders: Order[];
  role: AdminRole;
  outlet?: OutletConfig;
  onStatus: (orderId: string, status: OrderStatus) => void;
  highlight?: 'red' | 'amber';
  defaultExpanded?: boolean;
}> = ({ title, orders, role, outlet, onStatus, highlight, defaultExpanded = false }) => (
  <section className="mb-5">
    {title && <h3 className="mb-3 font-display text-xl font-bold text-white">{title} ({orders.length})</h3>}
    {orders.map((order) => (
      <div key={order.id} className={highlight === 'red' ? 'rounded-2xl border-l-4 border-red-500 animate-pulse' : highlight === 'amber' ? 'rounded-2xl border-l-4 border-amber-400 animate-pulse' : ''}>
        <OrderCard order={order} role={role} outlet={outlet} onStatusChange={(orderId, status) => onStatus(orderId, advanceOrderStatus(order, status) ?? status)} defaultExpanded={defaultExpanded} />
      </div>
    ))}
    {!orders.length && title && <EmptyState label={`No ${title.toLowerCase()} orders.`} />}
  </section>
);

const StaffStats: React.FC<{ orders: Order[] }> = ({ orders }) => {
  const todayOrders = orders.filter(isToday);
  const revenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const itemCounts = new Map<string, number>();
  todayOrders.forEach((order) => {
    order.items.forEach((item) => itemCounts.set(item.name, (itemCounts.get(item.name) ?? 0) + item.quantity));
  });
  const topItem = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      <StatCard label="Today" value={currency(revenue)} />
      <StatCard label="Orders" value={todayOrders.length.toString()} />
      <StatCard label="Top" value={topItem} />
    </div>
  );
};

const OutletInfo: React.FC<{ outlet: OutletConfig }> = ({ outlet }) => (
  <section className="p-4">
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
      <h3 className="font-display text-3xl font-bold text-white">{outlet.name}</h3>
      <div className="mt-4 space-y-2 text-sm">
        <div>Phone: <a href={`tel:${outlet.phone}`} className="text-red-300 underline">{outlet.phone}</a></div>
        <div>Address: {outlet.address ?? 'Not set'}</div>
        <div>Lat/Lng: {outlet.latitude}, {outlet.longitude}</div>
        <div>Delivery radius: {outlet.deliveryRadiusKm} km</div>
        <div>Free delivery threshold: {currency(outlet.freeDeliveryMinimumOrder)}</div>
        <div>Delivery charge per km: {currency(outlet.deliveryChargePerKm)}</div>
        <div>Current override: {String(StorageService.getOutletOpen(outlet.id) ?? 'time-based')}</div>
      </div>
      <p className="mt-5 text-xs text-slate-500">To edit outlet details, update OUTLET_LOCATIONS in constants.tsx and redeploy.</p>
    </div>
  </section>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-6 text-center text-sm text-slate-500">
    {label}
  </div>
);

export default AdminPanel;
