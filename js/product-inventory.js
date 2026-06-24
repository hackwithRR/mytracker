const INVENTORY_CACHE_KEY = 'nexus_product_inventory_v1';
const FIREBASE_INVENTORY_PATH = 'product_inventory_v1/user_state';

function parseNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function formatQty(amount, unit) {
  const a = Math.max(0, amount);
  if (!unit) return String(a);
  return `${trimTrailingZeros(a)} ${unit}`;
}

function trimTrailingZeros(n) {
  const s = String(n);
  if (!s.includes('.')) return s;
  return s.replace(/0+$/,'').replace(/\.$/,'');
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function isoToMs(iso) {
  if (!iso) return NaN;
  const ms = new Date(iso + 'T00:00:00').getTime();
  return ms;
}

function computeDailyConsumption(item) {
  const perUse = parseNumber(item.amountPerUse);
  const perDay = parseNumber(item.timesPerDay);
  const daily = perUse * perDay;
  return daily;
}

function computeDaysLeft(item) {
  const daily = computeDailyConsumption(item);
  const qty = parseNumber(item.stockQty);
  if (daily <= 0) return Infinity;
  return qty / daily;
}

function computeRestockThresholdDays(item) {
  // “gnptify me a week or earlier to restock” => default 7 days.
  // If user sets per-item threshold, use it.
  const t = parseNumber(item.restockInDays);
  return t > 0 ? t : 7;
}


function computeFreshnessWindowDays(item) {
  if (item.type !== 'spray') return null;
  if (!item.freshResetEnabled) return null;
  // Confirmed: remind at 4 days and show reminder at 5-day.
  const base4 = 4;
  const base5 = 5;
  return { days4: base4, days5: base5 };
}

function uidSafe(input) {
  return String(input).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}

function getInventory() {
  const raw = localStorage.getItem(INVENTORY_CACHE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function setInventory(inv) {
  localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(inv));
}

function upsertItem(inv, item) {
  const id = item.id || uidSafe(item.name + '_' + item.type);
  inv[id] = { ...item, id, updatedAt: new Date().toISOString() };
}

function removeAll() {
  localStorage.removeItem(INVENTORY_CACHE_KEY);
}

function exportInventory() {
  const inv = getInventory();
  const blob = new Blob([JSON.stringify(inv, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `product_inventory_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function syncInventoryFromFirebase() {
  try {
    if (!window.FirebaseBridge || typeof window.FirebaseBridge.connectCloudNode !== 'function') return;

    const res = window.FirebaseBridge.connectCloudNode(window.__FIREBASE_CONFIG__ || {});
    if (!res?.success || !res.bundle) return;

    const path = FIREBASE_INVENTORY_PATH;
    // FirebaseBridge.activePath is fixed; we temporarily push to it by overriding activePath.
    // Instead of changing FirebaseBridge, we do a minimal approach: read whole path stored in activePath.
    // Current FirebaseBridge expects activePath 'follicle_matrix_ledger/user_state'.
    // To avoid editing firebase-config.js, we keep this module local-only unless you want
    // to refactor FirebaseBridge.
    
    // Therefore: do local-only for now.
    return;
  } catch {
    return;
  }
}

function buildRow(item) {
  const daily = computeDailyConsumption(item);
  const daysLeft = computeDaysLeft(item);
  const threshold = computeRestockThresholdDays(item);

  const restockDue = daysLeft !== Infinity && daysLeft <= threshold;
  // Extra smart reminder for sprays/fresh items:
  // show “next day before” warning when daysLeft is within the last day (i.e., ≤1 day)
  // (this doesn’t replace restock; it complements it for sprays freshness cadence).
  const lastDayWarning = daysLeft !== Infinity && daysLeft <= 1 && item.type === 'spray';
  const overdue = daysLeft !== Infinity && daysLeft <= 0;


  const freshWindow = computeFreshnessWindowDays(item);
  let freshDue = false;
  let freshTag = '';
  if (freshWindow && daysLeft !== Infinity) {
    if (daysLeft <= freshWindow.days4 && daysLeft > freshWindow.days5) {
      // This range is unlikely since 4<5; keep generic.
    }
  }

  // Freshness is time since last refresh; however we don't track events yet.
  // We approximate using startDate as “freshness baseline”.
  // startDate should be the date you started this spray batch.
  const startMs = isoToMs(item.startDate);
  const elapsedDays = Number.isFinite(startMs) ? Math.floor((Date.now()-startMs)/86400000) : null;
  if (freshWindow && elapsedDays !== null) {
    if (elapsedDays >= freshWindow.days4 && elapsedDays < freshWindow.days5) {
      freshDue = true;
      freshTag = 'Refresh in ~4 days';
    } else if (elapsedDays >= freshWindow.days5) {
      freshDue = true;
      freshTag = 'Refresh now (5+ days)';
    } else if (elapsedDays === 3) {
      // early warning
    }
  }

  const daysLeftText = daysLeft === Infinity ? '—' : `${Math.max(0, daysLeft).toFixed(daysLeft < 10 ? 1 : 0)}`;
  const dailyText = daily <= 0 ? '—' : `${trimTrailingZeros(daily)} ${item.unit} / day`;

  const restockText = overdue ? 'Overdue' : (restockDue ? `≤ ${threshold} days` : `> ${threshold} days`);

  let freshText = '—';
  // If spray is in the last day, surface a “tomorrow/previous day” style reminder.
  if (lastDayWarning && freshText === '—') {
    freshText = 'Refresh tomorrow (1 day left)';
  }

  if (item.type === 'spray') {
    if (!item.freshResetEnabled) freshText = 'Freshness off';
    else if (elapsedDays === null) freshText = 'Set start date';
    else freshText = freshTag || `Elapsed: ${elapsedDays}d`;
  } else {
    freshText = 'N/A';
  }

  const accent = overdue ? 'border-rose-400/30 bg-rose-500/10 text-rose-100' : (restockDue ? 'border-amber-400/30 bg-amber-500/10 text-amber-100' : 'border-slate-900/60 bg-slate-950/40 text-slate-200');

  return `
    <tr class="align-top">
      <td class="px-3 py-3">
        <div class="font-hud font-bold text-slate-100">${escapeHtml(item.name)}</div>
        <div class="text-[11px] text-slate-500">${escapeHtml(item.category || 'General')} • ${escapeHtml(item.type)} • ${escapeHtml(item.unit)}</div>
      </td>

      <td class="px-3 py-3">
        <span class="inline-flex items-center px-2 py-1 rounded-md border border-slate-900/60 bg-slate-950/30">${formatQty(item.stockQty, item.unit)}</span>
      </td>
      <td class="px-3 py-3 text-slate-400">${dailyText}</td>
      <td class="px-3 py-3">
        <div class="px-2 py-1 rounded-md border ${accent}">
          <div class="font-hud font-black">${daysLeftText}</div>
          <div class="text-[11px] text-slate-400">days left</div>
        </div>
      </td>
      <td class="px-3 py-3 text-slate-300">
        <div class="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-slate-900/60 bg-slate-950/30">
          <i class="bi ${overdue ? 'bi-x-circle-fill text-rose-300' : (restockDue ? 'bi-bell-fill text-amber-300' : 'bi-check-circle-fill text-emerald-300')}"></i>
          <span class="font-hud font-bold">${escapeHtml(restockText)}</span>
        </div>
      </td>
      <td class="px-3 py-3 text-slate-300">
        <div class="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-slate-900/60 bg-slate-950/30">
          <i class="bi ${freshDue ? 'bi-droplet-half text-cyan-300' : 'bi-water text-slate-600'}"></i>
          <span class="font-hud font-bold">${escapeHtml(freshText)}</span>
        </div>
      </td>
      <td class="px-3 py-3 text-right">
        <button class="px-3 py-1.5 rounded-lg border border-slate-900/60 bg-slate-950/30 hover:bg-slate-950/70 hover:border-slate-800 text-[11px] text-slate-200" data-action="use" data-id="${escapeHtml(item.id)}">
          <i class="bi bi-plus-lg mr-1"></i> Used
        </button>
        <button class="ml-2 px-3 py-1.5 rounded-lg border border-slate-900/60 bg-slate-950/30 hover:bg-rose-500/10 hover:border-rose-400/30 text-[11px] text-slate-200" data-action="restock" data-id="${escapeHtml(item.id)}">
          <i class="bi bi-bag-plus mr-1"></i> Restock
        </button>
        <button class="ml-2 px-3 py-1.5 rounded-lg border border-slate-900/60 bg-slate-950/30 hover:bg-rose-500/10 hover:border-rose-400/30 text-[11px] text-rose-200" data-action="delete" data-id="${escapeHtml(item.id)}" title="Delete this item">
          <i class="bi bi-trash mr-1"></i> Delete
        </button>
      </td>

    </tr>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'<')
    .replace(/>/g,'>')
    .replace(/"/g,'"')
    .replace(/'/g,'&#039;');
}

function notifyBannerIfNeeded(itemsArr) {
  const banner = document.getElementById('alertBanner');
  const bannerText = document.getElementById('alertBannerText');
  const notifSummary = document.getElementById('notifSummary');

  const nowDue = [];
  for (const item of itemsArr) {
    const daysLeft = computeDaysLeft(item);
    const threshold = computeRestockThresholdDays(item);
    const restockDue = daysLeft !== Infinity && daysLeft <= threshold;

    const freshWindow = computeFreshnessWindowDays(item);
    const startMs = isoToMs(item.startDate);
    const elapsedDays = Number.isFinite(startMs) ? Math.floor((Date.now()-startMs)/86400000) : null;

    let freshDue = false;
    let freshLabel = '';
  if (freshWindow && elapsedDays !== null) {
    // We want reminders tied to the remaining time, not just elapsed.
    // Remaining days approx = freshWindow.days5 - elapsedDays.
    const remainingApprox = freshWindow.days5 - elapsedDays;

    if (remainingApprox <= 1 && remainingApprox >= 0) {
      freshDue = true;
      freshLabel = 'Refresh next day (previous day reminder)';
    } else if (remainingApprox <= 2 && remainingApprox > 1) {
      // ~4 days remaining corresponds to elapsed ~1 day? but keep stable:
      freshDue = true;
      freshLabel = 'Refresh soon (~4–5 day cadence)';
    }

    // Keep the original cadence tags too.
    if (elapsedDays >= freshWindow.days4 && elapsedDays < freshWindow.days5) {
      freshDue = true;
      freshLabel = 'Freshness ~4 days';
    } else if (elapsedDays >= freshWindow.days5) {
      freshDue = true;
      freshLabel = 'Freshness 5+ days';
    }
  }

    if (restockDue) nowDue.push({ item, kind: 'restock', label: `Restock ${Math.max(0, daysLeft).toFixed(1)}d left (≤ ${threshold})` });
    if (freshDue) nowDue.push({ item, kind: 'fresh', label: `Refresh spray (${freshLabel})` });
  }

  if (nowDue.length) {
    banner.classList.remove('hidden');
    const top3 = nowDue.slice(0,3).map(x => `${escapeHtml(x.item.name)}: ${escapeHtml(x.label)}`).join(' • ');
    bannerText.innerHTML = top3;
  } else {
    banner.classList.add('hidden');
    bannerText.textContent = '';
  }

  // Next notification summary (best-effort): sort restock by daysLeft, freshness by elapsed
  const restocks = [];
  const freshes = [];
  for (const item of itemsArr) {
    const daysLeft = computeDaysLeft(item);
    const threshold = computeRestockThresholdDays(item);
    if (daysLeft !== Infinity) {
      const restockAt = threshold;
      restocks.push({ item, when: daysLeft, threshold });
    }

    const freshWindow = computeFreshnessWindowDays(item);
    const startMs = isoToMs(item.startDate);
    const elapsedDays = Number.isFinite(startMs) ? Math.floor((Date.now()-startMs)/86400000) : null;
    if (freshWindow && elapsedDays !== null) freshes.push({ item, elapsedDays });
  }

  restocks.sort((a,b)=>a.when-b.when);
  freshes.sort((a,b)=>(b.elapsedDays - a.elapsedDays));

  const next = [];
  if (restocks[0] && restocks[0].when !== Infinity) {
    next.push(`Restock: ${restocks[0].item.name} in ${restocks[0].when.toFixed(1)}d`);
  }
  if (freshes[0] && restocks.length) {
    // Only show freshness if any spray has it enabled
    const bestFresh = freshes.find(x => x.item.freshResetEnabled);
    if (bestFresh) next.push(`Freshness: ${bestFresh.item.name} (elapsed ${bestFresh.elapsedDays}d)`);
  }

  notifSummary.textContent = next.length ? next.slice(0,2).join(' • ') : 'All items look stable.';
}

let __renderTimer = null;
function scheduleRenderTable() {
  if (__renderTimer) return;
  __renderTimer = setTimeout(() => {
    __renderTimer = null;
    renderTable();
  }, 150);
}

function renderTable() {
  const inv = getInventory();
  const itemsArr = Object.values(inv);

  const tblBody = document.getElementById('tblBody');
  if (!tblBody) return;

  tblBody.innerHTML = itemsArr.length ? itemsArr.map(buildRow).join('') : `
    <tr>
      <td colspan="7" class="px-3 py-10 text-center text-slate-500">
        No items yet. Add a product/spray on the left.
      </td>
    </tr>
  `;

  notifyBannerIfNeeded(itemsArr);

  // bind buttons
  tblBody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const item = inv[id];
      if (!item) return;

      if (action === 'use') {
        const amt = parseNumber(item.amountPerUse);
        const times = 1; // “Used” = one use event
        const dec = amt * times;
        item.stockQty = Math.max(0, parseNumber(item.stockQty) - dec);

        item.updatedAt = new Date().toISOString();
        inv[id] = item;
        setInventory(inv);
        scheduleRenderTable();
        return;
      }

      if (action === 'restock') {
        const add = parseNumber(item.restockAddQty);
        const promptStr = `Add how much stock for ${item.name}? (in ${item.unit})`;
        const val = add > 0 ? String(add) : window.prompt(promptStr, '100');
        if (val === null) return;
        const n = parseNumber(val);
        if (n <= 0) return;
        item.stockQty = parseNumber(item.stockQty) + n;
        item.updatedAt = new Date().toISOString();

        // If spray and you restock (new batch), reset startDate to today.
        if (item.type === 'spray') {
          item.startDate = todayISODate();
        }

        inv[id] = item;
        setInventory(inv);
        scheduleRenderTable();
        return;
      }

      if (action === 'delete') {
        const ok = window.confirm(`Delete ${item.name}? This cannot be undone.`);
        if (!ok) return;
        delete inv[id];
        setInventory(inv);
        scheduleRenderTable();
        return;
      }

    });
  });
}


function wireForm() {
  const btnSave = document.getElementById('btnSaveProduct');
  const btnClear = document.getElementById('btnClearAll');
  const btnExport = document.getElementById('btnExportProduct');
  const inpImportFile = document.getElementById('inpImportFile');

  if (btnExport) btnExport.addEventListener('click', exportInventory);

  if (btnClear) btnClear.addEventListener('click', () => {
    const ok = window.confirm('Clear all local product inventory data?');
    if (!ok) return;
    removeAll();
    renderTable();
  });

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const name = (document.getElementById('inpName')?.value || '').trim();
      const type = document.getElementById('selType')?.value || 'wash';
      const unit = document.getElementById('selUnit')?.value || 'ml';
      const category = document.getElementById('selCategory')?.value || 'general';

      const stockQty = parseNumber(document.getElementById('inpQty')?.value);
      const startDate = document.getElementById('inpStartDate')?.value || todayISODate();
      const amountPerUse = parseNumber(document.getElementById('inpPerUse')?.value);
      const timesPerDay = parseNumber(document.getElementById('inpTimesPerDay')?.value);
      const restockInDays = Math.max(1, Math.floor(parseNumber(document.getElementById('inpRestockDays')?.value)) || 7);

      const freshResetEnabled = !!document.getElementById('chkFreshReset')?.checked;

      if (!name) {
        window.alert('Enter product name');
        return;
      }
      if (amountPerUse <= 0 && timesPerDay <= 0) {
        window.alert('Enter amount per use and times per day');
        return;
      }

      const inv = getInventory();

      const item = {
        id: uidSafe(name + '_' + type + '_' + category),
        name,
        category,
        type,
        unit,
        stockQty,
        startDate,
        amountPerUse,
        timesPerDay,
        freshResetEnabled: type === 'spray' ? freshResetEnabled : false,
        restockInDays,
        updatedAt: new Date().toISOString()
      };

      upsertItem(inv, item);
      setInventory(inv);

      // If spray: auto-reset freshness baseline when you save the batch.
      if (type === 'spray') {
        item.startDate = startDate;
      }

      renderTable();
      // keep name but clear qty fields
      document.getElementById('inpQty').value = '';
      document.getElementById('inpPerUse').value = '';
      document.getElementById('inpTimesPerDay').value = '';
    });
  }

  if (inpImportFile) {
    inpImportFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (!parsed || typeof parsed !== 'object') throw new Error('bad');
          setInventory(parsed);
          renderTable();
        } catch {
          window.alert('Invalid product inventory JSON file');
        }
      };
      reader.readAsText(file);
    });
  }
}

function init() {
  wireForm();
  renderTable();
  // Optional future: firebase sync when you refactor FirebaseBridge activePath.
  // syncInventoryFromFirebase().then(()=>renderTable());

  // React when storage changes (multi-tab)
  window.addEventListener('storage', (e) => {
    if (e.key === INVENTORY_CACHE_KEY) renderTable();
  });
}

document.addEventListener('DOMContentLoaded', init);

