import React, { useState } from 'react';
import { MenuItem, OfferCard } from '../types';
import {
  getDiscountedUnitPrice,
  getOfferConditionLabel,
  getOfferMinimumScope,
  getMatchingDiscountOffer,
  isOfferUnlocked,
} from '../offerUtils';

interface MenuSectionProps {
  items: MenuItem[];
  onAddToCart: (item: MenuItem, selectedSize?: string) => void;
  offers: OfferCard[];
  cartSubtotal: number;
}

interface MenuCardProps {
  item: MenuItem;
  offers: OfferCard[];
  cartSubtotal: number;
  onAdd: (selectedSize?: string) => void;
}

const MenuCard: React.FC<MenuCardProps> = ({ item, offers, cartSubtotal, onAdd }) => {
  const [selectedSize, setSelectedSize] = useState<string>(item.sizes?.[0]?.label ?? '');
  const [isAdding, setIsAdding] = useState(false);

  const currentBasePrice =
    item.sizes?.find((size) => size.label === selectedSize)?.price ?? item.price;
  const previewOffer = getMatchingDiscountOffer(offers, item);
  const previewAmount = cartSubtotal + currentBasePrice;
  const offerUnlocked = previewOffer ? isOfferUnlocked(previewOffer, currentBasePrice, previewAmount) : false;
  const activeOffer = offerUnlocked ? previewOffer : undefined;
  const discountedPrice = getDiscountedUnitPrice(currentBasePrice, activeOffer);
  const hasDiscount = discountedPrice < currentBasePrice;

  const handleAddClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsAdding(true);
    onAdd(selectedSize || undefined);
    window.setTimeout(() => setIsAdding(false), 500);
  };

  return (
    <div
      className={`group flex h-full flex-col overflow-hidden rounded-[2.25rem] border border-orange-100 bg-white shadow-sm transition-all duration-500 ${
        item.available ? 'hover:-translate-y-1.5 hover:shadow-2xl' : 'pointer-events-none opacity-60 grayscale'
      }`}
    >
      <div className="relative h-60 overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700 shadow-sm">
            Veg
          </span>
          {item.popular && (
            <span className="rounded-full bg-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-950 shadow-sm">
              Popular
            </span>
          )}
          {item.spicy && (
            <span className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-sm">
              Spicy
            </span>
          )}
          {previewOffer?.offerPercentage && (
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-sm">
              Save {previewOffer.offerPercentage}%
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-display font-bold leading-tight text-slate-900">{item.name}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">{item.description}</p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-display font-bold text-red-600">Rs {discountedPrice}</div>
            {hasDiscount && <div className="text-sm text-slate-400 line-through">Rs {currentBasePrice}</div>}
          </div>
        </div>

        {item.sizes && (
          <div className="mt-6 flex rounded-2xl border border-orange-100 bg-orange-50/70 p-1">
            {item.sizes.map((size) => (
              <button
                key={size.label}
                onClick={() => setSelectedSize(size.label)}
                className={`flex-1 rounded-[1rem] px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  selectedSize === size.label
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        )}

        {previewOffer && (
          <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-700">
              {previewOffer.offerTitle}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">
              {getOfferConditionLabel(previewOffer)}
              {!offerUnlocked
                ? getOfferMinimumScope(previewOffer) === 'cart'
                  ? ' Add more items to the cart to unlock this offer.'
                  : ' Choose a higher-value size to unlock this offer.'
                : ''}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{item.category}</span>
          <button
            onClick={handleAddClick}
            className={`inline-flex h-12 min-w-[124px] items-center justify-center rounded-2xl px-5 text-[10px] font-black uppercase tracking-[0.22em] transition-all ${
              isAdding ? 'bg-green-600 text-white' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isAdding ? 'Added' : item.available ? 'Add to cart' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MenuSection: React.FC<MenuSectionProps> = ({ items, onAddToCart, offers, cartSubtotal }) => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
    {items.map((item) => (
      <MenuCard
        key={item.id}
        item={item}
        offers={offers}
        cartSubtotal={cartSubtotal}
        onAdd={(selectedSize) => onAddToCart(item, selectedSize)}
      />
    ))}
  </div>
);

export default MenuSection;
