const NOTIF_SETTINGS_KEY = 'nexus_notif_settings_v1';

// NOTE
// This app currently has no backend to send real Web Push payloads.
// So we implement: (1) Notification permission, (2) Browser-based scheduled reminders,
// (3) Store notification settings in Firebase so all devices share the same config.

const FIREBASE_NOTIF_PATH_BASE = 'product_inventory_v1/notifications';

function notifFirebasePath(pageKey) {
  return `${FIREBASE_NOTIF_PATH_BASE}/${pageKey}`;
}

async function firebaseReadNotif(pageKey) {
  try {
    if (!window.FirebaseBridge || typeof window.FirebaseBridge.connectCloudNode !== 'function') return null;
    const config = window.__FIREBASE_CONFIG__ || {};
    const res = window.FirebaseBridge.connectCloudNode(config);
    if (!res?.success || !res?.bundle?.readStateFromCloud) return null;
    return await res.bundle.readStateFromCloud(notifFirebasePath(pageKey));
  } catch {
    return null;
  }
}

async function firebaseWriteNotif(pageKey, payload) {
  try {
    if (!window.FirebaseBridge || typeof window.FirebaseBridge.connectCloudNode !== 'function') return false;
    const config = window.__FIREBASE_CONFIG__ || {};
    const res = window.FirebaseBridge.connectCloudNode(config);
    if (!res?.success || !res?.bundle?.pushStateToCloud) return false;
    await res.bundle.pushStateToCloud(payload, notifFirebasePath(pageKey));
    return true;
  } catch {
    return false;
  }
}



export function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return Promise.reject(new Error('Notifications not supported'));
  }
  return Notification.requestPermission();
}

export async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('/sw.js');
    return true;
  } catch {
    return false;
  }
}

export function getSettings() {
  // For now: shared settings across devices are stored locally.
  // The existing FirebaseBridge can only read/push a single fixed activePath,
  // so arbitrary notification settings paths aren't accessible without refactoring.
  const raw = localStorage.getItem(NOTIF_SETTINGS_KEY);
  if (!raw) return { enabled: true, pages: {} };
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { enabled: true, pages: {} };
  } catch {
    return { enabled: true, pages: {} };
  }
}

export function setSettings(next) {
  localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(next));
}


export function getPageSettings(pageKey) {
  const s = getSettings();
  return s.pages?.[pageKey] || { enabled: true, scheduleTime: '09:00' };
}

export function setPageSettings(pageKey, pageSettings) {
  const s = getSettings();
  s.pages = s.pages || {};
  s.pages[pageKey] = { ...(s.pages[pageKey] || {}), ...pageSettings };
  setSettings(s);
}

export function parseHHMM(hhmm) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(hhmm || '');
  if (!m) return null;
  const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return { hh, mm };
}

function computeNextFireTime(hh, mm) {
  const now = new Date();
  const fire = new Date(now);
  fire.setHours(hh, mm, 0, 0);
  if (fire.getTime() <= now.getTime()) {
    fire.setDate(fire.getDate() + 1);
  }
  return fire;
}

export function scheduleDailyNotification({ pageKey, hhmm, title, getBodyText }) {
  // We schedule in the browser while the page is open.
  // True push would be server-driven; this is best-effort without backend.
  const parsed = parseHHMM(hhmm);
  if (!parsed) return () => {};

  const cfg = getPageSettings(pageKey);
  if (!cfg?.enabled) return () => {};

  let timeoutId = null;
  const tick = () => {
    // Re-check each day
    const cfg2 = getPageSettings(pageKey);
    if (!cfg2?.enabled) return;

    const body = typeof getBodyText === 'function' ? getBodyText() : '';
    if (body && Notification.permission === 'granted') {
      try {
        new Notification(title || 'Nexus Reminder', { body });
      } catch {
        // ignore
      }
    }

    // Schedule next day
    const next = computeNextFireTime(parsed.hh, parsed.mm);
    const ms = next.getTime() - Date.now();
    timeoutId = setTimeout(tick, ms);
  };

  const next = computeNextFireTime(parsed.hh, parsed.mm);
  const ms = next.getTime() - Date.now();
  timeoutId = setTimeout(tick, ms);

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };
}

