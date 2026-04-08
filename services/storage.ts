
import { Order } from '../types';

const KEYS = {
  ORDERS: 'harinos_past_orders',
};

export const StorageService = {
  getPastOrders: (): Order[] => {
    const saved = localStorage.getItem(KEYS.ORDERS);
    try {
      return saved ? JSON.parse(saved).slice(0, 3) : [];
    } catch {
      return [];
    }
  },
  saveOrder: (order: Order) => {
    const orders = StorageService.getPastOrders();
    const updatedOrders = [order, ...orders].slice(0, 3);
    localStorage.setItem(KEYS.ORDERS, JSON.stringify(updatedOrders));
  },
};
