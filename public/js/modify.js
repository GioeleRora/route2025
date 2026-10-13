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

    const YEAR = 2026;
    const startDate = new Date(`${YEAR}-07-01`);
    const endDate = new Date(`${YEAR}-08-31`);

    let currentSelectedMember = null;
    let isDragging = false;
    let startDayCell = null;
    let isSelectMode = true;

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

    // Quick Actions
    document.getElementById('btn-quick-weekends')?.addEventListener('click', () => {
        const days = calendarContainer.querySelectorAll('.calendar-day-cell:not(.placeholder):not(.disabled)');
        days.forEach(day => {
            const date = new Date(day.dataset.date);
            const dayOfWeek = date.getDay();
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

    function buildCalendar(selectedDates) {
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

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayCell = document.createElement('div');
            const dateString = d.toISOString().split('T')[0];
            const month = d.getMonth() + 1;

            dayCell.className = `calendar-day-cell month-${month}`;
            dayCell.dataset.date = dateString;
            dayCell.textContent = d.getDate();

            if (selectedDates.includes(dateString)) {
                dayCell.classList.add('selected');
            }

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

    // Submit update
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
