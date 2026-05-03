
import { OUTLET_LOCATIONS } from '../constants';
import { AdminSession, MonthlySalesReport, Order, OrderStatus, OutletConfig } from '../types';
import { safeStorage } from './browserSupport';

const KEYS = {
  ORDERS: 'harinos_past_orders',
  OUTLET_ORDERS: (outletId: string) => `harinos_outlet_orders_${outletId}`,
  ALL_ORDERS: 'harinos_all_orders',
  ADMIN_SESSION: 'harinos_admin_session',
  OUTLET_OPEN: (outletId: string) => `harinos_outlet_open_${outletId}`,
  OUTLET_ANNOUNCEMENT: (outletId: string) => `harinos_announcement_${outletId}`,
  ITEM_AVAILABILITY: 'harinos_item_availability',
  OUTLET_CONFIG: 'harinos_outlet_config_overrides',
  CUSTOMER_PHONE: 'harinos_customer_phone',
  CUSTOMER_PHONE_SKIPPED: 'harinos_phone_skip',
  CUSTOMER_LOCATION: 'harinos_customer_location',
  NOTIFICATION_PERM: 'harinos_notif_permission_asked',
  COMPLETED_ORDERS: (outletId: string) => `harinos_completed_${outletId}`,
};

const readJson = <T,>(key: string, fallback: T): T => {
  const saved = safeStorage.getItem(window.localStorage, key);
  if (!saved) {
    return fallback;
  }

  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  safeStorage.setItem(window.localStorage, key, JSON.stringify(value));
};

const sortOrdersNewestFirst = (orders: Order[]): Order[] =>
  [...orders].sort((a, b) => {
    const aTime = new Date(a.receivedAt ?? a.date).getTime();
    const bTime = new Date(b.receivedAt ?? b.date).getTime();
    return bTime - aTime;
  });

const ensureOrderDefaults = (order: Order): Order => {
  const now = new Date().toISOString();
  const receivedAt = order.receivedAt ?? now;
  const status = order.status ?? 'new';

  return {
    ...order,
    receivedAt,
    status,
    statusHistory: order.statusHistory?.length
      ? order.statusHistory
      : [{ status, timestamp: receivedAt, changedBy: 'customer' }],
  };
};

