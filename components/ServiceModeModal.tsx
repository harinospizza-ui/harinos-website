import React from 'react';
import { OrderType } from '../types';

interface ServiceModeModalProps {
  isOpen: boolean;
  selectedType: OrderType;
  onSelect: (type: OrderType) => void;
  storeStatus: string;
}

interface ServiceOption {
  type: OrderType;
  label: string;
  caption: string;
  panelClass: string;
  glowClass: string;
  iconClass: string;
  activeClass: string;
}

const SERVICE_OPTIONS: ServiceOption[] = [
  {
    type: 'takeaway',
    label: 'Take Away',
    caption: 'Grab & Go',
    panelClass: 'from-amber-100 via-orange-50 to-white',
    glowClass: 'bg-orange-300/50',
    iconClass: 'text-orange-500',
    activeClass: 'border-orange-300 bg-orange-50/80 shadow-[0_18px_40px_rgba(249,115,22,0.18)]',
  },
  {
    type: 'delivery',
    label: 'Delivery',
    caption: 'Doorstep',
    panelClass: 'from-rose-100 via-orange-50 to-white',
    glowClass: 'bg-rose-300/50',
    iconClass: 'text-rose-500',
    activeClass: 'border-rose-300 bg-rose-50/80 shadow-[0_18px_40px_rgba(244,63,94,0.18)]',
  },
  {
    type: 'dinein',
    label: 'Dine In',
    caption: 'At Table',
    panelClass: 'from-emerald-100 via-lime-50 to-white',
    glowClass: 'bg-emerald-300/50',
    iconClass: 'text-emerald-600',
    activeClass: 'border-emerald-300 bg-emerald-50/80 shadow-[0_18px_40px_rgba(16,185,129,0.18)]',
  },
];

const ServiceIllustration: React.FC<Pick<ServiceOption, 'type' | 'iconClass'>> = ({
  type,
  iconClass,
}) => {
  if (type === 'delivery') {
    return (
      <svg className={`h-14 w-14 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 64 64">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M10 39h8l6-14h18l5 14h4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M36 25h9l7 8v6" />
        <circle cx="22" cy="44" r="6" strokeWidth="3.5" />
        <circle cx="46" cy="44" r="6" strokeWidth="3.5" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M17 18h11" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M12 24h12" />
      </svg>
    );
  }

  if (type === 'dinein') {
    return (
      <svg className={`h-14 w-14 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 64 64">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M13 25h38" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M19 25v22" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M45 25v22" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M15 47h34" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M22 17v8" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M42 17v8" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M20 13h4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M40 13h4" />
      </svg>
    );
  }

  return (
    <svg className={`h-14 w-14 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 64 64">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M18 22h28l2 26H16l2-26Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M24 22v-4a8 8 0 0 1 16 0v4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M24 31h16" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M28 36h8" />
    </svg>
  );
};

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
    <div className="fixed inset-0 z-[140] flex justify-center px-4 pb-6 pt-[max(env(safe-area-inset-top),6rem)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.32),rgba(15,23,42,0.12)_38%,rgba(255,255,255,0.02)_72%)] backdrop-blur-[2px]" />

      <div className="relative w-full max-w-md">
        <div className="absolute inset-x-10 -top-6 h-24 rounded-full bg-red-500/20 blur-3xl" />
        <div className="absolute -left-6 top-20 h-24 w-24 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="absolute -right-8 bottom-10 h-28 w-28 rounded-full bg-orange-300/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/78 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.22)] backdrop-blur-2xl sm:p-5">
          <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(248,113,113,0.18),rgba(251,191,36,0.1),rgba(255,255,255,0))]" />

          <div className="relative">
            <div className="inline-flex items-center rounded-full border border-red-100 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-red-600 shadow-sm">
              Start Here
            </div>

            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-[2rem]">
                  Select your mode
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pick one and we will take it from there.
                </p>
              </div>

              <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg sm:flex">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {SERVICE_OPTIONS.map((option) => {
                const isSelected = selectedType === option.type;

                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => onSelect(option.type)}
                    className={`group rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-2.5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                      isSelected ? option.activeClass : 'hover:border-slate-300'
                    }`}
                  >
                    <div className={`relative overflow-hidden rounded-[1.25rem] bg-gradient-to-br ${option.panelClass} p-2`}>
                      <div className={`absolute -right-2 -top-2 h-10 w-10 rounded-full blur-2xl ${option.glowClass}`} />
                      <div className="relative flex h-20 items-center justify-center rounded-[1rem] border border-white/60 bg-white/55 backdrop-blur-sm">
                        <ServiceIllustration type={option.type} iconClass={option.iconClass} />
                      </div>
                    </div>

                    <div className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {option.caption}
                    </div>
                    <div className="mt-1 font-display text-sm font-bold leading-tight text-slate-900 sm:text-base">
                      {option.label}
                    </div>

                    <div className="mt-3 flex justify-center">
                      <span
                        className={`h-2.5 w-2.5 rounded-full transition-all ${
                          isSelected ? 'bg-slate-900 shadow-[0_0_0_4px_rgba(15,23,42,0.08)]' : 'bg-slate-200'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-full bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
                You can change this later
              </div>
              <div className="rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-[10px] font-bold text-slate-500 shadow-sm">
                {storeStatus}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceModeModal;
