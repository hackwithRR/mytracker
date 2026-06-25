export function toast(message) {
  // Lightweight toast (no external deps)
  try {
    const existing = document.getElementById('nexusToast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'nexusToast';
    el.textContent = message;
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.bottom = '16px';
    el.style.transform = 'translateX(-50%)';
    el.style.zIndex = '999999';
    el.style.padding = '10px 14px';
    el.style.borderRadius = '12px';
    el.style.background = 'rgba(2, 1, 6, 0.8)';
    el.style.border = '1px solid rgba(0, 242, 254, 0.25)';
    el.style.color = '#e0f2fe';
    el.style.fontFamily = 'JetBrains Mono, monospace';
    el.style.fontSize = '12px';
    el.style.boxShadow = '0 10px 30px rgba(0,242,254,0.12)';
    document.body.appendChild(el);

    setTimeout(() => {
      try { el.remove(); } catch {}
    }, 2600);
  } catch {}
}

export function bindNotifToasts() {
  // If pages call schedule... they can dispatch these events.
  // Provide feedback without editing each page heavily.
  window.addEventListener('nexus-notif:toast', (e) => {
    toast(e?.detail?.message || '');
  });
}

