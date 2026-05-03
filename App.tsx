import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartItem,
  Category,
  CategoryFilter,
  CustomerLocation,
  AdminSession,
  MenuItem,
  OfferCard,
  Order,
  OrderItem,
  OrderType,
  OutletConfig,
} from './types';
import { MENU_ITEMS, OFFER_CARDS } from './constants';
import { StorageService } from './services/storage';
import { NotificationService } from './services/notification';
import { saveOrderToServer, saveOrderToSharedStore } from './services/orderApi';
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
import AdminPanel from './components/AdminPanel';
import { useSwipeDismiss } from './hooks/useSwipeDismiss';

const DISPLAY_OFFERS = OFFER_CARDS.slice(0, 3);
const APP_HISTORY_NAMESPACE = 'harinos-ui';
const CUSTOMER_CARE_WHATSAPP_URL = 'https://wa.me/917818958571';

type AppScreen = 'menu' | 'orders' | 'category' | 'cart' | 'payment' | 'success';

interface ResolvedOrderContext {
  customerLocation: CustomerLocation | null;
  outlet: OutletConfig;
  distanceKm: number | null;
}

const App: React.FC = () => {
  const [outlets, setOutlets] = useState<OutletConfig[]>(() => StorageService.getMergedOutlets());
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const overrides = StorageService.getItemAvailabilityOverrides();
    return MENU_ITEMS.map((item) => ({
      ...item,
      available: overrides[item.id] ?? item.available,
    }));
  });
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [outletAnnouncement, setOutletAnnouncement] = useState<string | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(
    StorageService.getAdminSession(),
  );
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(() => adminSession !== null);
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
    () => outlets.filter((outlet) => outlet.enabled),
    [outlets],
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
    const refreshOutletConfig = () => {
      setOutlets(StorageService.getMergedOutlets());
    };

    refreshOutletConfig();
    const interval = window.setInterval(refreshOutletConfig, 30000);
    window.addEventListener('storage', refreshOutletConfig);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', refreshOutletConfig);
    };
  }, []);

  useEffect(() => {
    if (StorageService.getCustomerLocation()) {
      return;
    }

    navigator.geolocation?.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let address = '';
        try {
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 5000);
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { signal: controller.signal },
          );
          window.clearTimeout(timeout);
          const geo = (await response.json()) as { display_name?: string };
          address = geo.display_name ?? '';
        } catch {
          // NOTE: Customer location capture is best-effort and must never block browsing.
        }

        StorageService.saveCustomerLocation(latitude, longitude, address);
      },
      () => {
        // NOTE: Permission denial or unsupported geolocation is silent by design.
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    const checkStoreStatus = () => {
      const selectedOutletId = selectedOutlet?.id ?? '';
      setOutletAnnouncement(StorageService.getOutletAnnouncement(selectedOutletId));

      const override = StorageService.getOutletOpen(selectedOutletId);
      if (override === false) {
        setIsStoreOpen(false);
        setStatusMessage('Outlet is currently closed. Please check back later.');
        return;
      }

      if (override === true) {
        setIsStoreOpen(true);
        setStatusMessage('Open now. Orders are being prepared fresh.');
        return;
      }

      const now = new Date();
      const currentTimeInMins = now.getHours() * 60 + now.getMinutes();
      const openingTime = 11 * 60;
      const closingTime = 21 * 60;

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
  }, [selectedOutlet?.id]);

  useEffect(() => {
    const refreshMenuAvailability = () => {
      const overrides = StorageService.getItemAvailabilityOverrides();
      setMenuItems(
        MENU_ITEMS.map((item) => ({
          ...item,
          available: overrides[item.id] ?? item.available,
        })),
      );
    };

    refreshMenuAvailability();
    const interval = window.setInterval(refreshMenuAvailability, 30000);
    window.addEventListener('storage', refreshMenuAvailability);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', refreshMenuAvailability);
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
        const freshItem = menuItems.find((menuItem) => menuItem.id === item.id);
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
  }, [menuItems, pushAppScreen, showNotification]);

  const filteredItems = useMemo(
    () =>
      selectedCategory === 'All'
        ? menuItems
        : menuItems.filter((item) => item.category === selectedCategory),
    [menuItems, selectedCategory],
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
    if (!StorageService.getCustomerPhone() && !StorageService.hasSkippedCustomerPhone()) {
      try {
        if ('contacts' in navigator && 'ContactsManager' in window) {
          const contacts = await (
            navigator as Navigator & {
              contacts?: { select: (fields: string[], options: { multiple: boolean }) => Promise<Array<{ tel?: string[] }>> };
            }
          ).contacts?.select(['tel'], { multiple: false });
          const phone = contacts?.[0]?.tel?.[0]?.replace(/\D/g, '');
          if (phone) {
            StorageService.saveCustomerPhone(phone);
            setIsPaymentOpen(true);
            pushAppScreen('payment');
            return;
          }
        }
      } catch {
        // NOTE: Contact Picker requires a user gesture and is unavailable on iOS/desktop; manual fallback follows.
      }

      setIsPhoneModalOpen(true);
      return;
    }

    setIsPaymentOpen(true);
    pushAppScreen('payment');
  };

  const openPaymentAfterPhoneStep = useCallback(() => {
    setIsPhoneModalOpen(false);
    setIsPaymentOpen(true);
    pushAppScreen('payment');
  }, [pushAppScreen]);

  const saveCustomerPhoneAndContinue = useCallback(() => {
    StorageService.saveCustomerPhone(phoneDraft.trim());
    openPaymentAfterPhoneStep();
  }, [openPaymentAfterPhoneStep, phoneDraft]);

  const skipCustomerPhoneAndContinue = useCallback(() => {
    StorageService.skipCustomerPhone();
    openPaymentAfterPhoneStep();
  }, [openPaymentAfterPhoneStep]);

  const getSilentLocation = useCallback(async (): Promise<CustomerLocation | null> => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser.'));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        mapUrl: buildCustomerMapUrl(position.coords.latitude, position.coords.longitude),
      };
    } catch {
      return null;
    }
  }, []);

  const reverseGeocodeLocation = useCallback(async (
    location: CustomerLocation | null,
  ): Promise<string | undefined> => {
    if (!location) {
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${location.latitude}&lon=${location.longitude}&format=json`,
        { signal: controller.signal },
      );
      const geo = (await response.json()) as { display_name?: string };
      return geo.display_name;
    } catch {
      return undefined;
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

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
    const savedLocation = StorageService.getCustomerLocation();
    const freshLocation = await getSilentLocation();
    const finalLocation = resolvedLocation ?? freshLocation ?? (
      savedLocation
        ? {
            latitude: savedLocation.lat,
            longitude: savedLocation.lng,
            mapUrl: buildCustomerMapUrl(savedLocation.lat, savedLocation.lng),
          }
        : null
    );
    const customerAddress = await reverseGeocodeLocation(finalLocation) ?? savedLocation?.address;
    if (finalLocation) {
      StorageService.saveCustomerLocation(finalLocation.latitude, finalLocation.longitude, customerAddress ?? '');
    }
    const locationString = orderType === 'delivery' && finalLocation ? finalLocation.mapUrl : 'Not shared';
    const customerPhone = StorageService.getCustomerPhone() ?? undefined;
    const receivedAt = new Date().toISOString();
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
      customerPhone,
      customerLatitude: finalLocation?.latitude,
      customerLongitude: finalLocation?.longitude,
      customerAddress,
      receivedAt,
      status: 'new',
      statusHistory: [
        {
          status: 'new',
          timestamp: receivedAt,
          changedBy: 'customer',
        },
      ],
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
    StorageService.saveOrderToOutlet(newOrder);
    try {
      await saveOrderToSharedStore(newOrder);
    } catch (error) {
      console.warn('Shared order sync unavailable; order kept on this device.', error);
    }
    setPastOrders((currentOrders) => [newOrder, ...currentOrders].slice(0, 3));
    NotificationService.simulateOrderStatus(orderId, orderType === 'delivery' ? 'delivery' : 'takeaway');

    try {
      const channel = new BroadcastChannel('harinos_orders');
      channel.postMessage({ type: 'NEW_ORDER', outletId: outlet.id, orderId });
      channel.close();
    } catch {
      // NOTE: WhatsApp redirect has been removed. Local admin panels receive orders through storage polling.
    }

    setShowOrderSuccess(true);
    replaceAppScreen('success');
    setCart([]);
  };

  const handleAdminTrigger = useCallback(() => {
    setIsAdminPanelOpen(true);
  }, []);

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
        onAdminTrigger={handleAdminTrigger}
      />
      {outletAnnouncement && (
        <div className="fixed left-0 right-0 top-[72px] z-[90] bg-amber-500 px-4 py-2 text-center text-[11px] font-black uppercase tracking-widest text-slate-900 shadow-lg">
          {outletAnnouncement}
        </div>
      )}
      <InstallPopup
        blocked={
          isCartOpen ||
          isPaymentOpen ||
          isPhoneModalOpen ||
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

      <a
        href={CUSTOMER_CARE_WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with customer care on WhatsApp"
        className="fixed bottom-6 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-white shadow-2xl shadow-green-900/30 ring-4 ring-white/70 transition-transform active:scale-95 md:bottom-8 md:right-8"
      >
        <svg className="h-7 w-7" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path d="M16.02 3.2A12.7 12.7 0 0 0 5.07 22.33L3.5 28.8l6.63-1.52A12.71 12.71 0 1 0 16.02 3.2Zm0 2.38a10.33 10.33 0 0 1 8.78 15.77 10.33 10.33 0 0 1-13.9 3.5l-.4-.24-3.76.86.9-3.66-.26-.42A10.32 10.32 0 0 1 16.02 5.58Zm-4.05 5.3c-.25 0-.66.1-1 .47-.35.38-1.32 1.3-1.32 3.15 0 1.86 1.35 3.65 1.54 3.9.19.25 2.6 4.16 6.45 5.67 3.2 1.26 3.85 1.01 4.54.95.7-.07 2.25-.92 2.57-1.82.32-.9.32-1.67.22-1.82-.1-.16-.35-.25-.73-.44-.38-.2-2.25-1.11-2.6-1.24-.35-.13-.6-.2-.86.19-.25.38-.98 1.24-1.2 1.49-.22.25-.44.29-.82.1-.38-.2-1.6-.6-3.05-1.9-1.13-1-1.9-2.24-2.12-2.62-.22-.38-.02-.59.17-.78.17-.17.38-.44.57-.67.19-.22.25-.38.38-.63.13-.25.06-.48-.03-.67-.1-.2-.86-2.07-1.18-2.84-.31-.75-.63-.65-.86-.66h-.73Z" />
        </svg>
      </a>

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
        <div className="fixed bottom-24 left-4 right-4 z-50 md:hidden">
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

      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-[115] flex items-end justify-center bg-slate-900/70 backdrop-blur-md sm:items-center">
          <div className="w-full max-w-md rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
            <h3 className="font-display text-2xl font-bold text-slate-900">Get delivery updates by SMS?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Add a phone number for this device. You can skip this and continue checkout.
            </p>
            <input
              value={phoneDraft}
              onChange={(event) => setPhoneDraft(event.target.value.replace(/[^\d+ ]/g, ''))}
              type="tel"
              inputMode="tel"
              placeholder="Phone number"
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold text-slate-900 outline-none focus:border-red-500"
            />
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={saveCustomerPhoneAndContinue}
                className="flex-1 rounded-2xl bg-red-600 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-white"
              >
                Save & Continue
              </button>
              <button
                type="button"
                onClick={skipCustomerPhoneAndContinue}
                className="rounded-2xl border border-slate-200 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

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
      {isAdminPanelOpen && (
        <AdminPanel
          session={adminSession}
          onSessionChange={(session) => {
            setAdminSession(session);
          }}
          onClose={() => setIsAdminPanelOpen(false)}
          onLogout={() => {
            StorageService.clearAdminSession();
            setAdminSession(null);
          }}
          outlets={outlets}
        />
      )}
    </div>
  );
};

export default App;
