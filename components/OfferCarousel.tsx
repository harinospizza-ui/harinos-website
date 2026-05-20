import React, { useEffect, useRef, useState } from 'react';
import { OfferCard } from '../types';
import { getOfferActionLabel, getOfferConditionLabel } from '../offerUtils';

interface OfferCarouselProps {
  offers: OfferCard[];
  onAction: (offer: OfferCard) => void;
}

const SWIPE_THRESHOLD = 40;

const OfferCarousel: React.FC<OfferCarouselProps> = ({ offers, onAction }) => {
  const visibleOffers = offers.filter((offer) => offer.enabled).slice(0, 3);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (visibleOffers.length <= 1) {
      setActiveIndex(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % visibleOffers.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [visibleOffers.length]);

  if (!visibleOffers.length) {
    return null;
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || visibleOffers.length <= 1) {
      touchStartX.current = null;
      return;
    }

    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD) {
      return;
    }

    if (deltaX < 0) {
      setActiveIndex((currentIndex) => (currentIndex + 1) % visibleOffers.length);
      return;
    }

    setActiveIndex((currentIndex) => (currentIndex - 1 + visibleOffers.length) % visibleOffers.length);
  };

  return (
    <section className="mx-auto mt-5 max-w-7xl px-4 sm:mt-6">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-red-600">Offer Box</p>
          <h2 className="mt-1 text-lg font-display font-bold text-slate-900 sm:text-xl">Live offers and updates</h2>
        </div>
        <div className="flex items-center gap-2">
          {visibleOffers.map((offer, index) => (
            <button
              key={offer.id}
              onClick={() => setActiveIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === activeIndex ? 'w-6 bg-red-600' : 'w-2 bg-orange-200'
              }`}
              aria-label={`Show offer ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-orange-100 bg-white shadow-[0_18px_45px_rgba(120,40,0,0.12)]">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {visibleOffers.map((offer) => (
            <article key={offer.id} className="w-full flex-shrink-0">
              <div className="grid min-h-[210px] grid-cols-[108px,1fr] sm:min-h-[236px] sm:grid-cols-[160px,1fr]">
                <div className="relative h-full">
                  <img src={offer.image} alt={offer.offerTitle} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 to-transparent" />
                  <div className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.22em] text-red-700 backdrop-blur-sm">
                    {offer.offerPercentage ? 'Live Offer' : 'Update'}
                  </div>
                </div>

                <div className="flex flex-col justify-between p-4 sm:p-5">
                  <div>
                    <h3 className="pr-2 text-lg font-display font-bold leading-tight text-slate-900 sm:text-2xl">
                      {offer.offerTitle}
                    </h3>
                    <p className="mt-2 text-[12px] leading-5 text-slate-600 sm:text-sm">
                      {offer.displayText}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {offer.offerPercentage && (
                        <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-red-600">
                          {offer.offerPercentage}% Off
                        </span>
                      )}
                      {offer.notifyCustomers && (
                        <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-orange-700">
                          Notification On
                        </span>
                      )}
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Condition
                      </div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-600">
                        {getOfferConditionLabel(offer)}
                      </div>
                    </div>

                    {offer.additionalItem && (
                      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/65 px-3 py-3">
                        {offer.additionalItemImage && (
                          <img
                            src={offer.additionalItemImage}
                            alt={offer.additionalItem}
                            className="h-12 w-12 rounded-xl object-cover"
                          />
                        )}
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-700">
                            Additional Item
                          </div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-700">
                            {offer.additionalItem}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Swipe for more
                    </span>
                    <button
                      onClick={() => onAction(offer)}
                      className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-lg shadow-red-200 transition-all hover:bg-red-700 active:scale-95"
                    >
                      {getOfferActionLabel(offer)}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OfferCarousel;
