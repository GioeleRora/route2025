document.addEventListener('DOMContentLoaded', async () => {
    const clanName = localStorage.getItem('currentClan');
    if (!clanName) {
        window.location.href = '/clan-select';
        return;
    }

    const navClanName = document.getElementById('nav-clan-name');
    if (navClanName) navClanName.textContent = clanName;

    const memberSelect = document.getElementById('member-select');
    const editorCard = document.getElementById('editor-card');
    const currentUserDisplay = document.getElementById('current-user-display');
    const calendarContainer = document.getElementById('calendar');
    const selectedCounter = document.getElementById('selected-counter');
    const updateBtn = document.getElementById('update-btn');

    // Range picker banner elements
    const btnQuickRange = document.getElementById('btn-quick-range');
    const rangeBanner = document.getElementById('range-banner');
    const rangeBannerText = document.getElementById('range-banner-text');
    const btnCancelRange = document.getElementById('btn-cancel-range');

    const YEAR = 2026;

    let currentSelectedMember = null;
    let isMouseDragging = false;
    let mouseStartCell = null;
    let mouseSelectMode = true;

    // Range mode state
    let isRangeMode = false;
    let rangeStartCell = null;

    // Load registered members into select
    loadMembers();

    async function loadMembers() {
        try {
            const response = await fetch(`/api/members?clan=${encodeURIComponent(clanName)}`);
            const data = await response.json();
            const members = data.members || [];

            memberSelect.innerHTML = '<option value="">-- Seleziona il tuo nome --</option>';

            if (members.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Nessun partecipante registrato. Aggiungi prima la tua disponibilità!';
                opt.disabled = true;
                memberSelect.appendChild(opt);
                return;
            }

            members.forEach(member => {
                const opt = document.createElement('option');
                opt.value = member.name;
                opt.textContent = `${member.name} (${member.day_count} giorni)`;
                memberSelect.appendChild(opt);
            });
        } catch (err) {
            console.error('Error loading members:', err);
            memberSelect.innerHTML = '<option value="">Errore nel caricamento partecipanti</option>';
            showToast('Impossibile caricare l\'elenco dei partecipanti.', 'error');
        }
    }

    // Member select change handler
    memberSelect.addEventListener('change', async () => {
        cancelRangeMode();
        const selectedName = memberSelect.value.trim();
        if (!selectedName) {
            editorCard.style.display = 'none';
            currentSelectedMember = null;
            return;
        }

        try {
            const response = await fetch(`/api/user/${encodeURIComponent(selectedName)}?clan=${encodeURIComponent(clanName)}`);
            if (!response.ok) {
                showToast(`Nessun dato trovato per "${selectedName}".`, 'error');
                editorCard.style.display = 'none';
                return;
            }

            const userData = await response.json();
            currentSelectedMember = userData.name;
            currentUserDisplay.textContent = userData.name;
            editorCard.style.display = 'block';

            buildCalendar(userData.days || []);
            showToast(`Dati caricati per ${userData.name}. Puoi modificare le date.`, 'info');
        } catch (err) {
            console.error('Error fetching user data:', err);
            showToast('Errore durante il recupero dei dati.', 'error');
        }
    });

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
            const dayOfWeek = dateObj.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                day.classList.add('selected');
            }
        });
        updateCounter();
        showToast('Weekend selezionati!', 'info');
    });

    document.getElementById('btn-quick-july')?.addEventListener('click', () => {
        cancelRangeMode();
        const days = calendarContainer.querySelectorAll('.calendar-day-cell.month-7:not(.disabled)');
        days.forEach(day => day.classList.add('selected'));
        updateCounter();
        showToast('Tutto Luglio selezionato!', 'info');
    });

    document.getElementById('btn-quick-august')?.addEventListener('click', () => {
        cancelRangeMode();
        const days = calendarContainer.querySelectorAll('.calendar-day-cell.month-8:not(.disabled)');
        days.forEach(day => day.classList.add('selected'));
        updateCounter();
        showToast('Tutto Agosto selezionato!', 'info');
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
    function buildCalendar(selectedDates) {
        const headers = Array.from(calendarContainer.querySelectorAll('.calendar-header-cell'));
        calendarContainer.innerHTML = '';
        headers.forEach(h => calendarContainer.appendChild(h));

        // Monday-based offset for July 1st, 2026
        const firstDayOfWeek = new Date(YEAR, 6, 1).getDay();
        const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        for (let i = 0; i < offset; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'calendar-day-cell placeholder';
            calendarContainer.appendChild(placeholder);
        }

        const allDays = [];
        for (let d = 1; d <= 31; d++) allDays.push({ month: 7, day: d });
        for (let d = 1; d <= 31; d++) allDays.push({ month: 8, day: d });

        allDays.forEach(({ month, day }) => {
            const dayCell = document.createElement('div');
            const dateString = `${YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            dayCell.className = `calendar-day-cell month-${month}`;
            dayCell.dataset.date = dateString;
            dayCell.textContent = day;

            if (day === 1) {
                dayCell.classList.add('month-start');
                dayCell.dataset.monthLabel = month === 7 ? '1 Lug' : '1 Ago';
            }

            if (selectedDates.includes(dateString)) {
                dayCell.classList.add('selected');
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
            if (diffX > 8 || diffY > 8) {
                isScrolling = true;
            }
        }, { passive: true });

        dayCell.addEventListener('touchend', (e) => {
            if (isScrolling) return;

            e.preventDefault();
            handleDaySelection(dayCell);
        });

        dayCell.addEventListener('mousedown', (e) => {
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

    document.addEventListener('mouseup', () => {
        isMouseDragging = false;
        mouseStartCell = null;
    });

    function handleDaySelection(cell) {
        if (isRangeMode) {
            handleRangeModeSelection(cell);
            return;
        }

        const willSelect = !cell.classList.contains('selected');
        toggleDay(cell, willSelect);
        updateCounter();
    }

    function handleRangeModeSelection(cell) {
        if (!rangeStartCell) {
            rangeStartCell = cell;
            cell.classList.add('range-anchor');
            if (rangeBannerText) {
                rangeBannerText.textContent = `📍 Inizio: ${formatShortDate(cell.dataset.date)}. Ora tocca la data di fine!`;
            }
        } else {
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
    // Submit Update
    // ==========================================
    updateBtn.addEventListener('click', async () => {
        if (!currentSelectedMember) {
            showToast('Nessun partecipante selezionato.', 'error');
            return;
        }

        const selectedDays = Array.from(calendarContainer.querySelectorAll('.calendar-day-cell.selected'))
            .map(cell => cell.dataset.date);

        updateBtn.disabled = true;
        updateBtn.innerHTML = '<span>Aggiornamento in corso...</span>';

        try {
            const response = await fetch('/api/availability', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: currentSelectedMember,
                    days: selectedDays,
                    clan: clanName
                })
            });

            const data = await response.json();

            if (response.ok) {
                showToast(`Disponibilità aggiornata per ${currentSelectedMember}!`, 'success');
                setTimeout(() => {
                    window.location.href = '/results';
                }, 800);
            } else {
                showToast(data.error || 'Errore durante l\'aggiornamento.', 'error');
                updateBtn.disabled = false;
                updateBtn.innerHTML = '<span>Salva Modifiche</span> <span>✓</span>';
            }
        } catch (error) {
            console.error('Error updating availability:', error);
            showToast('Errore di rete durante il salvataggio.', 'error');
            updateBtn.disabled = false;
            updateBtn.innerHTML = '<span>Salva Modifiche</span> <span>✓</span>';
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
