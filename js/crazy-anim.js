const CrazyAnim = (() => {
  const CANVAS_ID = 'crazyAnimCanvas';
  const OVERLAY_ID = 'crazyAnimOverlay';

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function getPageId() {
    const el = document.querySelector('[data-crazy-page]');
    return el?.getAttribute?.('data-crazy-page') || 'home';
  }


  function ensureRootLayers() {
    // Canvas background
    let canvas = document.getElementById(CANVAS_ID);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = CANVAS_ID;
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '-1';
      canvas.style.pointerEvents = 'none';
      document.documentElement.appendChild(canvas);
    }

    // Portal/transition overlay
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '9999';
      overlay.style.pointerEvents = 'none';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 240ms ease';
      overlay.style.background =
        'radial-gradient(circle at 50% 50%, rgba(255,0,127,0.20), rgba(0,242,254,0.10) 35%, rgba(0,0,0,0) 60%)';

      overlay.innerHTML = `
        <div style="position:absolute;inset:-20%;background:
          conic-gradient(from 180deg, rgba(0,242,254,0.0), rgba(0,242,254,0.20), rgba(255,0,127,0.18), rgba(168,85,247,0.0));
          filter: blur(18px) saturate(140%);
          transform: translateZ(0);
          opacity:.85;
          animation: crazySpin 1100ms linear infinite;"></div>
        <div style="position:absolute;inset:0; background: linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.55));"></div>
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
          padding:14px 18px;border-radius:16px;
          font-family: Orbitron, ui-sans-serif, system-ui;
          letter-spacing: .18em;
          color: rgba(240,248,255,0.92);
          text-transform: uppercase;
          border:1px solid rgba(255,255,255,0.10);
          background: rgba(10,8,24,0.35);
          box-shadow: 0 0 30px rgba(0,242,254,0.12);
          backdrop-filter: blur(10px);
          opacity:.95;">
          <span style="font-size:12px">ENERGY WIPE</span>
        </div>
      `;
      overlay.style.display = 'block';

      document.documentElement.appendChild(overlay);
    }

    // Ensure keyframes exist
    if (!document.getElementById('crazyAnimKeyframes')) {
      const style = document.createElement('style');
      style.id = 'crazyAnimKeyframes';
      style.textContent = `
        @keyframes crazySpin { from{ transform: rotate(0deg);} to{ transform: rotate(360deg);} }
        @keyframes crazyScan { 0%{ transform: translateY(-30%); opacity:.0;} 15%{opacity:.45;} 70%{opacity:.22;} 100%{ transform: translateY(30%); opacity:0;} }
      `;
      document.head.appendChild(style);
    }

    return { canvas: document.getElementById(CANVAS_ID), overlay: document.getElementById(OVERLAY_ID) };
  }

  function getAccent() {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
    return accent || '#00f2fe';
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { r: 0, g: 242, b: 254 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }

  function setMode() {
    // each page can set data-crazy-page="home|hair|face|beard|product"
    const pid = getPageId();
    const root = document.documentElement;
    const map = {
      home: { a: '#00f2fe', b: '#ff007f' },
      hair: { a: '#00f2fe', b: '#a855f7' },
      face: { a: '#ff007f', b: '#00f2fe' },
      beard: { a: '#f59e0b', b: '#ff007f' },
      product: { a: '#bc00dd', b: '#00f2fe' }
    };
    const m = map[pid] || map.home;
    root.style.setProperty('--accent-color', m.a);
    root.style.setProperty('--accent-glow', 'rgba(0,0,0,0.0)');
    root.style.setProperty('--crazy-alt-color', m.b);
    return pid;
  }

  function startBackground() {
    if (prefersReducedMotion()) return;

    setMode();


    const { canvas } = ensureRootLayers();
    const ctx = canvas.getContext('2d');

    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0;

    const particles = [];
    const MAX = 120;

    function resize() {
      w = Math.max(320, window.innerWidth);
      h = Math.max(320, window.innerHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';

      particles.length = 0;
      const count = Math.floor(MAX * Math.min(1, (w * h) / (1200 * 800)));
      for (let i = 0; i < count; i++) {
        particles.push(makeParticle(i));
      }
    }

    function makeParticle(i) {
      const accentHex = getAccent();
      const rgb = hexToRgb(accentHex);
      const t = i / Math.max(1, particles.length);
      const speed = 0.18 + Math.random() * 0.55;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        size: 0.6 + Math.random() * 1.8,
        hue: (rgb.r + rgb.g + rgb.b) / 6 + 40 * t,
        life: 0.4 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2
      };
    }

    let last = performance.now();
    let raf = 0;

    function render(now) {
      const dt = Math.min(40, now - last);
      last = now;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // translucent fade
      ctx.fillStyle = 'rgba(1,2,4,0.18)';
      ctx.fillRect(0, 0, w, h);

      const accent = getAccent();
      const rgbA = hexToRgb(accent);
      ctx.strokeStyle = `rgba(${rgbA.r},${rgbA.g},${rgbA.b},0.20)`;
      ctx.lineWidth = 1;

      // draw mode-specific warp lines
      const pid = getPageId();
      const lineCount = pid === 'product' ? 8 : (pid === 'face' ? 6 : (pid === 'beard' ? 5 : 5));
      const wiggle = pid === 'beard' ? 28 : (pid === 'face' ? 26 : 18);

      for (let i = 0; i < lineCount; i++) {
        const y = (h * (i + 1)) / (lineCount + 1) + Math.sin(now / 800 + i) * wiggle;
        ctx.beginPath();
        ctx.moveTo(-40, y);
        ctx.bezierCurveTo(w * 0.25, y + 20, w * 0.55, y - 20, w + 40, y);
        ctx.stroke();
      }

      // particles
      for (const p of particles) {
        const alpha = 0.12 + 0.25 * Math.sin(now / 900 + p.phase) + 0.12 * p.life;
        const r = p.size * (0.6 + p.z);
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        ctx.fillStyle = `rgba(${rgbA.r},${rgbA.g},${rgbA.b},${Math.max(0, Math.min(0.55, alpha))})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        // occasional connections
        if (Math.random() < 0.015) {
          ctx.strokeStyle = `rgba(${rgbA.r},${rgbA.g},${rgbA.b},0.18)`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + (Math.random() - 0.5) * 160, p.y + (Math.random() - 0.5) * 80);
          ctx.stroke();
        }
      }

      // scanline flash (mode tuned)
      const pid = getPageId();
      const scanChance = pid === 'home' ? 0.03 : (pid === 'hair' ? 0.04 : (pid === 'face' ? 0.05 : (pid === 'beard' ? 0.025 : 0.035)));
      if (Math.random() < scanChance) {
        ctx.fillStyle = 'rgba(255,0,127,0.05)';
        const y = Math.random() * h;
        ctx.fillRect(0, y, w, 2);
      }

      raf = requestAnimationFrame(render);
    }

    resize();
    window.addEventListener('resize', () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      resize();
    });
    raf = requestAnimationFrame(render);

    return () => cancelAnimationFrame(raf);
  }

  function portalWipe(nextFn) {
    const { overlay } = ensureRootLayers();
    if (!overlay) {
      if (nextFn) nextFn();
      return;
    }

    const reduced = prefersReducedMotion();
    overlay.style.opacity = reduced ? '0' : '1';

    // quick scanline effect
    const scan = document.createElement('div');
    scan.style.position = 'fixed';
    scan.style.left = '0';
    scan.style.top = '-30%';
    scan.style.width = '100%';
    scan.style.height = '35%';
    scan.style.zIndex = '10000';
    scan.style.pointerEvents = 'none';
    scan.style.background = 'linear-gradient(180deg, rgba(255,0,127,0.0), rgba(0,242,254,0.20), rgba(255,0,127,0.0))';
    scan.style.filter = 'blur(0.6px)';
    scan.style.animation = 'crazyScan 500ms ease-in-out forwards';
    document.documentElement.appendChild(scan);

    const t = reduced ? 60 : 360;
    setTimeout(() => {
      if (scan && scan.parentNode) scan.parentNode.removeChild(scan);
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 240ms ease';
      if (nextFn) nextFn();
    }, t);
  }

  function bindPortalLinks() {
    // Wrap normal <a href> clicks with an overlay wipe.
    // Only handles same-origin links.
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a || !a.getAttribute) return;
      const href = a.getAttribute('href');
      if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('http')) return;

      // skip if explicitly opted out
      if (a.dataset && a.dataset.portal === 'off') return;

      e.preventDefault();
      const target = a.getAttribute('target');
      portalWipe(() => {
        if (target === '_blank') window.open(href, '_blank');
        else window.location.href = href;
      });
    }, { capture: true });
  }

  function init() {
    // mount CSS-less behavior; css lives in app.css
    ensureRootLayers();
    bindPortalLinks();
    startBackground();

    // add overlay-based scanline on focus changes (micro delight)
    document.addEventListener('visibilitychange', () => {
      // noop: background is already managed by render
    });

    // also set an accent default if page didn't define
    const root = document.documentElement;
    if (!root.style.getPropertyValue('--accent-color')) {
      root.style.setProperty('--accent-color', '#00f2fe');
    }
  }

  return { init, portalWipe };
})();

// Support both module and classic script usage.
try {
  window.CrazyAnim = CrazyAnim;
} catch {}

export { CrazyAnim };

