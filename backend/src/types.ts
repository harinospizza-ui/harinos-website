export type OrderType = 'takeaway' | 'delivery' | 'dinein';

export interface OrderItemPayload {
  id: string;
  name: string;
  quantity: number;
  selectedSize?: string;
  basePrice: number;
  discountedPrice: number;
  totalPrice: number;
  isOfferBonus?: boolean;
  appliedOfferId?: string;
  appliedOfferTitle?: string;
}

export interface OutletPayload {
  id: string;
  name: string;
  address: string;
  phone: string;
}

export interface CreateOrderRequest {
  orderId: string;
  items: OrderItemPayload[];
  total: number;
  orderType: OrderType;
  deliveryFee: number;
  location: string;
  createdAt: string;
  distanceKm: number | null;
  outlet: OutletPayload;
}
