import { getOfferNotificationMessage, getOfferReleaseSignature } from '../offerUtils';
import { OfferCard } from '../types';

const DEFAULT_ICON = 'https://drive.google.com/thumbnail?id=1Gz7Qi82EYLJZxm1EfFxpXHHQ6mhKQIc4&sz=w500';
const OFFER_RELEASE_KEY = 'harinos_offer_release_signature';

export const NotificationService = {
  requestPermission: async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notification');
      return false;
    }

    if (Notification.permission === 'granted') return true;

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  },

  show: (title: string, body: string, icon?: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || DEFAULT_ICON,
        badge: DEFAULT_ICON,
      });
    }
  },

  notifyOfferReleases: (offers: OfferCard[], options?: { force?: boolean }) => {
    if (Notification.permission !== 'granted') {
      return;
    }

    const notifiableOffers = offers.filter((offer) => offer.enabled && offer.notifyCustomers);
    if (!notifiableOffers.length) {
      return;
    }

    const currentSignature = getOfferReleaseSignature(notifiableOffers);
    const previousSignature = localStorage.getItem(OFFER_RELEASE_KEY);

    if (!options?.force && previousSignature === currentSignature) {
      return;
    }

    notifiableOffers.forEach((offer, index) => {
      window.setTimeout(() => {
        NotificationService.show(
          `New Offer: ${offer.offerTitle}`,
          getOfferNotificationMessage(offer),
          offer.image || DEFAULT_ICON,
        );
      }, index * 900);
    });

    localStorage.setItem(OFFER_RELEASE_KEY, currentSignature);
  },

  simulateOrderStatus: (orderId: string, type: 'takeaway' | 'delivery') => {
    window.setTimeout(() => {
      NotificationService.show(
        'Order Confirmed',
        `We've received your order ${orderId}. The kitchen has started preparing it.`,
      );
    }, 1000);

    window.setTimeout(() => {
      NotificationService.show(
        'In the Oven',
        `Order ${orderId} is being prepared fresh right now.`,
      );
    }, 15000);

    window.setTimeout(() => {
      const title = type === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup';
      const body = type === 'delivery'
        ? 'Our delivery partner is on the way to your location.'
        : 'Your order is hot and ready at the counter.';

      NotificationService.show(title, body);
    }, 45000);
  },
};
