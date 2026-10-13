document.addEventListener('DOMContentLoaded', async () => {
    const clanName = localStorage.getItem('currentClan');
    if (!clanName) {
        window.location.href = '/clan-select';
        return;
    }

    const navClanName = document.getElementById('nav-clan-name');
    if (navClanName) navClanName.textContent = clanName;

    const calendarContainer = document.getElementById('calendar');
    const slotContent = document.getElementById('slot-content');
    const minSlotDaysInput = document.getElementById('min-slot-days');
    const applySlotDaysButton = document.getElementById('apply-slot-days');
    const copyWhatsappBtn = document.getElementById('copy-whatsapp-btn');

    // Modal elements
    const dayModal = document.getElementById('day-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalDismissBtn = document.getElementById('modal-dismiss-btn');
    const modalDateTitle = document.getElementById('modal-date-title');
    const modalRatioLabel = document.getElementById('modal-ratio-label');
    const modalProgressBar = document.getElementById('modal-progress-bar');
    const modalPresentCount = document.getElementById('modal-present-count');
    const modalPresentList = document.getElementById('modal-present-list');
    const modalAbsentCount = document.getElementById('modal-absent-count');
    const modalAbsentList = document.getElementById('modal-absent-list');

    const YEAR = 2026;
    const startDate = new Date(`${YEAR}-07-01`);
    const endDate = new Date(`${YEAR}-08-31`);

    let availabilities = [];
    let dateRange = [];
    let daysCount = {};
    let membersByDay = {};
    let currentBestSlotSummary = null;

    try {
        const response = await fetch(`/api/availability?clan=${encodeURIComponent(clanName)}`, {
            cache: 'no-cache'
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        availabilities = await response.json();
        renderHeatmapAndSlots();

    } catch (error) {
        console.error('Error loading results:', error);
        slotContent.innerHTML = '<p style="color: var(--danger);">Errore nel caricamento delle disponibilità.</p>';
        showToast('Errore durante il caricamento dei dati.', 'error');
    }

    function renderHeatmapAndSlots() {
        const totalRespondents = availabilities.length;

        // Reset tracking structures
        daysCount = {};
        membersByDay = {};
        dateRange = [];

        // Build list of dates
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            dateRange.push(dateStr);
            daysCount[dateStr] = 0;
            membersByDay[dateStr] = { present: [], absent: [] };
        }

        // Aggregate presence
        availabilities.forEach(person => {
            const personDays = Array.isArray(person.days) ? person.days : [];
            dateRange.forEach(dateStr => {
                if (personDays.includes(dateStr)) {
                    daysCount[dateStr] = (daysCount[dateStr] || 0) + 1;
                    membersByDay[dateStr].present.push(person.name);
                } else {
                    membersByDay[dateStr].absent.push(person.name);
                }
            });
        });

        // Compute best slot first so we can mark cells
        const minDays = Math.max(2, Math.min(31, parseInt(minSlotDaysInput.value, 10) || 6));
        const bestSlots = calculateBestSlots(minDays);

        // Highlight set for calendar
        const bestSlotDaysSet = new Set();
        if (bestSlots.length > 0) {
            bestSlots[0].slot.forEach(day => bestSlotDaysSet.add(day));
        }

        // Render Calendar
        const headers = Array.from(calendarContainer.querySelectorAll('.calendar-header-cell'));
        calendarContainer.innerHTML = '';
        headers.forEach(h => calendarContainer.appendChild(h));

        const firstDayOfWeek = startDate.getDay();
        const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        for (let i = 0; i < offset; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'calendar-day-cell placeholder';
            calendarContainer.appendChild(placeholder);
        }

        dateRange.forEach(dateStr => {
            const d = new Date(dateStr);
            const dayCell = document.createElement('div');
            const month = d.getMonth() + 1;
            const count = daysCount[dateStr] || 0;
            const ratio = totalRespondents > 0 ? count / totalRespondents : 0;

            dayCell.className = `calendar-day-cell heatmap-cell month-${month}`;
            dayCell.dataset.date = dateStr;

            if (bestSlotDaysSet.has(dateStr)) {
                dayCell.classList.add('in-best-slot');
            }

            // Heatmap color calculation
            if (totalRespondents > 0) {
                const alpha = Math.min(0.9, 0.05 + (ratio * 0.85));
                dayCell.style.backgroundColor = `rgba(16, 185, 129, ${alpha})`;
                dayCell.style.borderColor = ratio > 0.5 
                    ? `rgba(52, 211, 153, ${0.3 + (ratio * 0.7)})` 
                    : 'var(--border-subtle)';
                if (ratio >= 0.7) {
                    dayCell.style.color = '#ffffff';
                    dayCell.style.fontWeight = '700';
                }
            }

            dayCell.innerHTML = `
                <span>${d.getDate()}</span>
                <span class="day-count-badge" style="color: ${ratio > 0.6 ? '#d1fae5' : 'var(--text-muted)'};">
                    ${count}${totalRespondents > 0 ? `/${totalRespondents}` : ''}
                </span>
            `;

            dayCell.title = `${formatDateItalian(dateStr)}: ${count} presenti su ${totalRespondents}`;
            dayCell.addEventListener('click', () => openDayModal(dateStr, count, totalRespondents));

            calendarContainer.appendChild(dayCell);
        });

        // Display Best Slots in Hero Card
        renderBestSlotsUI(bestSlots, totalRespondents);
    }

    // Smart Slot Calculation with graceful fallback if no 100% full attendance exists
    function calculateBestSlots(N) {
        if (availabilities.length === 0 || dateRange.length < N) return [];

        let bestSlots = [];
        let maxFullyAvailable = -1;
        let bestMean = -1;

        for (let i = 0; i <= dateRange.length - N; i++) {
            let slot = dateRange.slice(i, i + N);

            // Count who is available every single day of this candidate slot
            const fullyAvailable = availabilities.filter(p => {
                const pDays = Array.isArray(p.days) ? p.days : [];
                return slot.every(d => pDays.includes(d));
            }).length;

            const mean = slot.reduce((sum, d) => sum + (daysCount[d] || 0), 0) / N;

            // Expand window dynamically if adjacent days have >= fullyAvailable
            let start = i;
            let end = i + N - 1;

            while (start > 0) {
                const prevDay = dateRange[start - 1];
                const expanded = [prevDay, ...slot];
                const countExp = availabilities.filter(p => expanded.every(d => p.days.includes(d))).length;
                if (countExp >= fullyAvailable && fullyAvailable > 0) {
                    start--;
                    slot = expanded;
                } else {
                    break;
                }
            }

            while (end < dateRange.length - 1) {
                const nextDay = dateRange[end + 1];
                const expanded = [...slot, nextDay];
                const countExp = availabilities.filter(p => expanded.every(d => p.days.includes(d))).length;
                if (countExp >= fullyAvailable && fullyAvailable > 0) {
                    end++;
                    slot = expanded;
                } else {
                    break;
                }
            }

            const slotKey = `${slot[0]}_${slot[slot.length - 1]}`;

            if (fullyAvailable > maxFullyAvailable) {
                maxFullyAvailable = fullyAvailable;
                bestMean = mean;
                bestSlots = [{ slot, fullyAvailable, mean, key: slotKey }];
            } else if (fullyAvailable === maxFullyAvailable) {
                if (mean > bestMean) {
                    bestMean = mean;
                    bestSlots = [{ slot, fullyAvailable, mean, key: slotKey }];
                } else if (Math.abs(mean - bestMean) < 0.05 && !bestSlots.some(s => s.key === slotKey)) {
                    bestSlots.push({ slot, fullyAvailable, mean, key: slotKey });
                }
            }
        }

        return bestSlots;
    }

    function renderBestSlotsUI(bestSlots, totalRespondents) {
        if (!bestSlots || bestSlots.length === 0 || totalRespondents === 0) {
            slotContent.innerHTML = `
                <div style="color: var(--text-secondary); padding: 12px 0;">
                    Nessuna disponibilità registrata per questo Clan.<br>
                    <a href="/add" class="btn btn-sm btn-primary" style="margin-top: 12px;">Aggiungi la prima risposta →</a>
                </div>
            `;
            currentBestSlotSummary = null;
            return;
        }

        let html = '';
        bestSlots.slice(0, 3).forEach((item, idx) => {
            const { slot, fullyAvailable, mean } = item;
            const firstDate = formatShortDate(slot[0]);
            const lastDate = formatShortDate(slot[slot.length - 1]);
            const duration = slot.length;
            const pct = totalRespondents > 0 ? Math.round((fullyAvailable / totalRespondents) * 100) : 0;

            html += `
                <div class="slot-item-result">
                    <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent-light); font-weight: 700;">Opzione ${idx + 1} (${duration} giorni)</div>
                    <div class="slot-item-dates">Dal ${firstDate} al ${lastDate}</div>
                    <div class="slot-item-stats">
                        <span>👥 Presenti al 100%: <strong>${fullyAvailable} su ${totalRespondents} (${pct}%)</strong></span>
                        <span>📊 Media giornaliera: <strong>${mean.toFixed(1)} presenze</strong></span>
                    </div>
                </div>
            `;
        });

        slotContent.innerHTML = html;

        // Save summary for WhatsApp
        const top = bestSlots[0];
        currentBestSlotSummary = {
            startDate: formatShortDate(top.slot[0]),
            endDate: formatShortDate(top.slot[top.slot.length - 1]),
            duration: top.slot.length,
            fullyAvailable: top.fullyAvailable,
            total: totalRespondents,
            pct: Math.round((top.fullyAvailable / totalRespondents) * 100),
            mean: top.mean.toFixed(1)
        };
    }

    // Modal Interaction
    function openDayModal(dateStr, count, totalRespondents) {
        const info = membersByDay[dateStr] || { present: [], absent: [] };
        const pct = totalRespondents > 0 ? Math.round((count / totalRespondents) * 100) : 0;

        modalDateTitle.textContent = formatDateItalian(dateStr);
        modalRatioLabel.textContent = `${count} su ${totalRespondents} presenti (${pct}%)`;
        modalProgressBar.style.width = `${pct}%`;

        modalPresentCount.textContent = `(${info.present.length})`;
        modalAbsentCount.textContent = `(${info.absent.length})`;

        // Present list
        if (info.present.length > 0) {
            modalPresentList.innerHTML = info.present
                .map(name => `<span class="name-badge present">✓ ${name}</span>`)
                .join('');
        } else {
            modalPresentList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">Nessun partecipante disponibile</span>';
        }

        // Absent list
        if (info.absent.length > 0) {
            modalAbsentList.innerHTML = info.absent
                .map(name => `<span class="name-badge absent">✕ ${name}</span>`)
                .join('');
        } else {
            modalAbsentList.innerHTML = '<span style="color: var(--primary-light); font-size: 0.85rem; font-style: italic;">Tutto il Clan è presente! 🎉</span>';
        }

        dayModal.classList.add('active');
    }

    function closeDayModal() {
        dayModal.classList.remove('active');
    }

    modalCloseBtn?.addEventListener('click', closeDayModal);
    modalDismissBtn?.addEventListener('click', closeDayModal);
    dayModal?.addEventListener('click', (e) => {
        if (e.target === dayModal) closeDayModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dayModal.classList.contains('active')) {
            closeDayModal();
        }
    });

    // Recompute on days control
    applySlotDaysButton?.addEventListener('click', renderHeatmapAndSlots);
    minSlotDaysInput?.addEventListener('change', renderHeatmapAndSlots);

    // Share on WhatsApp
    copyWhatsappBtn?.addEventListener('click', () => {
        if (!currentBestSlotSummary) {
            showToast('Nessun dato di slot calcolato da condividere.', 'error');
            return;
        }

        const text = 
`🏕️ *PROPOSTA DATE ROUTE 2026 - Clan ${clanName}*

🏆 *Miglior periodo (${currentBestSlotSummary.duration} giorni):*
Dal ${currentBestSlotSummary.startDate} al ${currentBestSlotSummary.endDate}

👥 *Presenti al 100%:* ${currentBestSlotSummary.fullyAvailable} su ${currentBestSlotSummary.total} (${currentBestSlotSummary.pct}%)
📊 *Media presenze:* ${currentBestSlotSummary.mean} persone/giorno

Visualizza la mappa completa o aggiorna le tue date:
${window.location.origin}/results`;

        navigator.clipboard.writeText(text).then(() => {
            showToast('Riassunto copiato negli appunti! Incollalo su WhatsApp.', 'success');
        }).catch(() => {
            // Fallback for older browsers
            prompt('Copia il seguente testo per WhatsApp:', text);
        });
    });

    // Helper date formatters
    function formatDateItalian(dateString) {
        const [y, m, d] = dateString.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function formatShortDate(dateString) {
        const [, m, d] = dateString.split('-');
        return `${d}/${m}`;
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
});
