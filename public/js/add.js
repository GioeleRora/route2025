document.addEventListener('DOMContentLoaded', () => {
    const clanName = localStorage.getItem('currentClan');
    if (!clanName) {
        window.location.href = '/clan-select';
        return;
    }

    const navClanName = document.getElementById('nav-clan-name');
    if (navClanName) navClanName.textContent = clanName;

    const calendarContainer = document.getElementById('calendar');
    const selectedCounter = document.getElementById('selected-counter');
    const form = document.getElementById('availability-form');
    const submitBtn = document.getElementById('submit-btn');

    // Range picker banner elements
    const btnQuickRange = document.getElementById('btn-quick-range');
    const rangeBanner = document.getElementById('range-banner');
    const rangeBannerText = document.getElementById('range-banner-text');
    const btnCancelRange = document.getElementById('btn-cancel-range');

    const YEAR = 2026;

    // Interaction states
    let isMouseDragging = false;
    let mouseStartCell = null;
    let mouseSelectMode = true;

    // Range mode state
    let isRangeMode = false;
    let rangeStartCell = null;

    // Build the calendar
    buildCalendar();

    // ==========================================
    // Range Picker Tool (Mobile & Desktop)
    // ==========================================
    btnQuickRange?.addEventListener('click', () => {
        if (isRangeMode) {
            cancelRangeMode();
        } else {
            startRangeMode();
        }
    });

    btnCancelRange?.addEventListener('click', cancelRangeMode);

    function startRangeMode() {
        isRangeMode = true;
        rangeStartCell = null;
        if (rangeBanner) rangeBanner.style.display = 'flex';
        if (rangeBannerText) rangeBannerText.textContent = '👉 Tocca la prima data (inizio periodo)...';
        if (btnQuickRange) btnQuickRange.style.background = 'rgba(245, 158, 11, 0.25)';
    }

    function cancelRangeMode() {
        isRangeMode = false;
        if (rangeStartCell) {
            rangeStartCell.classList.remove('range-anchor');
            rangeStartCell = null;
        }
        if (rangeBanner) rangeBanner.style.display = 'none';
        if (btnQuickRange) btnQuickRange.style.background = '';
    }

    // ==========================================
    // Quick Actions
    // ==========================================
    document.getElementById('btn-quick-weekends')?.addEventListener('click', () => {
        cancelRangeMode();
        const days = calendarContainer.querySelectorAll('.calendar-day-cell:not(.placeholder):not(.disabled)');
        days.forEach(day => {
            const [y, m, d] = day.dataset.date.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                day.classList.add('selected');
            }
        });
        updateCounter();
        showToast('Weekend di Luglio e Agosto selezionati!', 'info');
    });

    document.getElementById('btn-quick-july')?.addEventListener('click', () => {
        cancelRangeMode();
        const days = calendarContainer.querySelectorAll('.calendar-day-cell.month-7:not(.disabled)');
        days.forEach(day => day.classList.add('selected'));
        updateCounter();
        showToast('Tutto il mese di Luglio selezionato!', 'info');
    });

    document.getElementById('btn-quick-august')?.addEventListener('click', () => {
        cancelRangeMode();
        const days = calendarContainer.querySelectorAll('.calendar-day-cell.month-8:not(.disabled)');
        days.forEach(day => day.classList.add('selected'));
        updateCounter();
        showToast('Tutto il mese di Agosto selezionato!', 'info');
    });

    document.getElementById('btn-quick-clear')?.addEventListener('click', () => {
        cancelRangeMode();
        const days = calendarContainer.querySelectorAll('.calendar-day-cell.selected');
        days.forEach(day => day.classList.remove('selected'));
        updateCounter();
        showToast('Selezione azzerata.', 'info');
    });

    // ==========================================
    // Calendar Generation
    // ==========================================
    function buildCalendar() {
        const headers = Array.from(calendarContainer.querySelectorAll('.calendar-header-cell'));
        calendarContainer.innerHTML = '';
        headers.forEach(h => calendarContainer.appendChild(h));

        // Monday-based offset for July 1st, 2026
        // Month index 6 = July in JS
        const firstDayOfWeek = new Date(YEAR, 6, 1).getDay();
        const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        for (let i = 0; i < offset; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'calendar-day-cell placeholder';
            calendarContainer.appendChild(placeholder);
        }

        // Generate July 1..31 and August 1..31 (62 days total)
        const allDays = [];
        for (let d = 1; d <= 31; d++) allDays.push({ month: 7, day: d });
        for (let d = 1; d <= 31; d++) allDays.push({ month: 8, day: d });

        allDays.forEach(({ month, day }) => {
            const dayCell = document.createElement('div');
            const dateString = `${YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            dayCell.className = `calendar-day-cell month-${month}`;
            dayCell.dataset.date = dateString;
            dayCell.textContent = day;

            // Add month indicator badge on the 1st of each month
            if (day === 1) {
                dayCell.classList.add('month-start');
                dayCell.dataset.monthLabel = month === 7 ? '1 Lug' : '1 Ago';
            }

            attachCellEvents(dayCell);
            calendarContainer.appendChild(dayCell);
        });

        updateCounter();
    }

    // ==========================================
    // Cell Interaction Events (Touch & Mouse Safe)
    // ==========================================
    function attachCellEvents(dayCell) {
        // --- TOUCH HANDLING (Mobile Safe: never conflicts with scrolling!) ---
        let touchStartX = 0;
        let touchStartY = 0;
        let isScrolling = false;

        dayCell.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            touchStartX = t.clientX;
            touchStartY = t.clientY;
            isScrolling = false;
        }, { passive: true });

        dayCell.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            const diffX = Math.abs(t.clientX - touchStartX);
            const diffY = Math.abs(t.clientY - touchStartY);
            // Finger moved more than 8px -> user is SCROLLING the page!
            if (diffX > 8 || diffY > 8) {
                isScrolling = true;
            }
        }, { passive: true });

        dayCell.addEventListener('touchend', (e) => {
            // If finger was scrolling, completely ignore and do not toggle day!
            if (isScrolling) return;

            e.preventDefault(); // Prevent synthesized mouse click
            handleDaySelection(dayCell);
        });

        // --- MOUSE HANDLING (Desktop) ---
        dayCell.addEventListener('mousedown', (e) => {
            // Only primary mouse button
            if (e.button !== 0) return;

            if (isRangeMode) {
                handleDaySelection(dayCell);
                return;
            }

            isMouseDragging = true;
            mouseStartCell = dayCell;
            mouseSelectMode = !dayCell.classList.contains('selected');
            toggleDay(dayCell, mouseSelectMode);
            updateCounter();
        });

        dayCell.addEventListener('mouseenter', () => {
            if (isMouseDragging && mouseStartCell && !isRangeMode) {
                selectRange(mouseStartCell, dayCell, mouseSelectMode);
                updateCounter();
            }
        });
    }

    // Global mouseup to release desktop drag
    document.addEventListener('mouseup', () => {
        isMouseDragging = false;
        mouseStartCell = null;
    });

    // Central day interaction (used by both Tap on touch and Click on desktop)
    function handleDaySelection(cell) {
        if (isRangeMode) {
            handleRangeModeSelection(cell);
            return;
        }

        // Standard single-day toggle
        const willSelect = !cell.classList.contains('selected');
        toggleDay(cell, willSelect);
        updateCounter();
    }

    function handleRangeModeSelection(cell) {
        if (!rangeStartCell) {
            // First date selected
            rangeStartCell = cell;
            cell.classList.add('range-anchor');
            if (rangeBannerText) {
                rangeBannerText.textContent = `📍 Inizio: ${formatShortDate(cell.dataset.date)}. Ora tocca la data di fine!`;
            }
        } else {
            // Second date selected: apply range!
            selectRange(rangeStartCell, cell, true);
            const d1 = formatShortDate(rangeStartCell.dataset.date);
            const d2 = formatShortDate(cell.dataset.date);

            showToast(`Periodo dal ${d1} al ${d2} selezionato!`, 'success');
            cancelRangeMode();
            updateCounter();
        }
    }

    function toggleDay(cell, select) {
        if (!cell || cell.classList.contains('placeholder') || cell.classList.contains('disabled')) return;
        if (select) {
            cell.classList.add('selected');
        } else {
            cell.classList.remove('selected');
        }
    }

    function selectRange(fromCell, toCell, select) {
        const allCells = Array.from(calendarContainer.querySelectorAll('.calendar-day-cell:not(.placeholder)'));
        const fromIdx = allCells.indexOf(fromCell);
        const toIdx = allCells.indexOf(toCell);

        if (fromIdx === -1 || toIdx === -1) return;

        const min = Math.min(fromIdx, toIdx);
        const max = Math.max(fromIdx, toIdx);

        for (let i = min; i <= max; i++) {
            toggleDay(allCells[i], select);
        }
    }

    function updateCounter() {
        const selected = calendarContainer.querySelectorAll('.calendar-day-cell.selected');
        if (selectedCounter) {
            selectedCounter.textContent = selected.length;
        }
    }

    function formatShortDate(dateStr) {
        const [, m, d] = dateStr.split('-');
        return `${d}/${m}`;
    }

    // ==========================================
    // Form Submission
    // ==========================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('name');
        const name = nameInput.value.trim();

        if (!name) {
            showToast('Inserisci un nome o soprannome valido.', 'error');
            nameInput.focus();
            return;
        }

        const selectedDays = Array.from(calendarContainer.querySelectorAll('.calendar-day-cell.selected'))
            .map(cell => cell.dataset.date);

        if (selectedDays.length === 0) {
            const proceed = confirm('Non hai selezionato nessun giorno disponibile. Vuoi procedere comunque?');
            if (!proceed) return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Salvataggio in corso...</span>';

        try {
            const response = await fetch('/api/availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    days: selectedDays,
                    clan: clanName
                })
            });

            const data = await response.json();

            if (response.ok) {
                showToast(`Disponibilità salvata per ${name}!`, 'success');
                setTimeout(() => {
                    window.location.href = '/results';
                }, 800);
            } else {
                showToast(data.error || 'Errore durante il salvataggio.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Conferma e Salva</span> <span>✓</span>';
            }
        } catch (error) {
            console.error('Error submitting availability:', error);
            showToast('Errore di connessione con il server.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Conferma e Salva</span> <span>✓</span>';
        }
    });

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