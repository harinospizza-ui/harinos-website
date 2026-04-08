const VERSION_URL = '/version.json';
const VERSION_RELOAD_KEY = 'harinos-runtime-version-reload';
const CONTROLLER_RELOAD_KEY = 'harinos-runtime-controller-reload';

const clearBrowserCaches = async (): Promise<void> => {
  if (!('caches' in window)) {
    return;
  }

  const cacheKeys = await caches.keys();
  await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
};

const reloadOnceForKey = (storageKey: string, value: string): void => {
  if (sessionStorage.getItem(storageKey) === value) {
    return;
  }

  sessionStorage.setItem(storageKey, value);
  window.location.reload();
};

export const ensureLatestCode = async (): Promise<void> => {
  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { version?: string };
    if (!data.version || data.version === __APP_VERSION__) {
      return;
    }

    await clearBrowserCaches();
    reloadOnceForKey(VERSION_RELOAD_KEY, data.version);
  } catch (error) {
    console.warn('Fresh code check skipped:', error);
  }
};

export const registerFreshRuntime = async (): Promise<void> => {
  await ensureLatestCode();

  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    reloadOnceForKey(CONTROLLER_RELOAD_KEY, __APP_VERSION__);
  });

  await registration.update().catch((error) => {
    console.warn('Service worker update skipped:', error);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      return;
    }

    void registration.update().catch(() => undefined);
    void ensureLatestCode();
  });
};
