import { FirebaseBridge } from './firebase-config.js';

// Firebase setup for hair.html (non-module page).
// We intentionally keep this tiny and only expose two functions.

let bridge = null;
let unsubscribeFn = null;

// TODO: Replace with your real config inside firebase-config.js usage.
// For now, we read from window.__FIREBASE_CONFIG__ if present.
function getConfig() {
  return window.__FIREBASE_CONFIG__ || null;
}

export async function ensureHairFirebase() {
  if (bridge) return bridge;
  const config = getConfig();
  if (!config) throw new Error('Missing window.__FIREBASE_CONFIG__');

  const res = FirebaseBridge.connectCloudNode(config, null);
  if (!res?.success) throw res?.error || new Error('FirebaseBridge.connectCloudNode failed');
  bridge = res;
  return bridge;
}

export async function pushHairLedgerToFirebase(payloadObj) {
  const b = await ensureHairFirebase();
  await b.bundle.pushStateToCloud(payloadObj);
}

export async function subscribeHairLedgerFromFirebase(onPayload) {
  // This project’s FirebaseBridge currently only supports push.
  // If/when subscription is added, wire it here.
  // For now: do one-time pull is not available from FirebaseBridge.
  // Caller should continue to use localStorage cache.
  return () => {};
}

