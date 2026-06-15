import { monthMetadata, labelDefinitions, calculateActionsForDay } from './data.js';
import { StorageEngine } from './storage.js';
import { FirebaseBridge } from './firebase-config.js';

let telemetryChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    setupAppNavigation();
    buildMatrixDomStructure();
    initCloudCredentialConfiguration();
    bindHardwareFunctionalListeners();
});

function setupAppNavigation() {
    const routingMap = [
        { btn: 'btnLaunchHair', target: 'viewHairLanding', hook: updatePerformanceMetricsDisplay },
        { btn: 'btnHairToMenu', target: 'viewMainMenu' },
        { btn: 'btnJumpToTracker', target: 'viewHairTracker', hook: updatePerformanceMetricsDisplay },
        { btn: 'btnTrackerToHair', target: 'viewHairLanding', hook: updatePerformanceMetricsDisplay }
    ];

    routingMap.forEach(route => {
        document.getElementById(route.btn)?.addEventListener('click', () => {
            document.querySelectorAll('.view-state').forEach(el => el.classList.remove('active'));
            document.getElementById(route.target)?.classList.add('active');
            if (route.hook) route.hook();
        });
    });

    document.getElementById('btnOpenDirectives')?.addEventListener('click', () => toggleModalView(true));
    document.getElementById('btnCloseDirectives')?.addEventListener('click', () => toggleModalView(false));
}

function toggleModalView(open) {
    const modal = document.getElementById('directivesModal');
    if (modal) open ? modal.classList.remove('hidden') : modal.classList.add('hidden');
}

function buildMatrixDomStructure() {
    const targetViewport = document.getElementById('trackerGridContainer');
    if (!targetViewport) return;

    let absoluteDayCounter = 1;
    let completeContainerHTML = '';

    monthMetadata.forEach(month => {
        let subGridHTML = '';

        for (let baseDayIdx = 1; baseDayIdx <= month.length; baseDayIdx++) {
            const targetedActions = calculateActionsForDay(absoluteDayCounter);
            let checkNodesHTML = '';

            targetedActions.forEach(token => {
                const DOM_ID = `m${month.id}-d${absoluteDayCounter}-${token}`;
                checkNodesHTML += `
                    <div class="relative w-full">
                        <input type="checkbox" id="${DOM_ID}" 
                               data-month="${month.id}" 
                               data-absolute-day="${absoluteDayCounter}" 
                               class="matrix-checkbox form-matrix-node-input hidden">
                        <label for="${DOM_ID}" class="flex items-center gap-2 p-1.5 rounded-md bg-slate-950/60 border border-slate-900/90 cursor-pointer select-none transition-all text-[11px] font-medium text-gray-400 hover:border-slate-700 w-full">
                            <span class="status-glow w-1.5 h-1.5 rounded-full bg-slate-800 transition-all duration-200"></span>
                            <span class="font-hud font-bold text-white/80 text-[10px]">[${token}]</span> ${labelDefinitions[token]}
                        </label>
                    </div>
                `;
            });

            let lockoutWarningLabel = targetedActions.includes('D')
                ? `<div class="mt-2 text-[9px] text-amber-400 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/40 font-hud text-center tracking-wider"><i class="bi bi-exclamation-triangle-fill mr-1"></i> SPRAY LOCKOUT</div>`
                : '';

            subGridHTML += `
                <div class="hud-glass rounded-xl p-3 flex flex-col justify-between border border-purple-950/40 transition-all duration-300" id="card-wrapper-day-${absoluteDayCounter}">
                    <div>
                        <div class="flex items-center justify-between mb-2 border-b border-slate-800/60 pb-1">
                            <span class="font-hud font-black text-xs text-cyan-400 tracking-wider">DAY ${String(absoluteDayCounter).padStart(3, '0')}</span>
                            <span class="text-[9px] font-code text-gray-500">M-${month.id}</span>
                        </div>
                        <div class="space-y-1">${checkNodesHTML}</div>
                    </div>
                    ${lockoutWarningLabel}
                </div>
            `;
            absoluteDayCounter++;
        } // FIX: Changed from }); to } to properly close the standard for-loop

        completeContainerHTML += `
            <section class="hud-glass p-5 rounded-2xl border border-purple-950/30 shadow-xl">
                <div class="mb-4 border-b border-purple-950/30 pb-3">
                    <h3 class="text-md font-bold font-hud text-slate-100 uppercase tracking-wide flex items-center gap-2.5">
                        <span class="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-cyan-400 to-purple-500"></span>
                        ${month.title}
                    </h3>
                    <p class="text-[11px] text-gray-400 font-code mt-1 leading-relaxed">${month.goal}</p>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">${subGridHTML}</div>
            </section>
        `;
    });

    targetViewport.innerHTML = completeContainerHTML;
    applySavedDataToInterface(StorageEngine.loadFromLocalDisk());
}

function applySavedDataToInterface(dataRegistry) {
    document.querySelectorAll('.form-matrix-node-input').forEach(box => {
        box.checked = !!dataRegistry[box.id];
    });
    
    for (let d = 1; d <= 152; d++) {
        syncCardWrapperStyling(d);
    }
    updatePerformanceMetricsDisplay();
}

function syncCardWrapperStyling(absoluteDayIdx) {
    const card = document.getElementById(`card-wrapper-day-${absoluteDayIdx}`);
    if (!card) return;
    
    const elements = card.querySelectorAll('.form-matrix-node-input');
    const checked = card.querySelectorAll('.form-matrix-node-input:checked');
    
    if (elements.length === checked.length && elements.length > 0) {
        card.style.borderColor = 'rgba(0, 242, 254, 0.45)';
        card.style.background = 'rgba(0, 242, 254, 0.03)';
    } else {
        card.style.borderColor = 'rgba(157, 78, 221, 0.15)';
        card.style.background = 'rgba(12, 8, 33, 0.45)';
    }
}

function bindHardwareFunctionalListeners() {
    document.querySelectorAll('.form-matrix-node-input').forEach(box => {
        box.addEventListener('change', (e) => {
            const absoluteDay = e.target.getAttribute('data-absolute-day');
            syncCardWrapperStyling(absoluteDay);
            
            const updatedPayload = {};
            document.querySelectorAll('.form-matrix-node-input').forEach(input => {
                updatedPayload[input.id] = input.checked;
            });
            StorageEngine.saveState(updatedPayload);
            updatePerformanceMetricsDisplay();
        });
    });

    document.getElementById('btnExportLedger')?.addEventListener('click', () => StorageEngine.exportToFile());
    document.getElementById('ledgerImporter')?.addEventListener('change', (e) => {
        StorageEngine.importFromFile(e.target.files[0], (err, payload) => {
            if (err) return alert("❌ Faulty JSON data configuration scheme structural layout.");
            applySavedDataToInterface(payload);
            alert("⚡ Internal local state records successfully updated!");