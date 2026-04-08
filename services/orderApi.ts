import { OrderItem, OrderType, OutletConfig } from '../types';

const API_BASE_URL = (import.meta.env.VITE_ORDER_API_BASE_URL ?? '').trim();

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
  if (!API_BASE_URL) {
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
