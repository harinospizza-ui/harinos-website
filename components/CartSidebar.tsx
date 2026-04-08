import React from 'react';
import { CustomerLocation, Order, OrderType, OutletConfig, PricedCartItem } from '../types';
import { useSwipeDismiss } from '../hooks/useSwipeDismiss';
import { getCartItemId } from '../offerUtils';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: PricedCartItem[];
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemove: (cartItemId: string) => void;
  total: number;
  onCheckout: () => void;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  deliveryFee: number;
  nearestOutlet: OutletConfig | null;
  outletDistanceKm: number | null;
  isResolvingOutletMatch: boolean;
  customerLocation: CustomerLocation | null;
  onDetectLocation: () => Promise<CustomerLocation | null>;
  pastOrders?: Order[];
  onReorder?: (order: Order) => void;
}

const CartSidebar: React.FC<CartSidebarProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemove,
  total,
  onCheckout,
  orderType,
  setOrderType,
  deliveryFee,
  nearestOutlet,
  outletDistanceKm,
  isResolvingOutletMatch,
  customerLocation,
  onDetectLocation,
  pastOrders = [],
  onReorder,
}) => {
  const isDeliveryImpossible = orderType === 'delivery' && deliveryFee === -1;
  const effectiveDeliveryFee = orderType === 'delivery' && deliveryFee > 0 ? deliveryFee : 0;
  const finalTotal = total + effectiveDeliveryFee;
  const includedGst = total - total / 1.05;
  const lastOrder = pastOrders.length > 0 ? pastOrders[0] : null;
  const swipeDismiss = useSwipeDismiss({ direction: 'right', onDismiss: onClose });

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md transition-opacity duration-500 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed top-0 right-0 z-[80] flex h-[100dvh] w-full max-w-full flex-col bg-white shadow-[0_0_100px_rgba(0,0,0,0.3)] transition-transform duration-500 md:max-w-md ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={isOpen ? swipeDismiss.style : undefined}
        {...(isOpen ? swipeDismiss.bind : {})}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-4 pb-4 pt-[max(env(safe-area-inset-top),14px)] sm:px-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 text-[9px] font-black uppercase tracking-[0.28em] text-red-600">
                  Your Basket
                </div>
                <h2 className="text-2xl font-display font-bold text-slate-900 sm:text-3xl">Checkout</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-red-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            <div className="bg-slate-50/60 p-4 sm:p-5">
              <div className="mb-5 grid grid-cols-3 gap-2">
                <button
                  onClick={() => setOrderType('takeaway')}
                  className={`group relative overflow-hidden rounded-2xl border-2 p-3 transition-all duration-300 ${
                    orderType === 'takeaway'
                      ? 'scale-[1.02] border-red-600 bg-gradient-to-br from-red-50 to-orange-50 shadow-lg shadow-red-100'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-red-200'
                  }`}
                >
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                    <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 8h12l1 11H5L6 8zm3 0V6a3 3 0 116 0v2" />
                    </svg>
                  </div>
                  <div className="text-[10px] font-black tracking-widest">TAKEAWAY</div>
                  <div className="text-[9px] text-slate-400">Fastest</div>
                </button>

                <button
                  onClick={() => setOrderType('delivery')}
                  className={`group relative overflow-hidden rounded-2xl border-2 p-3 transition-all duration-300 ${
                    orderType === 'delivery'
                      ? 'scale-[1.02] border-red-600 bg-gradient-to-br from-red-50 to-orange-50 shadow-lg shadow-red-100'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-red-200'
                  }`}
                >
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                    <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 15h2l2-5h8l2 5h1a2 2 0 110 4 2 2 0 01-2-2H9a2 2 0 11-4 0H3m4-5h6m2 0h2" />
                    </svg>
                  </div>
                  <div className="text-[10px] font-black tracking-widest">DELIVERY</div>
                  <div className="text-[9px] text-slate-400">Home</div>
                </button>

                <button
                  onClick={() => setOrderType('dinein')}
                  className={`group relative overflow-hidden rounded-2xl border-2 p-3 transition-all duration-300 ${
                    orderType === 'dinein'
                      ? 'scale-[1.02] border-red-600 bg-gradient-to-br from-red-50 to-orange-50 shadow-lg shadow-red-100'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-red-200'
                  }`}
                >
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                    <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M7 4v8m10-8v8M5 20h14M7 12h10M9 12v8m6-8v8" />
                    </svg>
                  </div>
                  <div className="text-[10px] font-black tracking-widest">DINE-IN</div>
                  <div className="text-[9px] text-slate-400">At outlet</div>
                </button>
              </div>

              <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                      Location Routing
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-900">
                      {nearestOutlet ? nearestOutlet.name : 'Nearest outlet not resolved yet'}
                    </div>
                  </div>
                  <button
                    onClick={onDetectLocation}
                    className="text-[8px] font-black uppercase tracking-widest text-red-600 underline"
                  >
                    {customerLocation ? 'Refresh' : 'Enable'}
                  </button>
                </div>

                {nearestOutlet ? (
                  <div className="space-y-1.5 text-[10px] text-slate-600">
                    {nearestOutlet.address ? (
                      <p className="font-semibold text-slate-800">{nearestOutlet.address}</p>
                    ) : null}
                    <p>Phone: {nearestOutlet.phone}</p>
                    <p>
                      Road distance:{' '}
                      {isResolvingOutletMatch
                        ? 'Checking route...'
                        : outletDistanceKm !== null
                          ? `${outletDistanceKm.toFixed(1)} km`
                          : 'Not available'}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      Customer location is mandatory before order placement
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500">
                    Allow location access so the app can automatically route this order to the closest outlet phone number.
                  </p>
                )}
              </div>

              {orderType === 'delivery' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-blue-700">
                      Delivery Conditions
                    </div>
                    <div className="space-y-1.5 text-[10px] font-medium text-blue-800/80">
                      <p>
                        Free delivery for orders Rs {nearestOutlet?.freeDeliveryMinimumOrder ?? 150}+ within{' '}
                        {nearestOutlet?.freeDeliveryRadiusKm ?? 3} km by road.
                      </p>
                      <p>
                        Orders below minimum are charged Rs {nearestOutlet?.deliveryChargePerKm ?? 15} per road km
                        with a minimum fee of Rs {nearestOutlet?.minimumDeliveryFee ?? 15}.
                      </p>
                      <p>Maximum delivery radius is {nearestOutlet?.deliveryRadiusKm ?? 7} road km.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5 p-4 pb-6 sm:p-6">
              {items.length === 0 ? (
                <div className="flex min-h-[40vh] flex-col items-center justify-center space-y-10 py-10 text-center">
                  <div className="opacity-40">
                    <div className="mb-5 text-4xl font-display font-bold text-slate-500">Cart</div>
                    <h3 className="font-display text-lg font-bold text-slate-900">Empty Bag</h3>
                  </div>

                  {lastOrder && onReorder && (
                    <div className="w-full">
                      <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5 text-left">
                        <div className="mb-3 text-[9px] font-black uppercase tracking-widest text-red-600">
                          One-Tap Re-order
                        </div>
                        <h4 className="mb-4 text-sm font-bold text-slate-900">Repeat your last masterpiece?</h4>
                        <div className="mb-5 space-y-2">
                          {lastOrder.items.slice(0, 2).map((lineItem, index) => (
                            <div key={index} className="flex justify-between text-[10px] font-medium text-slate-500">
                              <span>{lineItem.quantity}x {lineItem.name}</span>
                              <span>Rs {lineItem.totalPrice}</span>
                            </div>
                          ))}
                          {lastOrder.items.length > 2 && (
                            <div className="text-[9px] font-bold uppercase text-slate-400">
                              + {lastOrder.items.length - 2} more items
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => onReorder(lastOrder)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-3 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm transition-all active:scale-95"
                        >
                          Repeat Last Order (Rs {lastOrder.total.toFixed(0)})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                items.map((item, index) => {
                  const cartItemId = getCartItemId(item);
                  const isBonusItem = !!item.isOfferBonus;

                  return (
                    <div key={cartItemId} className="flex space-x-3" style={{ animationDelay: `${index * 40}ms` }}>
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-[13px] font-bold leading-tight text-slate-900">{item.name}</h4>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {item.selectedSize && (
                                <span className="inline-block rounded-md bg-red-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-red-600">
                                  {item.selectedSize}
                                </span>
                              )}
                              {isBonusItem && (
                                <span className="inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-700">
                                  Auto Added
                                </span>
                              )}
                              {item.appliedOfferTitle && (
                                <span className="inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-700">
                                  {item.appliedOfferTitle}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isBonusItem && (
                            <button onClick={() => onRemove(cartItemId)} className="p-1 text-slate-300 transition-colors hover:text-red-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          {isBonusItem ? (
                            <>
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">
                                Included with unlocked offer
                              </span>
                              <span className="font-display text-sm font-bold text-emerald-700">Free</span>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center space-x-2 rounded-lg bg-slate-50 p-1">
                                <button onClick={() => onUpdateQuantity(cartItemId, -1)} className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-xs font-bold shadow-sm">
                                  -
                                </button>
                                <span className="w-4 text-center text-[10px] font-black">{item.quantity}</span>
                                <button onClick={() => onUpdateQuantity(cartItemId, 1)} className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-xs font-bold shadow-sm">
                                  +
                                </button>
                              </div>
                              <span className="font-display text-sm font-bold text-slate-900">Rs {item.totalPrice}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="pt-2 text-center">
                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-300">
                  Only your latest 3 orders are kept for repeat order
                </span>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="shrink-0 bg-slate-900 p-4 text-white shadow-2xl sm:rounded-t-[2.5rem] sm:p-6">
              <div className="mb-5 space-y-2 font-mono text-[10px] uppercase tracking-widest opacity-80">
                <div className="flex justify-between"><span>Subtotal</span><span>Rs {total.toFixed(2)}</span></div>
                {orderType === 'delivery' && (
                  <div className="flex justify-between gap-3">
                    <span>Delivery {total < 150 ? '(Under Min Order)' : ''}</span>
                    <span className={deliveryFee === -1 ? 'font-bold text-red-500' : ''}>
                      {deliveryFee === -1 ? 'NOT SERVICEABLE' : `Rs ${effectiveDeliveryFee.toFixed(2)}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between"><span>GST Included</span><span>Rs {includedGst.toFixed(2)}</span></div>
                <div className="my-2 h-px border-t border-dashed border-white/20" />
                <div className="flex justify-between text-xl font-display font-bold text-white">
                  <span>Grand Total</span>
                  <span className="text-red-500">Rs {finalTotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={onCheckout}
                disabled={isDeliveryImpossible}
                className={`flex w-full items-center justify-center space-x-3 rounded-2xl py-4 text-[10px] font-bold uppercase tracking-[0.28em] transition-all ${
                  isDeliveryImpossible
                    ? 'cursor-not-allowed border border-white/5 bg-slate-800 text-white/40'
                    : 'bg-red-600 text-white active:scale-95'
                }`}
              >
                <span>{isDeliveryImpossible ? 'Beyond Service Area' : 'Pay via UPI'}</span>
                {!isDeliveryImpossible && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default CartSidebar;
