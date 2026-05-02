import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartItem,
  Category,
  CategoryFilter,
  CustomerLocation,
  MenuItem,
  OfferCard,
  Order,
  OrderItem,
  OrderType,
  OutletConfig,
} from './types';
import { MENU_ITEMS, OFFER_CARDS, OUTLET_LOCATIONS } from './constants';
import { StorageService } from './services/storage';
import { NotificationService } from './services/notification';
import { saveOrderToServer } from './services/orderApi';
import { copyTextToClipboard, getNotificationPermission } from './services/browserSupport';
import {
  buildPricedCart,
  getAutomaticOfferBonusItems,
  getCartItemId,
  getOfferActionTarget,
  getItemBasePrice,
  normalizeStoredCartItem,
} from './offerUtils';
import {
  OutletMatch,
  buildCustomerMapUrl,
  findNearestOutletByRoadDistance,
  sanitizePhoneNumber,
} from './outletUtils';
import { getDeliveryPricingSummary } from './deliveryPricing';
import Header from './components/Header';
import Hero from './components/Hero';
import OfferCarousel from './components/OfferCarousel';
import MenuSection from './components/MenuSection';
import CartSidebar from './components/CartSidebar';
import PastOrders from './components/PastOrders';
import PaymentModal from './components/PaymentModal';
import InstallPopup from './components/InstallPopup';
import ServiceModeModal from './components/ServiceModeModal';
import { useSwipeDismiss } from './hooks/useSwipeDismiss';

const DISPLAY_OFFERS = OFFER_CARDS.slice(0, 3);
const APP_HISTORY_NAMESPACE = 'harinos-ui';

type AppScreen = 'menu' | 'orders' | 'category' | 'cart' | 'payment' | 'success';

interface ResolvedOrderContext {
  customerLocation: CustomerLocation | null;
  outlet: OutletConfig;
  distanceKm: number | null;
}

