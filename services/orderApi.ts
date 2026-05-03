import { Order, OrderItem, OrderStatus, OrderType, OutletConfig } from '../types';

const API_BASE_URL = (import.meta.env.VITE_ORDER_API_BASE_URL ?? '/api').trim();

export interface RemoteOrderPayload {
  orderId: string;
  items: OrderItem[];
  total: number;
  orderType: OrderType;
  deliveryFee: number;
  location: string;
  createdAt: string;
  distanceKm: number | null;
  outlet: Pick<OutletConfig, 'id' | 'name' | 'phone'> & { address?: string };
}

export const saveOrderToServer = async (orderData: RemoteOrderPayload): Promise<void> => {
  if (!API_BASE_URL || API_BASE_URL === '/api') {
    return;
  }

  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    throw new Error(`Remote order sync failed with status ${response.status}.`);
  }
};

export const saveOrderToSharedStore = async (order: Order): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    throw new Error(`Shared order sync failed with status ${response.status}.`);
  }
};

export const getSharedOrders = async (outletId?: string | null): Promise<Order[]> => {
  const query = outletId ? `?outletId=${encodeURIComponent(outletId)}` : '';
  const response = await fetch(`${API_BASE_URL}/orders${query}`, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Shared order fetch failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { orders?: Order[] };
  return data.orders ?? [];
};

export const updateSharedOrderStatus = async (
  outletId: string,
  orderId: string,
  status: OrderStatus,
  changedBy: string,
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ outletId, status, changedBy }),
  });

  if (!response.ok) {
    throw new Error(`Shared status update failed with status ${response.status}.`);
  }
};

export const deleteSharedOrder = async (orderId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Shared order delete failed with status ${response.status}.`);
  }
};
