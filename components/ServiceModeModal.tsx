import React from 'react';
import { OrderType } from '../types';

interface ServiceModeModalProps {
  isOpen: boolean;
  selectedType: OrderType;
  onSelect: (type: OrderType) => void;
  storeStatus: string;
}

const SERVICE_OPTIONS: Array<{
  type: OrderType;
  label: string;
  description: string;
  badge: string;
}> = [
  {
    type: 'takeaway',
    label: 'TakeAway',
    description: 'Pick up your order from the outlet.',
    badge: 'Fastest handoff',
  },
  {
    type: 'delivery',
    label: 'Delivery',
    description: 'Road-distance pricing is calculated after location access.',
    badge: 'Charges depend on route',
  },
  {
    type: 'dinein',
    label: 'Dine-in',
    description: 'Order for table service at the outlet.',
    badge: 'Best for beverages',
  },
];

const ServiceModeModal: React.FC<ServiceModeModalProps> = ({
  isOpen,
  selectedType,
  onSelect,
  storeStatus,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-xl sm:items-center sm:p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-t-[2rem] bg-white shadow-[0_30px_100px_rgba(15,23,42,0.45)] sm:rounded-[2.5rem]">
        <div className="bg-slate-900 px-6 pb-6 pt-[max(env(safe-area-inset-top),24px)] text-white sm:px-8 sm:py-8">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-500">
            Start Order
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
            How should we prepare this order?
          </h2>
          <p className="mt-3 max-w-lg text-sm text-white/65">
            Choose your service mode first. You can still change it later from the basket.
          </p>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
            {storeStatus}
          </p>
        </div>

        <div className="space-y-3 p-5 sm:p-7">
          {SERVICE_OPTIONS.map((option) => {
            const isSelected = selectedType === option.type;

            return (
              <button
                key={option.type}
                type="button"
                onClick={() => onSelect(option.type)}
                className={`w-full rounded-[1.75rem] border px-5 py-5 text-left transition-all ${
                  isSelected
                    ? 'border-red-600 bg-gradient-to-r from-red-50 to-orange-50 shadow-lg shadow-red-100'
                    : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                      {option.badge}
                    </div>
                    <div className="mt-2 font-display text-2xl font-bold text-slate-900">
                      {option.label}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{option.description}</p>
                  </div>
                  <div
                    className={`mt-1 flex h-11 w-11 items-center justify-center rounded-2xl border ${
                      isSelected
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}

          <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50 px-4 py-3 text-[11px] font-medium text-amber-900">
            Delivery uses road distance, not straight-line distance. Free delivery starts at Rs 150 up to 3 km,
            then the free-delivery minimum increases by Rs 100 for each extra kilometer up to 7 km.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceModeModal;
