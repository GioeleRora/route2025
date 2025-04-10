document.addEventListener('DOMContentLoaded', async () => {
    // Costante per controllare il blocco dei giorni specifici (26 luglio - 5 agosto)
    const DISABLE_SPECIFIC_DAYS = true;

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

    try {
        // Fetch availability data
        const response = await fetch('/api/availability', {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache', // Forza il browser a non usare la cache
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const availabilities = await response.json(); // Parse the JSON response
        console.log('Availabilities:', availabilities);

        // Calculate the number of people who selected each day
        const daysCount = {};
        availabilities.forEach(({ days }) => {
            days.forEach(day => {
                daysCount[day] = (daysCount[day] || 0) + 1;
            });
        });

        // Determine the maximum number of people who selected a single day
        const maxCount = Math.max(...Object.values(daysCount), 0);

        // Generate the calendar
        const startDate = new Date('2025-07-01');
        const endDate = new Date('2025-08-31');
        const dateRange = [];

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
                dayDiv.style.backgroundColor = '#cccccc';
            } else {
                // Set the background color based on the count for non-disabled days
                if (maxCount > 0) {
                    const opacity = count / maxCount; // Calculate opacity proportional to the count
                    dayDiv.style.backgroundColor = `rgba(0, 128, 0, ${opacity})`; // Green with varying opacity
                } else {
                    dayDiv.style.backgroundColor = 'transparent'; // Default color if no data
                }
            }

            calendarContainer.appendChild(dayDiv);
            dateRange.push(dateString); // Add the date to the range
        }

        // Calculate the best N-day slot (e.g., 7 days) excluding disabled days
        const N = 7;
        let bestSlots = [];
        let maxMean = 0;

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
            let mean = slot.reduce((sum, day) => sum + (daysCount[day] || 0), 0) / N;

            // Expand the slot if adjacent days have the same mean
            let start = i;
            let end = i + N - 1;

            while (start > 0 && (daysCount[dateRange[start - 1]] || 0) === mean) {
                start--;
                slot = dateRange.slice(start, end + 1);
            }

            while (end < dateRange.length - 1 && (daysCount[dateRange[end + 1]] || 0) === mean) {
                end++;
                slot = dateRange.slice(start, end + 1);
            }

            // Check if this slot has the maximum mean
            if (mean > maxMean) {
                maxMean = mean;
                bestSlots = [slot]; // Reset to only this slot
            } else if (mean === maxMean) {
                const slotString = JSON.stringify(slot);
                if (!bestSlots.some(existingSlot => JSON.stringify(existingSlot) === slotString)) {
                    bestSlots.push(slot);
                }
            }
        }

        // Display the best slots
        if (bestSlots.length > 0) {
            // Use innerHTML instead of textContent to properly handle line breaks
            let slotsHtml = `Migliori slot con media di ${maxMean.toFixed(2)} persone/giorno:<br>`;

            bestSlots.forEach((slot, index) => {
                const firstDay = slot[0].split('-').slice(1).reverse().join('/');
                const lastDay = slot[slot.length - 1].split('-').slice(1).reverse().join('/');
                slotsHtml += `Slot ${index + 1}: Dal ${firstDay} al ${lastDay}<br>`;
            });
            
            slotInfo.innerHTML = slotsHtml;
        } else {
            slotInfo.textContent = 'Nessun dato disponibile';
        }
    } catch (error) {
        console.error('Error generating calendar:', error);
        slotInfo.textContent = 'Errore nel caricamento dei dati.';
    }
});
