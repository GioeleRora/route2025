document.addEventListener('DOMContentLoaded', async () => {
    // Costante per controllare il blocco dei giorni specifici (26 luglio - 5 agosto)
    const DISABLE_SPECIFIC_DAYS = false;

    // Funzione per verificare se una data è nell'intervallo bloccato
    function isDateDisabled(dateString) {
        if (!DISABLE_SPECIFIC_DAYS) return false;
        
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        // Controlla se è tra il 26 luglio e il 5 agosto inclusi
        return (month === 7 && day >= 26) || (month === 8 && day <= 5);
    }

    const calendarContainer = document.getElementById('calendar');
    const slotInfo = document.getElementById('slot-info');
    const minSlotDaysInput = document.getElementById('min-slot-days');
    const applySlotDaysButton = document.getElementById('apply-slot-days');
    const dayPopupOverlay = document.getElementById('day-popup-overlay');
    const dayPopupDate = document.getElementById('day-popup-date');
    const dayPopupCount = document.getElementById('day-popup-count');
    const dayPopupClose = document.getElementById('day-popup-close');

    let availabilities = [];
    let dateRange = [];
    let daysCount = {};
    let maxCount = 0;

    try {
        // Fetch availability data
        const response = await fetch(`/api/availability?clan=${localStorage.getItem('currentClan')}`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        availabilities = await response.json(); // Parse the JSON response
        console.log('Availabilities:', availabilities); 

        renderResults();

    } catch (error) {
        console.error('Error generating calendar:', error);
        slotInfo.textContent = 'Errore nel caricamento dei dati.';
    }

    function renderResults() {
        // Reset calendar and slot info before rendering
        calendarContainer.innerHTML = `
            <div class="calendar-header-result">Lunedì</div>
            <div class="calendar-header-result">Martedì</div>
            <div class="calendar-header-result">Mercoledì</div>
            <div class="calendar-header-result">Giovedì</div>
            <div class="calendar-header-result">Venerdì</div>
            <div class="calendar-header-result">Sabato</div>
            <div class="calendar-header-result">Domenica</div>
        `;

        // Calculate the number of people who selected each day
        daysCount = {};
        availabilities.forEach(({ days }) => {
            days.forEach(day => {
                daysCount[day] = (daysCount[day] || 0) + 1;
            });
        });

        // Determine the maximum number of people who selected a single day
        maxCount = Math.max(...Object.values(daysCount), 0);

        // Generate the calendar
        const startDate = new Date('2026-07-01');
        const endDate = new Date('2026-08-31');
        dateRange = [];

        // Add offset for the first day of the month
        const firstDayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const offset = (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1); // Adjust for Monday as the first day
        for (let i = 0; i < offset; i++) {
            const placeholderDiv = document.createElement('div');
            placeholderDiv.className = 'calendar-day placeholder'; // Add a class for styling
            calendarContainer.appendChild(placeholderDiv);
        }

        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.textContent = date.getDate(); // Display only the day number

            const dateString = date.toISOString().split('T')[0];
            const count = daysCount[dateString] || 0;

            // Verifica se la data è disabilitata
            const isDisabled = isDateDisabled(dateString);
            if (isDisabled) {
                dayDiv.classList.add('disabled');
                // Per i giorni disabilitati, mostra un colore speciale o aggiunge un'indicazione visiva
                dayDiv.style.backgroundColor = '#999999';
                dayDiv.style.color = '#ffffff';
            } else {
                // Set the background color based on the count for non-disabled days
                if (maxCount > 0) {
                    const opacity = count / maxCount; // Calculate opacity proportional to the count
                    dayDiv.style.backgroundColor = `rgba(76, 175, 80, ${opacity})`; // Green with varying opacity
                } else {
                    dayDiv.style.backgroundColor = 'transparent'; // Default color if no data
                }
            }

            if (!isDisabled) {
                dayDiv.classList.add('clickable-day');
                dayDiv.title = 'Click per vedere quante persone sono presenti in questo giorno';
                dayDiv.addEventListener('click', () => {
                    openDayPopup(dateString, count, isDisabled);
                });
            }

            calendarContainer.appendChild(dayDiv);
            dateRange.push(dateString); // Add the date to the range
        }

        // Calculate the best N-day slot based on people available for the entire slot
        const rawMinDays = parseInt(minSlotDaysInput.value, 10);
        const N = Math.max(1, Math.min(dateRange.length, Number.isNaN(rawMinDays) ? 6 : rawMinDays));
        let bestSlots = [];
        let maxFullyAvailablePeople = 0;

        // Funzione per calcolare quante persone sono disponibili per tutti i giorni in uno slot
        function countPeopleAvailableForEntireSlot(slot) {
            return availabilities.filter(person => {
                // Controlla se la persona è disponibile per tutti i giorni dello slot
                return slot.every(day => person.days.includes(day));
            }).length;
        }

        for (let i = 0; i <= dateRange.length - N; i++) {
            // Verifica se questo slot contiene giorni disabilitati
            let containsDisabledDay = false;
            for (let j = 0; j < N; j++) {
                if (isDateDisabled(dateRange[i + j])) {
                    containsDisabledDay = true;
                    break;
                }
            }
            
            // Salta questo slot se contiene giorni disabilitati
            if (containsDisabledDay) continue;
            
            let slot = dateRange.slice(i, i + N);
            
            // Calcola quante persone sono disponibili per tutto lo slot
            const fullyAvailablePeople = countPeopleAvailableForEntireSlot(slot);
            
            // Calcola anche la media giornaliera per informazioni aggiuntive
            const mean = slot.reduce((sum, day) => sum + (daysCount[day] || 0), 0) / N;
            
            // Cerca di espandere lo slot se anche i giorni adiacenti hanno lo stesso numero di persone completamente disponibili
            let start = i;
            let end = i + N - 1;
            
            // Per l'espansione, controlliamo il numero di persone completamente disponibili
            while (start > 0) {
                const expandedSlot = [dateRange[start-1], ...slot];
                // Verifica che il giorno precedente non sia disabilitato
                if (isDateDisabled(dateRange[start-1])) break;
                
                const expandedAvailability = countPeopleAvailableForEntireSlot(expandedSlot);
                if (expandedAvailability >= fullyAvailablePeople) {
                    start--;
                    slot = expandedSlot;
                } else {
                    break;
                }
            }
            
            while (end < dateRange.length - 1) {
                const expandedSlot = [...slot, dateRange[end+1]];
                // Verifica che il giorno successivo non sia disabilitato
                if (isDateDisabled(dateRange[end+1])) break;
                
                const expandedAvailability = countPeopleAvailableForEntireSlot(expandedSlot);
                if (expandedAvailability >= fullyAvailablePeople) {
                    end++;
                    slot = expandedSlot;
                } else {
                    break;
                }
            }

            // Check if this slot has more fully available people
            if (fullyAvailablePeople > maxFullyAvailablePeople) {
                maxFullyAvailablePeople = fullyAvailablePeople;
                bestSlots = [{ slot, mean }]; // Reset to only this slot
            } else if (fullyAvailablePeople === maxFullyAvailablePeople && fullyAvailablePeople > 0) {
                const slotString = JSON.stringify(slot);
                if (!bestSlots.some(item => JSON.stringify(item.slot) === slotString)) {
                    bestSlots.push({ slot, mean });
                }
            }
        }

        // Display the best slots
        if (bestSlots.length > 0) {
            // Use innerHTML instead of textContent to properly handle line breaks
            let slotsHtml = `Migliori slot con <strong>${maxFullyAvailablePeople}</strong> persone disponibili per l'intero periodo:`;

            bestSlots.forEach((item, index) => {
                const { slot, mean } = item;
                const firstDay = slot[0].split('-').slice(1).reverse().join('/');
                const lastDay = slot[slot.length - 1].split('-').slice(1).reverse().join('/');
                
                slotsHtml += `<div class="slot-item">
                    <div class="slot-dates">Slot ${index + 1}: Dal ${firstDay} al ${lastDay}</div>
                    <span class="availability-count">
                        <div>Persone disponibili per tutti i ${slot.length} giorni: <strong>${maxFullyAvailablePeople}</strong></div>
                        <div>Media giornaliera: <strong>${mean.toFixed(2)}</strong> persone/giorno</div>
                    </span>
                </div>`;
            });
            
            slotInfo.innerHTML = slotsHtml;
        } else {
            slotInfo.textContent = 'Nessun dato disponibile';
        }
    }

    function rerenderFromControl() {
        if (!availabilities.length) return;
        renderResults();
    }

    function openDayPopup(dateString, count, isDisabled) {
        const [year, month, day] = dateString.split('-');
        dayPopupDate.textContent = `Data: ${day}/${month}/${year}`;
        dayPopupCount.textContent = isDisabled
            ? 'Questo giorno è disabilitato.'
            : `Persone presenti: ${count}`;

        dayPopupOverlay.classList.remove('hidden');
        dayPopupOverlay.setAttribute('aria-hidden', 'false');
    }

    function closeDayPopup() {
        dayPopupOverlay.classList.add('hidden');
        dayPopupOverlay.setAttribute('aria-hidden', 'true');
    }

    dayPopupClose.addEventListener('click', closeDayPopup);
    dayPopupOverlay.addEventListener('click', (event) => {
        if (event.target === dayPopupOverlay) {
            closeDayPopup();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeDayPopup();
        }
    });

    applySlotDaysButton.addEventListener('click', rerenderFromControl);
    minSlotDaysInput.addEventListener('change', rerenderFromControl);
});
