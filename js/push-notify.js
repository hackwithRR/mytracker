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
    // Prefer registering from the web root (most WebView/Capacitor setups).
    const preferredUrl = new URL('sw.js', window.location.origin + '/').toString();

    // Also keep a fallback to relative-to-current-path URL.
    const fallbackUrl = new URL('sw.js', window.location.href).toString();

    try {
      window.dispatchEvent(
        new CustomEvent('nexus-notif:toast', { detail: { message: `NOTIF SW register try: ${preferredUrl}` } })
      );
      await navigator.serviceWorker.register(preferredUrl);
      return true;
    } catch (e1) {
      window.dispatchEvent(
        new CustomEvent('nexus-notif:toast', { detail: { message: `NOTIF SW register failed at root. trying fallback` } })
      );

      window.dispatchEvent(
        new CustomEvent('nexus-notif:toast', { detail: { message: `NOTIF SW error: ${String(e1 && e1.message ? e1.message : e1)}` } })
      );

      await navigator.serviceWorker.register(fallbackUrl);
      return true;
    }
  } catch (e) {
    try {
      window.dispatchEvent(
        new CustomEvent('nexus-notif:toast', { detail: { message: `NOTIF SW register fatal: ${String(e && e.message ? e.message : e)}` } })
      );
    } catch {}
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
  const page = s.pages?.[pageKey];
  const fallback = {
    enabled: true,
    scheduleTime: '09:00',
    tokens: {}
  };
  return page && typeof page === 'object' ? { ...fallback, ...page, tokens: page.tokens || {} } : fallback;
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
  // helper for debug: quick toast bind if module not loaded
  try { window.dispatchEvent(new CustomEvent('nexus-notif:toast', { detail: { message: 'NOTIF scheduler initialized (daily)' } })); } catch {}
  // Backward-compatible single-time-per-page scheduler.
  const parsed = parseHHMM(hhmm);
  if (!parsed) return () => {};

  const cfg = getPageSettings(pageKey);
  if (!cfg?.enabled) return () => {};

  let timeoutId = null;
  const tick = () => {
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

    const next = computeNextFireTime(parsed.hh, parsed.mm);
    timeoutId = setTimeout(tick, next.getTime() - Date.now());
  };

  const next = computeNextFireTime(parsed.hh, parsed.mm);
  timeoutId = setTimeout(tick, next.getTime() - Date.now());

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };
}

function normalizeTokenTime(hhmm) {
  const p = parseHHMM(hhmm);
  if (!p) return null;
  return `${String(p.hh).padStart(2,'0')}:${String(p.mm).padStart(2,'0')}`;
}

export function scheduleTokenNotifications({ pageKey, title, getBodyText }) {
  try { window.dispatchEvent(new CustomEvent('nexus-notif:toast', { detail: { message: 'NOTIF scheduler initialized (token)' } })); } catch {}
  // Token-level scheduling: reads page settings tokens[tokenKey].time
  // and schedules separate daily reminders for each enabled token.
  // Best-effort browser scheduling while the page is open.

  const cfg = getPageSettings(pageKey);
  if (!cfg?.enabled) return [];

  const tokens = cfg?.tokens || {};
  const cleanTokens = Object.keys(tokens)
    .filter(tk => tokens[tk] && tokens[tk].enabled)
    .map(tk => ({ token: tk, time: normalizeTokenTime(tokens[tk].time) }))
    .filter(x => x.time);

  const unsubs = [];

  cleanTokens.forEach(({ token, time }) => {
    try { window.dispatchEvent(new CustomEvent('nexus-notif:toast', { detail: { message: `NOTIF scheduled token=${token} time=${time}` } })); } catch {}

    const parsed = parseHHMM(time);
    if (!parsed) return;

    let timeoutId = null;
    const tick = () => {
      const latest = getPageSettings(pageKey);
      if (!latest?.enabled) return;
      const latestTok = latest?.tokens?.[token];
      if (!latestTok?.enabled) return;

      const body = typeof getBodyText === 'function'
        ? getBodyText({ token })
        : `Reminder: ${token}`;

      if (body && Notification.permission === 'granted') {
        try {
          // Debug: also broadcast to UI so you can see it fired.
          window.dispatchEvent(new CustomEvent('nexus-notif:toast', { detail: { message: `NOTIF FIRED: ${token}` } }));
          new Notification(title || 'Nexus Reminder', { body });
        } catch {}
      }

      const next = computeNextFireTime(parsed.hh, parsed.mm);
      timeoutId = setTimeout(tick, next.getTime() - Date.now());
    };

    const next = computeNextFireTime(parsed.hh, parsed.mm);
    timeoutId = setTimeout(tick, next.getTime() - Date.now());

    unsubs.push(() => clearTimeout(timeoutId));
  });

  return unsubs;
}