const App: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [isServiceModeModalOpen, setIsServiceModeModalOpen] = useState(true);
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [view, setView] = useState<'menu' | 'orders'>('menu');
  const [pastOrders, setPastOrders] = useState<Order[]>(StorageService.getPastOrders());
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [nearestOutletMatch, setNearestOutletMatch] = useState<OutletMatch | null>(null);
  const [isResolvingOutletMatch, setIsResolvingOutletMatch] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const applyAppScreen = useCallback((screen: AppScreen) => {
    setView(screen === 'orders' ? 'orders' : 'menu');
    setIsCategoryModalOpen(screen === 'category');
    setIsCartOpen(screen === 'cart');
    setIsPaymentOpen(screen === 'payment');
    setShowOrderSuccess(screen === 'success');
  }, []);
  const pushAppScreen = useCallback((screen: AppScreen) => {
    const currentState = window.history.state as { app?: string; screen?: AppScreen } | null;

    if (currentState?.app === APP_HISTORY_NAMESPACE && currentState.screen === screen) {
      return;
    }

    window.history.pushState({ app: APP_HISTORY_NAMESPACE, screen }, '', window.location.href);
  }, []);
  const replaceAppScreen = useCallback((screen: AppScreen) => {
    window.history.replaceState({ app: APP_HISTORY_NAMESPACE, screen }, '', window.location.href);
  }, []);
  const handleAppBack = useCallback((fallback?: () => void) => {
    const currentState = window.history.state as { app?: string; screen?: AppScreen } | null;

    if (currentState?.app === APP_HISTORY_NAMESPACE && currentState.screen && currentState.screen !== 'menu') {
      window.history.back();
      return;
    }

    fallback?.();
  }, []);
  const categorySwipeDismiss = useSwipeDismiss({
    direction: 'down',
    onDismiss: () => handleAppBack(() => setIsCategoryModalOpen(false)),
  });
  const successSwipeDismiss = useSwipeDismiss({
    direction: 'down',
    onDismiss: () => {
      applyAppScreen('menu');
      replaceAppScreen('menu');
    },
  });
  const ordersSwipeDismiss = useSwipeDismiss({
    direction: 'right',
    onDismiss: () => handleAppBack(() => setView('menu')),
  });
  const activeOfferCards = useMemo(
    () => DISPLAY_OFFERS.filter((offer) => offer.enabled),
    [],
  );
  const activeOutlets = useMemo(
    () => OUTLET_LOCATIONS.filter((outlet) => outlet.enabled),
    [],
  );
  const nearestOutlet = nearestOutletMatch?.outlet ?? null;
  const outletDistanceKm = nearestOutletMatch?.distanceKm ?? null;
  const selectedOutlet = useMemo(
    () => nearestOutlet ?? activeOutlets[0] ?? null,
    [activeOutlets, nearestOutlet],
  );

  useEffect(() => {
    const currentState = window.history.state as { app?: string; screen?: AppScreen } | null;

    if (currentState?.app !== APP_HISTORY_NAMESPACE) {
      replaceAppScreen('menu');
    }

    const handlePopState = (event: PopStateEvent) => {
      const nextState = event.state as { app?: string; screen?: AppScreen } | null;
      const nextScreen = nextState?.app === APP_HISTORY_NAMESPACE ? nextState.screen ?? 'menu' : 'menu';
      applyAppScreen(nextScreen);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [applyAppScreen, replaceAppScreen]);

  useEffect(() => {
    const checkStoreStatus = () => {
      const now = new Date();
      const currentTimeInMins = now.getHours() * 60 + now.getMinutes();
      const openingTime = 11 * 60;
      const closingTime = 20 * 60;

      if (currentTimeInMins < openingTime || currentTimeInMins >= closingTime) {
        setIsStoreOpen(false);
        setStatusMessage('Store is currently closed. Open: 11:00 AM - 08:00 PM.');
        return;
      }

      setIsStoreOpen(true);
      setStatusMessage('Orders are being prepared fresh.');
    };

    checkStoreStatus();
    const interval = window.setInterval(checkStoreStatus, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    NotificationService.notifyOfferReleases(activeOfferCards);
  }, [activeOfferCards]);

  const showNotification = useCallback((message: string) => {
    setNotification(message);
    window.setTimeout(() => setNotification(null), 3000);
  }, []);

  const refreshNearestOutletMatch = useCallback(
    async (location: CustomerLocation): Promise<OutletMatch | null> => {
      if (!activeOutlets.length) {
        setNearestOutletMatch(null);
        return null;
      }

      setIsResolvingOutletMatch(true);

      try {
        const outletMatch = await findNearestOutletByRoadDistance(location, activeOutlets);
        setNearestOutletMatch(outletMatch);
        return outletMatch;
      } catch (error) {
        console.error('Road distance routing failed:', error);
        setNearestOutletMatch(null);
        throw error;
      } finally {
        setIsResolvingOutletMatch(false);
      }
    },
    [activeOutlets],
  );

  const scrollMenuIntoView = useCallback(() => {
    window.setTimeout(() => {
      menuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, []);

  const openOrdersView = useCallback(() => {
    setView('orders');
    pushAppScreen('orders');
  }, [pushAppScreen]);

  const openCartView = useCallback(() => {
    setIsCartOpen(true);
    pushAppScreen('cart');
  }, [pushAppScreen]);

  const openCategoryView = useCallback(() => {
    setIsCategoryModalOpen(true);
    pushAppScreen('category');
  }, [pushAppScreen]);
  const closeCategoryView = useCallback(() => {
    handleAppBack(() => setIsCategoryModalOpen(false));
  }, [handleAppBack]);
  const closeCartView = useCallback(() => {
    handleAppBack(() => setIsCartOpen(false));
  }, [handleAppBack]);
  const closePaymentView = useCallback(() => {
    handleAppBack(() => setIsPaymentOpen(false));
  }, [handleAppBack]);
  const closeOrdersView = useCallback(() => {
    handleAppBack(() => setView('menu'));
  }, [handleAppBack]);
  const closeSuccessView = useCallback(() => {
    applyAppScreen('menu');
    replaceAppScreen('menu');
  }, [applyAppScreen, replaceAppScreen]);
  const returnToMenu = useCallback(() => {
    if (view === 'orders') {
      closeOrdersView();
      return;
    }

    applyAppScreen('menu');
    replaceAppScreen('menu');
  }, [applyAppScreen, closeOrdersView, replaceAppScreen, view]);

  const handleExploreCategory = useCallback(
    (category: CategoryFilter) => {
      setSelectedCategory(category);
      applyAppScreen('menu');
      replaceAppScreen('menu');
      scrollMenuIntoView();
    },
    [applyAppScreen, replaceAppScreen, scrollMenuIntoView],
  );

  const detectLocation = useCallback(async (
    options?: { silentFailure?: boolean },
  ): Promise<CustomerLocation | null> => {
    if (!activeOutlets.length) {
      alert('No active outlet is configured right now. Add a live outlet in constants.tsx before accepting orders.');
      return null;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser.'));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      });

      const resolvedLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        mapUrl: buildCustomerMapUrl(position.coords.latitude, position.coords.longitude),
      };

      setCustomerLocation(resolvedLocation);

      try {
        await refreshNearestOutletMatch(resolvedLocation);
      } catch (routingError) {
        console.error('Road distance routing failed:', routingError);
        showNotification('Unable to calculate road distance right now. Please try again.');
      }

      return resolvedLocation;
    } catch (error) {
      if (options?.silentFailure) {
        showNotification('Enable location so we can calculate road distance and delivery charges.');
      } else {
        alert('Location is mandatory so we can calculate delivery distance and route your order.');
      }
      return null;
    }
  }, [activeOutlets.length, refreshNearestOutletMatch, showNotification]);

  const handleOrderTypeChange = async (type: OrderType) => {
    setOrderType(type);

    if (type !== 'dinein') {
      setCart((currentCart) => {
        const filteredCart = currentCart.filter((item) => item.category !== Category.BEVERAGES);
        if (filteredCart.length !== currentCart.length) {
          showNotification('Beverages are available for dine-in only.');
        }
        return filteredCart;
      });
    }

    if (type === 'delivery' && !customerLocation) {
      await detectLocation({ silentFailure: true });
    }
  };

  const handleServiceModeSelection = async (type: OrderType) => {
    await handleOrderTypeChange(type);
    setIsServiceModeModalOpen(false);
  };

  const handleShare = async () => {
    const shareData = {
      title: "Harino's Pizza",
      text: "Check out Harino's handcrafted pizzas, burgers, and snacks at harinos.store.",
      url: 'https://harinos.store',
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Error sharing:', error);
      }
      return;
    }

    try {
      const didCopy = await copyTextToClipboard('Check out Harino\'s at https://harinos.store');
      if (didCopy) {
        showNotification('Link copied to clipboard.');
        return;
      }

      alert('Visit us at harinos.store.');
    } catch (error) {
      alert('Visit us at harinos.store.');
    }
  };

  const addToCart = useCallback(
    (item: MenuItem, selectedSize?: string) => {
      if (item.category === Category.BEVERAGES && orderType !== 'dinein') {
        showNotification('Beverages are available for dine-in only.');
        return;
      }

      if (!item.available) {
        return;
      }

      const normalizedSize = selectedSize ?? item.sizes?.[0]?.label;
      const basePrice = getItemBasePrice(item, normalizedSize);

      setCart((currentCart) => {
        const cartItemId = getCartItemId({ id: item.id, selectedSize: normalizedSize });
        const existingItem = currentCart.find((cartItem) => getCartItemId(cartItem) === cartItemId);

        if (existingItem) {
          return currentCart.map((cartItem) => {
            return getCartItemId(cartItem) === cartItemId
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem;
          });
        }

        return [
          ...currentCart,
          {
            ...item,
            quantity: 1,
            selectedSize: normalizedSize,
            basePrice,
          },
        ];
      });

      showNotification(`${item.name} added to basket.`);
    },
    [orderType, showNotification],
  );

  const handleOfferAction = useCallback(
    (offer: OfferCard) => {
      const target = getOfferActionTarget(offer);
      setSelectedCategory(target.category);
      applyAppScreen('menu');
      replaceAppScreen('menu');
      if (target.item) {
        showNotification(`${target.item.name} is featured in this offer.`);
      }
      scrollMenuIntoView();
    },
    [applyAppScreen, replaceAppScreen, scrollMenuIntoView, showNotification],
  );

  const handleNotificationsEnabled = useCallback(() => {
    NotificationService.notifyOfferReleases(activeOfferCards, { force: true });
  }, [activeOfferCards]);

  const resolveOrderContext = useCallback(async (): Promise<ResolvedOrderContext | null> => {
    if (!activeOutlets.length) {
      alert('No active outlet is configured right now. Add a live outlet in constants.tsx before accepting orders.');
      return null;
    }

    if (orderType !== 'delivery') {
      if (!selectedOutlet) {
        alert('No active outlet is configured right now. Add a live outlet in constants.tsx before accepting orders.');
        return null;
      }

      return {
        customerLocation,
        outlet: selectedOutlet,
        distanceKm: null,
      };
    }

    const resolvedLocation = customerLocation ?? (await detectLocation());
    if (!resolvedLocation) {
      return null;
    }

    let outletMatch: OutletMatch | null = null;

    try {
      outletMatch = await refreshNearestOutletMatch(resolvedLocation);
    } catch (error) {
      alert('We could not calculate the road distance to your nearest outlet. Please try again.');
      return null;
    }

    if (!outletMatch) {
      alert('We could not match your location to an active outlet.');
      return null;
    }

    return {
      customerLocation: resolvedLocation,
      outlet: outletMatch.outlet,
      distanceKm: outletMatch.distanceKm,
    };
  }, [
    activeOutlets,
    customerLocation,
    detectLocation,
    orderType,
    refreshNearestOutletMatch,
    selectedOutlet,
  ]);

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (getCartItemId(item) !== cartItemId) {
          return item;
        }

        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }),
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((currentCart) =>
      currentCart.filter((item) => getCartItemId(item) !== cartItemId),
    );
  };

  const handleReorder = useCallback((order: Order) => {
    const manualOrderItems = order.items.filter((item) => !item.isOfferBonus);

    if (!manualOrderItems.length) {
      alert('This saved order only contains promotional bonus items.');
      return;
    }

    const reorderItems = manualOrderItems
      .map((item) => {
        const freshItem = MENU_ITEMS.find((menuItem) => menuItem.id === item.id);
        const nextItem = freshItem ?? item;
        return normalizeStoredCartItem({
          ...nextItem,
          quantity: item.quantity,
          selectedSize: item.selectedSize,
          basePrice: freshItem ? getItemBasePrice(freshItem, item.selectedSize) : item.basePrice,
        });
      })
      .filter((item) => item.available);

    if (!reorderItems.length) {
      alert('Items from the previous order are currently unavailable.');
      return;
    }

    setCart(reorderItems);
    setView('menu');
    setIsCartOpen(true);
    pushAppScreen('cart');
    showNotification('Last order restored to basket.');
  }, [pushAppScreen, showNotification]);

  const filteredItems = useMemo(
    () =>
      selectedCategory === 'All'
        ? MENU_ITEMS
        : MENU_ITEMS.filter((item) => item.category === selectedCategory),
    [selectedCategory],
  );

  const baseSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.basePrice * item.quantity, 0),
    [cart],
  );

  const bonusCart = useMemo(
    () =>
      getAutomaticOfferBonusItems(cart, activeOfferCards).filter(
        (item) => orderType === 'dinein' || item.category !== Category.BEVERAGES,
      ),
    [activeOfferCards, cart, orderType],
  );

  const cartWithBonuses = useMemo(() => [...cart, ...bonusCart], [bonusCart, cart]);

  const pricedCart = useMemo(
    () => buildPricedCart(cartWithBonuses, activeOfferCards),
    [activeOfferCards, cartWithBonuses],
  );

  const subtotal = useMemo(
    () => pricedCart.reduce((sum, item) => sum + item.totalPrice, 0),
    [pricedCart],
  );

  const deliveryPricing = useMemo(
    () => getDeliveryPricingSummary(nearestOutlet, outletDistanceKm, subtotal),
    [nearestOutlet, outletDistanceKm, subtotal],
  );

  const deliveryFee = useMemo(() => {
    if (orderType !== 'delivery') {
      return 0;
    }

    return deliveryPricing.fee;
  }, [deliveryPricing.fee, orderType]);

  const finalDeliveryFee = orderType === 'delivery' && deliveryFee > 0 ? deliveryFee : 0;
  const currentTotal = subtotal + finalDeliveryFee;
  const includedGst = subtotal - subtotal / 1.05;
  const totalCartItems = pricedCart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckoutInitiate = async () => {
    if (!isStoreOpen) {
      alert(statusMessage || 'Store is closed right now.');
      return;
    }

    const checkoutContext = await resolveOrderContext();
    if (!checkoutContext) {
      return;
    }

    if (getNotificationPermission() === 'default') {
      await NotificationService.requestPermission();
    }

    if (orderType === 'delivery') {
      if (checkoutContext.distanceKm === null) {
        alert('Location is required to calculate the delivery route.');
        return;
      }

      if (checkoutContext.distanceKm > checkoutContext.outlet.deliveryRadiusKm) {
        alert(
          `Sorry, ${checkoutContext.outlet.name} currently serves only up to ${checkoutContext.outlet.deliveryRadiusKm} km by road.`,
        );
        return;
      }
    }

    setIsCartOpen(false);
    setIsPaymentOpen(true);
    pushAppScreen('payment');
  };

  const handlePaymentComplete = async () => {
    const checkoutContext = await resolveOrderContext();
    if (!checkoutContext) {
      showNotification(
        orderType === 'delivery'
          ? 'Location is still required to place this order.'
          : 'We could not match this order to an active outlet.',
      );
      return;
    }

    setIsPaymentOpen(false);

    const { customerLocation: resolvedLocation, outlet, distanceKm } = checkoutContext;
    const locationString = orderType === 'delivery' && resolvedLocation ? resolvedLocation.mapUrl : 'Not shared';
    const orderId = `HRN-${Date.now().toString().slice(-4)}`;
    const orderItems: OrderItem[] = pricedCart.map((item) => ({ ...item }));
    const newOrder: Order = {
      id: orderId,
      items: orderItems,
      total: currentTotal,
      date: new Date().toLocaleString(),
      orderType,
      deliveryFee: finalDeliveryFee,
      outletId: outlet.id,
      outletName: outlet.name,
      outletPhone: outlet.phone,
      outletAddress: outlet.address,
      customerLocationUrl: locationString,
      distanceKm,
    };

    try {
      await saveOrderToServer({
        orderId,
        items: orderItems,
        total: currentTotal,
        orderType,
        deliveryFee: finalDeliveryFee,
        location: locationString,
        createdAt: new Date().toISOString(),
        distanceKm,
        outlet: {
          id: outlet.id,
          name: outlet.name,
          address: outlet.address ?? '',
          phone: outlet.phone,
        },
      });
    } catch (error) {
      console.error('Remote order sync failed:', error);
    }

    StorageService.saveOrder(newOrder);
    setPastOrders((currentOrders) => [newOrder, ...currentOrders].slice(0, 3));
    NotificationService.simulateOrderStatus(orderId, orderType === 'delivery' ? 'delivery' : 'takeaway');

    const itemsText = orderItems
      .map((item) => {
        const sizeText = item.selectedSize ? ` [${item.selectedSize}]` : '';
        return `${item.quantity}x ${item.name}${sizeText} - Rs ${item.totalPrice}`;
      })
      .join('\n');

    const outletAddressLine = outlet.address ? `OUTLET ADDRESS: ${outlet.address}\n` : '';
    const roadDistanceLine =
      orderType === 'delivery' && distanceKm !== null ? `ROAD DISTANCE: ${distanceKm.toFixed(1)} km\n` : '';
    const locationSection =
      orderType === 'delivery'
        ? `*LOCATION:*\n${locationString}\n--------------------------\n`
        : '';
    const whatsappMessage = `
*HARINO'S ORDER - ${orderId}*
--------------------------
TYPE: ${orderType.toUpperCase()}
PAYMENT: COMPLETED
--------------------------
OUTLET: ${outlet.name}
OUTLET PHONE: ${outlet.phone}
${outletAddressLine}${roadDistanceLine}--------------------------
*ITEMS:*
${itemsText}
--------------------------
SUBTOTAL: Rs ${subtotal.toFixed(2)}
DELIVERY: Rs ${finalDeliveryFee.toFixed(2)}
GST (5% INCL): Rs ${includedGst.toFixed(2)}
*TOTAL: Rs ${currentTotal.toFixed(2)}*
--------------------------
${locationSection}*BECAUSE HARI KNOWS*
    `.trim();

    window.open(`https://wa.me/${sanitizePhoneNumber(outlet.phone)}?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
    setShowOrderSuccess(true);
    replaceAppScreen('success');
    setCart([]);
  };

  const categoryButtons: CategoryFilter[] = ['All', ...Object.values(Category)];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fff7f0] text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.28),transparent_26%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_24%),linear-gradient(180deg,#120507_0%,#2a0d11_18%,#fffaf4_48%,#fff1e4_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-[24rem] h-72 w-72 rounded-full bg-red-200/35 blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] top-[36rem] h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-[70rem] h-64 w-64 rounded-full bg-orange-100/60 blur-3xl" />

      <ServiceModeModal
        isOpen={isServiceModeModalOpen}
        selectedType={orderType}
        onSelect={handleServiceModeSelection}
        storeStatus={statusMessage || 'Choose a service mode to continue.'}
      />

      <Header
        cartCount={totalCartItems}
        onCartClick={openCartView}
        onViewOrders={openOrdersView}
        onViewMenu={returnToMenu}
        activeView={view}
        onShare={handleShare}
        onNotificationsEnabled={handleNotificationsEnabled}
      />
      <InstallPopup
        blocked={
          isCartOpen ||
          isPaymentOpen ||
          showOrderSuccess ||
          isCategoryModalOpen ||
          isServiceModeModalOpen ||
          view === 'orders'
        }
      />

      <main className="relative z-10 pt-20">
        {view === 'menu' ? (
          <>
            <Hero onShare={handleShare} onExploreMenu={openCategoryView} />
            <OfferCarousel offers={activeOfferCards} onAction={handleOfferAction} />

            <div ref={menuRef} className="max-w-7xl mx-auto px-4 mt-8 md:mt-12 pb-24 scroll-mt-24">
              <div className="relative mb-8 md:mb-12">
                <div className="flex space-x-2 overflow-x-auto pb-4 pt-2 px-1 hide-scrollbar snap-x snap-mandatory scroll-smooth">
                  {categoryButtons.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleExploreCategory(category)}
                      className={`snap-start whitespace-nowrap px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border shadow-sm flex-shrink-0 ${
                        selectedCategory === category
                          ? 'bg-red-600 border-red-600 text-white scale-105 shadow-red-200'
                          : 'bg-white border-slate-100 text-slate-500 hover:text-red-600'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-slate-50/30 to-transparent pointer-events-none md:hidden" />
              </div>

              {!isStoreOpen && (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] text-center mb-10">
                  <span className="text-amber-700 font-bold text-sm">Outlet Closed - {statusMessage}</span>
                </div>
              )}

              <MenuSection
                items={filteredItems}
                onAddToCart={addToCart}
                offers={activeOfferCards}
                cartSubtotal={baseSubtotal}
              />
            </div>
          </>
        ) : (
          <div style={ordersSwipeDismiss.style} {...ordersSwipeDismiss.bind}>
            <PastOrders orders={pastOrders} onReorder={handleReorder} />
          </div>
        )}
      </main>

      <footer className="relative z-10 overflow-hidden border-t border-white/10 bg-[linear-gradient(135deg,#17070a,#2d0f14_55%,#120507)] py-20 pb-32 text-white md:pb-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.22),transparent_65%)]" />
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="font-display text-5xl md:text-6xl mb-4 text-red-500">Harino&apos;s</h2>
          <div className="text-white font-bold tracking-[0.6em] uppercase text-[9px] md:text-[11px] mb-10 opacity-40">
            Because Hari Knows
          </div>
          <div className="text-white/20 text-[8px] uppercase tracking-widest mt-8">harinos.store</div>
        </div>
      </footer>

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"
            onClick={closeCategoryView}
          />
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[3rem]"
            style={categorySwipeDismiss.style}
            {...categorySwipeDismiss.bind}
          >
            <div className="bg-slate-900 p-5 text-center sm:p-8">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/25 sm:hidden" />
              <h3 className="mb-2 text-2xl font-display text-white sm:text-3xl">Explore Our Kitchen</h3>
              <p className="text-white/50 text-[10px] uppercase tracking-[0.24em] font-black">
                Choose a category and jump to the menu
              </p>
              <div className="mt-3 text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
                Swipe down to close
              </div>
            </div>
            <div className="p-5 sm:p-8 md:p-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryButtons.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleExploreCategory(category)}
                    className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-red-200 hover:bg-red-50 transition-all group"
                  >
                    <div className="text-left">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-red-500 transition-colors">
                        Category
                      </div>
                      <div className="text-xl font-display font-bold text-slate-900">{category}</div>
                    </div>
                    <svg
                      className="w-5 h-5 text-slate-300 group-hover:text-red-500 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {pricedCart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-4 right-20 z-50 md:hidden">
          <button
            onClick={openCartView}
            className="w-full bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-red-600 px-2.5 py-1.5 rounded-lg text-[10px] font-black shadow-sm">{totalCartItems}</div>
              <span className="text-[10px] font-black uppercase tracking-widest">View Basket</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-display font-bold text-red-500">Rs {subtotal.toFixed(0)}</span>
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      )}

      <CartSidebar
        isOpen={isCartOpen}
        onClose={closeCartView}
        items={pricedCart}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        total={subtotal}
        onCheckout={handleCheckoutInitiate}
        orderType={orderType}
        setOrderType={handleOrderTypeChange}
        deliveryFee={deliveryFee}
        deliveryPricing={deliveryPricing}
        nearestOutlet={nearestOutlet}
        selectedOutlet={selectedOutlet}
        outletDistanceKm={outletDistanceKm}
        isResolvingOutletMatch={isResolvingOutletMatch}
        customerLocation={customerLocation}
        onDetectLocation={detectLocation}
        pastOrders={pastOrders}
        onReorder={handleReorder}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={closePaymentView}
        total={currentTotal}
        onPaymentComplete={handlePaymentComplete}
        outletName={selectedOutlet?.name}
        outletPhone={selectedOutlet?.phone}
      />

      {notification && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[90%] md:max-w-xs">
          <div className="bg-slate-900 text-white px-6 md:px-8 py-4 rounded-2xl shadow-2xl border border-red-600/30 mx-auto">
            <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">{notification}</span>
          </div>
        </div>
      )}

      {showOrderSuccess && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center px-0 sm:items-center sm:px-4">
          <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-md" onClick={closeSuccessView} />
          <div
            className="relative w-full max-w-sm rounded-t-[2rem] border-2 border-red-600 bg-slate-900 p-6 text-center text-white shadow-2xl sm:rounded-[3rem] sm:p-10"
            style={successSwipeDismiss.style}
            {...successSwipeDismiss.bind}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
            <div className="w-16 h-16 md:w-20 md:h-20 bg-green-500 rounded-full flex items-center justify-center text-white text-3xl md:text-4xl mb-6 mx-auto shadow-xl">
              OK
            </div>
            <h4 className="font-display text-3xl md:text-4xl font-bold mb-3 leading-tight">Order Received</h4>
            <p className="text-white/60 text-[10px] md:text-[11px] uppercase tracking-widest mt-4">
              We will notify you with status updates.
            </p>
            <p className="mt-4 text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
              Swipe down to dismiss
            </p>
            <p className="text-[10px] md:text-[11px] text-red-500 font-black tracking-[0.5em] mt-8 uppercase">
              Because Hari Knows
            </p>
            <button
              onClick={closeSuccessView}
              className="mt-10 px-10 py-4 bg-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all w-full"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
