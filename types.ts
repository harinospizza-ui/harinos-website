
export enum Category {
  PIZZA = 'Pizza',
  MOMOS_FRIES = 'Momos & Fries',
  BURGERS = 'Burgers',
  SIDES = 'Side-Orders',
  BEVERAGES = 'Beverages'
}

export type CategoryFilter = Category | 'All';

export interface SizeOption {
  label: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  popular?: boolean;
  spicy?: boolean;
  vegetarian: true;
  available: boolean;
  sizes?: SizeOption[];
}

export interface OfferCard {
  id: string;
  enabled: boolean;
  image: string;
  offerTitle: string;
  displayText: string;
  offerPercentage?: number;
  condition: string;
  additionalItem?: string;
  additionalItemImage?: string;
  notifyCustomers?: boolean;
}

export interface OutletConfig {
  id: string;
  enabled: boolean;
  name: string;
  address?: string;
  phone: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  freeDeliveryRadiusKm: number;
  freeDeliveryMinimumOrder: number;
  minimumOrderIncrementPerKm: number;
  deliveryChargePerKm: number;
}

export interface CustomerLocation {
  latitude: number;
  longitude: number;
  mapUrl: string;
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedSize?: string;
  basePrice: number;
  isOfferBonus?: boolean;
  sourceOfferId?: string;
}

export interface PricedCartItem extends CartItem {
  discountedPrice: number;
  totalPrice: number;
  appliedOfferId?: string;
  appliedOfferTitle?: string;
}

export interface OrderItem extends PricedCartItem {}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  date: string;
  orderType: OrderType;
  deliveryFee?: number;
  outletId?: string;
  outletName?: string;
  outletPhone?: string;
  outletAddress?: string;
  customerLocationUrl?: string;
  distanceKm?: number | null;
  customerPhone?: string;
  customerLatitude?: number;
  customerLongitude?: number;
  customerAddress?: string;
  receivedAt?: string;
  status?: OrderStatus;
  statusHistory?: StatusEvent[];
}

export type OrderType = 'takeaway' | 'delivery' | 'dinein';

export type OrderStatus =
  | 'new'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'done'
  | 'cancelled';

export interface StatusEvent {
  status: OrderStatus;
  timestamp: string;
  changedBy: string;
}

export type AdminRole = 'admin' | 'manager' | 'staff';

export interface AdminSession {
  role: AdminRole;
  username: string;
  outletId: string | null;
  loginTime: string;
  lastActivityTime: string;
}

export interface MonthlySalesReport {
  month: string;
  monthLabel: string;
  outletId: string | null;
  outletName: string;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  topItems: Array<{ name: string; qty: number; revenue: number }>;
  peakHour: number;
  orderTypeSplit: {
    delivery: number;
    takeaway: number;
    dinein: number;
  };
  deliveryVsPickupRevenue: {
    delivery: number;
    pickup: number;
  };
}