export const StorageService = {
  getPastOrders: (): Order[] => {
    const saved = safeStorage.getItem(window.localStorage, KEYS.ORDERS);
    try {
      return saved ? JSON.parse(saved).slice(0, 3) : [];
    } catch {
      return [];
    }
  },
  saveOrder: (order: Order) => {
    const orders = StorageService.getPastOrders();
    const updatedOrders = [order, ...orders].slice(0, 3);
    safeStorage.setItem(window.localStorage, KEYS.ORDERS, JSON.stringify(updatedOrders));
  },
  saveOrderToOutlet: (order: Order): void => {
    if (!order.outletId) {
      return;
    }

    const enrichedOrder = ensureOrderDefaults(order);
    const outletOrders = StorageService.getOutletOrders(order.outletId).filter(
      (existingOrder) => existingOrder.id !== enrichedOrder.id,
    );
    const allOrders = StorageService.getAllOrders().filter(
      (existingOrder) => existingOrder.id !== enrichedOrder.id,
    );

    writeJson(KEYS.OUTLET_ORDERS(order.outletId), sortOrdersNewestFirst([enrichedOrder, ...outletOrders]));
    writeJson(KEYS.ALL_ORDERS, sortOrdersNewestFirst([enrichedOrder, ...allOrders]));
  },
  getOutletOrders: (outletId: string): Order[] => {
    if (!outletId) {
      return [];
    }

    return sortOrdersNewestFirst(readJson<Order[]>(KEYS.OUTLET_ORDERS(outletId), []));
  },
  getAllOrders: (): Order[] => sortOrdersNewestFirst(readJson<Order[]>(KEYS.ALL_ORDERS, [])),
  updateOrderStatus: (
    outletId: string,
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string,
  ): void => {
    const timestamp = new Date().toISOString();
    const applyStatus = (order: Order): Order =>
      order.id === orderId
        ? {
            ...ensureOrderDefaults(order),
            status: newStatus,
            statusHistory: [
              ...(ensureOrderDefaults(order).statusHistory ?? []),
              { status: newStatus, timestamp, changedBy },
            ],
          }
        : order;

    writeJson(KEYS.OUTLET_ORDERS(outletId), StorageService.getOutletOrders(outletId).map(applyStatus));
    writeJson(KEYS.ALL_ORDERS, StorageService.getAllOrders().map(applyStatus));

    try {
      const channel = new BroadcastChannel('harinos_orders');
      channel.postMessage({ type: 'ORDER_STATUS_CHANGED', outletId, orderId, status: newStatus });
      channel.close();
    } catch {
      // BroadcastChannel is not available in every browser. Polling remains the source of truth.
    }
  },
  deleteOrder: (outletId: string, orderId: string): void => {
    writeJson(
      KEYS.OUTLET_ORDERS(outletId),
      StorageService.getOutletOrders(outletId).filter((order) => order.id !== orderId),
    );
    writeJson(
      KEYS.ALL_ORDERS,
      StorageService.getAllOrders().filter((order) => order.id !== orderId),
    );
  },
  saveAdminSession: (session: AdminSession): void => {
    writeJson(KEYS.ADMIN_SESSION, session);
  },
  getAdminSession: (): AdminSession | null => readJson<AdminSession | null>(KEYS.ADMIN_SESSION, null),
  clearAdminSession: (): void => {
    safeStorage.removeItem(window.localStorage, KEYS.ADMIN_SESSION);
  },
  updateSessionActivity: (): void => {
    const session = StorageService.getAdminSession();
    if (!session) {
      return;
    }

    StorageService.saveAdminSession({
      ...session,
      lastActivityTime: new Date().toISOString(),
    });
  },
  updateAdminSessionActivity: (): void => {
    StorageService.updateSessionActivity();
  },
  setOutletOpen: (outletId: string, isOpen: boolean | null): void => {
    if (isOpen === null) {
      safeStorage.removeItem(window.localStorage, KEYS.OUTLET_OPEN(outletId));
      return;
    }

    safeStorage.setItem(window.localStorage, KEYS.OUTLET_OPEN(outletId), JSON.stringify(isOpen));
  },
  clearOutletOpen: (outletId: string): void => {
    StorageService.setOutletOpen(outletId, null);
  },
  getOutletOpen: (outletId: string): boolean | null => {
    if (!outletId) {
      return null;
    }

    return readJson<boolean | null>(KEYS.OUTLET_OPEN(outletId), null);
  },
  setOutletAnnouncement: (outletId: string, text: string | null): void => {
    if (!text?.trim()) {
      safeStorage.removeItem(window.localStorage, KEYS.OUTLET_ANNOUNCEMENT(outletId));
      return;
    }

    safeStorage.setItem(window.localStorage, KEYS.OUTLET_ANNOUNCEMENT(outletId), text);
  },
  getOutletAnnouncement: (outletId: string): string | null => {
    if (!outletId) {
      return null;
    }

    const announcement = safeStorage.getItem(window.localStorage, KEYS.OUTLET_ANNOUNCEMENT(outletId));
    return announcement?.trim() ? announcement : null;
  },
  clearOutletAnnouncement: (outletId: string): void => {
    StorageService.setOutletAnnouncement(outletId, null);
  },
  saveOutletConfigOverrides: (overrides: Partial<OutletConfig>[]): void => {
    writeJson(KEYS.OUTLET_CONFIG, overrides);
  },
  getOutletConfigOverrides: (): Partial<OutletConfig>[] =>
    readJson<Partial<OutletConfig>[]>(KEYS.OUTLET_CONFIG, []),
  getMergedOutlets: (): OutletConfig[] => {
    const overrides = StorageService.getOutletConfigOverrides();
    const baseOutlets = OUTLET_LOCATIONS.map((outlet) => {
      const override = overrides.find((item) => item.id === outlet.id);
      return override ? { ...outlet, ...override } : outlet;
    });
    const addedOutlets = overrides.filter(
      (override): override is OutletConfig =>
        Boolean(override.id) &&
        !OUTLET_LOCATIONS.some((outlet) => outlet.id === override.id) &&
        typeof override.name === 'string' &&
        typeof override.phone === 'string' &&
        typeof override.latitude === 'number' &&
        typeof override.longitude === 'number',
    );

    return [...baseOutlets, ...addedOutlets];
  },
  setItemAvailability: (itemId: string, available: boolean): void => {
    const overrides = StorageService.getItemAvailabilityOverrides();
    overrides[itemId] = available;
    writeJson(KEYS.ITEM_AVAILABILITY, overrides);
  },
  getItemAvailabilityOverrides: (): Record<string, boolean> =>
    readJson<Record<string, boolean>>(KEYS.ITEM_AVAILABILITY, {}),
  clearItemAvailability: (itemId: string): void => {
    const overrides = StorageService.getItemAvailabilityOverrides();
    delete overrides[itemId];
    writeJson(KEYS.ITEM_AVAILABILITY, overrides);
  },
  saveCustomerPhone: (phone: string): void => {
    safeStorage.setItem(window.localStorage, KEYS.CUSTOMER_PHONE, phone);
    safeStorage.removeItem(window.localStorage, KEYS.CUSTOMER_PHONE_SKIPPED);
  },
  getCustomerPhone: (): string | null => {
    const phone = safeStorage.getItem(window.localStorage, KEYS.CUSTOMER_PHONE);
    return phone?.trim() ? phone : null;
  },
  skipCustomerPhone: (): void => {
    safeStorage.setItem(window.localStorage, KEYS.CUSTOMER_PHONE_SKIPPED, 'true');
  },
  hasSkippedCustomerPhone: (): boolean =>
    safeStorage.getItem(window.localStorage, KEYS.CUSTOMER_PHONE_SKIPPED) === 'true',
  saveCustomerLocation: (lat: number, lng: number, address: string): void => {
    writeJson(KEYS.CUSTOMER_LOCATION, { lat, lng, address });
  },
  getCustomerLocation: (): { lat: number; lng: number; address: string } | null =>
    readJson<{ lat: number; lng: number; address: string } | null>(KEYS.CUSTOMER_LOCATION, null),
  generateMonthlyReport: (
    outletId: string | null,
    year: number,
    month: number,
  ): MonthlySalesReport => {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthDate = new Date(year, month - 1, 1);
    const sourceOrders = outletId ? StorageService.getOutletOrders(outletId) : StorageService.getAllOrders();
    const orders = sourceOrders.filter((order) => {
      const receivedAt = new Date(order.receivedAt ?? order.date);
      return receivedAt.getFullYear() === year && receivedAt.getMonth() === month - 1;
    });
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
    const hourlyCounts = Array.from({ length: 24 }, () => 0);
    const orderTypeSplit = { delivery: 0, takeaway: 0, dinein: 0 };
    const deliveryVsPickupRevenue = { delivery: 0, pickup: 0 };

    orders.forEach((order) => {
      hourlyCounts[new Date(order.receivedAt ?? order.date).getHours()] += 1;
      orderTypeSplit[order.orderType] += 1;
      if (order.orderType === 'delivery') {
        deliveryVsPickupRevenue.delivery += order.total;
      } else {
        deliveryVsPickupRevenue.pickup += order.total;
      }

      order.items.forEach((item) => {
        const current = itemMap.get(item.name) ?? { name: item.name, qty: 0, revenue: 0 };
        current.qty += item.quantity;
        current.revenue += item.totalPrice;
        itemMap.set(item.name, current);
      });
    });

    const peakHour = hourlyCounts.reduce(
      (bestHour, count, hour) => (count > hourlyCounts[bestHour] ? hour : bestHour),
      0,
    );
    const outlet = outletId ? StorageService.getMergedOutlets().find((item) => item.id === outletId) : null;

    return {
      month: monthKey,
      monthLabel: monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      outletId,
      outletName: outlet?.name ?? 'All Outlets',
      totalRevenue,
      totalOrders: orders.length,
      avgOrderValue: orders.length ? totalRevenue / orders.length : 0,
      topItems: [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 10),
      peakHour,
      orderTypeSplit,
      deliveryVsPickupRevenue,
    };
  },
};
