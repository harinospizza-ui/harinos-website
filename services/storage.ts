
import { Order } from '../types';
import { safeStorage } from './browserSupport';

const KEYS = {
  ORDERS: 'harinos_past_orders',
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
};
