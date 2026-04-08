import React, { useEffect, useMemo, useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface InstallPopupProps {
  blocked?: boolean;
}

const POPUP_DISMISS_KEY = 'harinos-install-popup-dismissed-at';
const POPUP_DELAY_MS = 3500;
const POPUP_COOLDOWN_MS = 1000 * 60 * 60 * 12;

const InstallPopup: React.FC<InstallPopupProps> = ({ blocked = false }) => {
  const { canPromptInstall, needsIosInstructions, isInstalled, promptInstall } = useInstallPrompt();
  const [isVisible, setIsVisible] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  const isSupported = canPromptInstall || needsIosInstructions;

  useEffect(() => {
    if (blocked || isInstalled || !isSupported) {
      setIsVisible(false);
      return;
    }

    const lastDismissedAt = Number(window.localStorage.getItem(POPUP_DISMISS_KEY) ?? '0');
    if (lastDismissedAt && Date.now() - lastDismissedAt < POPUP_COOLDOWN_MS) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsVisible(true);
      setShowIosSteps(needsIosInstructions);
    }, POPUP_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [blocked, isInstalled, isSupported, needsIosInstructions]);

  const popupTitle = useMemo(() => {
    if (needsIosInstructions) {
      return 'Add Harino\'s to your Home Screen';
    }

    return 'Install the Harino\'s App';
  }, [needsIosInstructions]);

  const dismissPopup = () => {
    window.localStorage.setItem(POPUP_DISMISS_KEY, Date.now().toString());
    setIsVisible(false);
  };

  const handlePrimaryAction = async () => {
    if (canPromptInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        dismissPopup();
      }
      return;
    }

    setShowIosSteps(true);
  };

  if (!isVisible || isInstalled || !isSupported) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={dismissPopup} />

      <div className="install-popup-card relative w-full max-w-md overflow-hidden rounded-t-[2rem] border border-white/10 bg-slate-950 text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:rounded-[2.5rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.32),_transparent_48%),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(255,255,255,0))]" />

        <div className="relative p-5 sm:p-7">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15 sm:hidden" />

          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-white/10 ring-1 ring-white/10 shadow-lg">
                <img src="/icon-192.png" alt="Harino's App" className="h-12 w-12 rounded-2xl object-cover" />
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.24em] text-amber-300">
                  Better as an app
                </div>
                <h3 className="mt-1 font-display text-2xl font-bold leading-tight text-white">
                  {popupTitle}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={dismissPopup}
              aria-label="Close install popup"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <p className="max-w-sm text-sm leading-6 text-white/70">
            Install Harino&apos;s for faster reorders, smoother full-screen browsing, and quick access from your phone home screen.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">FAST</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Faster Launch</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">ORDER</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Quick Reorder</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">APP</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Home Screen</div>
            </div>
          </div>

          {showIosSteps && (
            <div className="mt-5 rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">
                iPhone / iPad Steps
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-white/75">
                <p>1. Open this site in Safari.</p>
                <p>2. Tap the Share button.</p>
                <p>3. Choose Add to Home Screen.</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="cta-glow flex-1 rounded-2xl bg-red-600 px-5 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-lg transition-transform active:scale-[0.98]"
            >
              {canPromptInstall ? 'Install Now' : 'Show Install Steps'}
            </button>
            <button
              type="button"
              onClick={dismissPopup}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white/70 transition-colors hover:text-white"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallPopup;
