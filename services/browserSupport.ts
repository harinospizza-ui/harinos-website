export const safeStorage = {
  getItem: (storage: Storage | undefined, key: string): string | null => {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },

  setItem: (storage: Storage | undefined, key: string, value: string): boolean => {
    try {
      storage?.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  removeItem: (storage: Storage | undefined, key: string): boolean => {
    try {
      storage?.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
};

export const canUseNotifications = (): boolean =>
  getNotificationPermission() !== 'unsupported';

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback for browsers that expose the API but block it.
    }
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  document.body.appendChild(textArea);
  textArea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
};
