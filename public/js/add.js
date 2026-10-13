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

    // Year and Date Range
    const YEAR = 2026;
    const startDate = new Date(`${YEAR}-07-01`);
    const endDate = new Date(`${YEAR}-08-31`);

    let isDragging = false;
    let startDayCell = null;
    let isSelectMode = true;

    // Build the calendar
    buildCalendar();

    // Quick Actions
    document.getElementById('btn-quick-weekends')?.addEventListener('click', () => {
        const days = calendarContainer.querySelectorAll('.calendar-day-cell:not(.placeholder):not(.disabled)');
        days.forEach(day => {
            const date = new Date(day.dataset.date);
            const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                day.classList.add('selected');
            }
        });
        updateCounter();
    });

    document.getElementById('btn-quick-july')?.addEventListener('click', () => {
        const days = calendarContainer.querySelectorAll('.calendar-day-cell.month-7:not(.disabled)');
        days.forEach(day => day.classList.add('selected'));
        updateCounter();
    });

    document.getElementById('btn-quick-august')?.addEventListener('click', () => {
        const days = calendarContainer.querySelectorAll('.calendar-day-cell.month-8:not(.disabled)');
        days.forEach(day => day.classList.add('selected'));
        updateCounter();
    });

    document.getElementById('btn-quick-clear')?.addEventListener('click', () => {
        const days = calendarContainer.querySelectorAll('.calendar-day-cell.selected');
        days.forEach(day => day.classList.remove('selected'));
        updateCounter();
    });

    function buildCalendar() {
        // Clear previous day cells, keeping only the 7 headers
        const headers = Array.from(calendarContainer.querySelectorAll('.calendar-header-cell'));
        calendarContainer.innerHTML = '';
        headers.forEach(h => calendarContainer.appendChild(h));

        // Monday-based offset (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        const firstDayOfWeek = startDate.getDay();
        const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        for (let i = 0; i < offset; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'calendar-day-cell placeholder';
            calendarContainer.appendChild(placeholder);
        }

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayCell = document.createElement('div');
            const dateString = d.toISOString().split('T')[0];
            const month = d.getMonth() + 1;

            dayCell.className = `calendar-day-cell month-${month}`;
            dayCell.dataset.date = dateString;
            dayCell.textContent = d.getDate();

            // Mouse interactions
            dayCell.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isDragging = true;
                startDayCell = dayCell;
                isSelectMode = !dayCell.classList.contains('selected');
                toggleDay(dayCell, isSelectMode);
                updateCounter();
            });

            dayCell.addEventListener('mouseenter', () => {
                if (isDragging && startDayCell) {
                    selectRange(startDayCell, dayCell, isSelectMode);
                    updateCounter();
                }
            });

            // Touch interactions for mobile
            dayCell.addEventListener('touchstart', (e) => {
                isDragging = true;
                startDayCell = dayCell;
                isSelectMode = !dayCell.classList.contains('selected');
                toggleDay(dayCell, isSelectMode);
                updateCounter();
            }, { passive: true });

            dayCell.addEventListener('touchmove', (e) => {
                if (!isDragging || !startDayCell) return;
                const touch = e.touches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                if (target && target.classList.contains('calendar-day-cell') && !target.classList.contains('placeholder')) {
                    selectRange(startDayCell, target, isSelectMode);
                    updateCounter();
                }
            }, { passive: true });

            calendarContainer.appendChild(dayCell);
        }

        updateCounter();
    }

    document.addEventListener('mouseup', () => {
        isDragging = false;
        startDayCell = null;
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
        startDayCell = null;
    });

    function toggleDay(cell, select) {
        if (!cell || cell.classList.contains('placeholder') || cell.classList.contains('disabled')) return;
        if (select) {
            cell.classList.add('selected');
        } else {
            cell.classList.remove('selected');
        }
    }

    // Bidirectional range selection
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

    // Form Submission
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
                showToast(`Disponibilità registrata con successo per ${name}!`, 'success');
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