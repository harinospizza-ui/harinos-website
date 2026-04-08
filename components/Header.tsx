import React, { useEffect, useState } from 'react';
import { NotificationService } from '../services/notification';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
  onViewOrders: () => void;
  onViewMenu: () => void;
  activeView: 'menu' | 'orders';
  onShare: () => void;
  onNotificationsEnabled: () => void;
}

const Header: React.FC<HeaderProps> = ({
  cartCount,
  onCartClick,
  onViewOrders,
  onViewMenu,
  activeView,
  onShare,
  onNotificationsEnabled,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [notifStatus, setNotifStatus] = useState<NotificationPermission>('default');
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const logoUrl = '/icon-192.png';
  const { canPromptInstall, needsIosInstructions, isInstalled, promptInstall } = useInstallPrompt();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    if ('Notification' in window) {
      setNotifStatus(Notification.permission);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleRequestNotifs = async () => {
    const granted = await NotificationService.requestPermission();
    setNotifStatus(granted ? 'granted' : 'denied');

    if (granted) {
      NotificationService.show('Alerts Enabled', 'You will now receive order updates and special offers.');
      onNotificationsEnabled();
    }
  };

  const handleInstall = async () => {
    if (canPromptInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        setShowInstallHelp(false);
      }
      return;
    }

    if (needsIosInstructions) {
      setShowInstallHelp((current) => !current);
    }
  };

  const isScrolledOrLight = scrolled || activeView === 'orders';

  return (
    <nav
      className={`fixed top-0 w-full z-[100] transition-all duration-500 ${
        isScrolledOrLight ? 'bg-white shadow-xl py-2' : 'bg-transparent py-8'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <button onClick={onViewMenu} className="flex items-center space-x-3 cursor-pointer group">
            <div
              className={`transition-all duration-500 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl ring-4 ring-white/10 ${
                isScrolledOrLight ? 'w-10 h-10' : 'w-14 h-14'
              }`}
            >
              <img
                src={logoUrl}
                alt="Harino's"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
              />
            </div>
            <div className="text-left">
              <span
                className={`block transition-all duration-500 font-display font-bold tracking-tight leading-none ${
                  isScrolledOrLight ? 'text-slate-900 text-xl' : 'text-white text-2xl'
                }`}
              >
                Harino&apos;s
              </span>
              <span
                className={`transition-all duration-500 text-[8px] md:text-[9px] uppercase tracking-[0.25em] font-bold ${
                  isScrolledOrLight ? 'text-red-600' : 'text-red-400'
                }`}
              >
                Because Hari Knows
              </span>
            </div>
          </button>

          <div className="flex items-center space-x-3">
            <div className="hidden md:flex space-x-8 text-[10px] font-black uppercase tracking-widest mr-4">
              <button
                onClick={onViewMenu}
                className={`transition-colors hover:text-red-500 ${
                  activeView === 'menu' ? 'text-red-600' : isScrolledOrLight ? 'text-slate-600' : 'text-white/80'
                }`}
              >
                Menu
              </button>
              <button
                onClick={onViewOrders}
                className={`transition-colors hover:text-red-500 ${
                  activeView === 'orders'
                    ? 'text-red-600'
                    : isScrolledOrLight
                      ? 'text-slate-600'
                      : 'text-white/80'
                }`}
              >
                History
              </button>
            </div>

            <div className="relative flex items-center space-x-2">
              {!isInstalled && (canPromptInstall || needsIosInstructions) && (
                <button
                  onClick={handleInstall}
                  className={`install-attention flex items-center gap-2 rounded-2xl px-3 py-3 md:px-4 md:py-4 transition-all duration-300 active:scale-90 ${
                    isScrolledOrLight
                      ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                      : 'bg-emerald-500/20 text-white ring-2 ring-emerald-300/45 backdrop-blur-md'
                  }`}
                  title={canPromptInstall ? 'Install App' : 'Install on iPhone or iPad'}
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-[0.22em]">
                    Install
                  </span>
                </button>
              )}

              <button
                onClick={handleRequestNotifs}
                className={`p-3 md:p-4 rounded-2xl transition-all duration-300 active:scale-90 relative ${
                  isScrolledOrLight ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-white'
                }`}
                title="Enable Notifications"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill={notifStatus === 'granted' ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {notifStatus === 'default' && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
              </button>

              {needsIosInstructions && showInstallHelp && (
                <div className="absolute right-0 top-full z-[120] mt-3 w-64 rounded-[1.5rem] border border-orange-100 bg-white p-4 text-left shadow-2xl">
                  <div className="text-[8px] font-black uppercase tracking-[0.2em] text-red-600">
                    Install on iPhone / iPad
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-600">
                    Open this site in Safari, tap the Share button, then choose Add to Home Screen.
                  </p>
                </div>
              )}

              <button
                onClick={onShare}
                className={`hidden sm:flex p-4 rounded-2xl transition-all duration-300 active:scale-90 ${
                  isScrolledOrLight ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-white'
                }`}
                title="Share App"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 100 6 3 3 0 000-6z"
                  />
                </svg>
              </button>

              <button
                onClick={onCartClick}
                className={`relative p-3 md:p-4 rounded-2xl transition-all duration-300 active:scale-90 ${
                  isScrolledOrLight ? 'bg-red-600 text-white shadow-lg' : 'bg-white/10 text-white backdrop-blur-md'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cartCount > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 text-[10px] font-black px-2 py-0.5 rounded-full ring-2 transition-all ${
                      isScrolledOrLight ? 'bg-white text-red-600 ring-red-600' : 'bg-red-600 text-white ring-white'
                    }`}
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;
