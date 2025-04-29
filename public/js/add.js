document.addEventListener('DOMContentLoaded', () => {
    console.log('Script is connected and running!');

    // Costante per controllare il blocco  dei giorni specifici (26 luglio - 5 agosto)
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
    const startDate = new Date('2025-07-01');
    const endDate = new Date('2025-08-31');
    let isDragging = false;
    let startDayIndex = null;
    let isSelectMode = true; // Track whether we are in select or deselect mode
    
    // Add offset for the first day of the month
    const firstDayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const offset = (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1); // Adjust for Monday as the first day
    
    // Add placeholder elements for proper alignment
    for (let i = 0; i < offset; i++) {
        const placeholderDiv = document.createElement('div');
        placeholderDiv.className = 'calendar-day placeholder'; // Add a class for styling
        calendarContainer.appendChild(placeholderDiv);
    }

    // Generate calendar
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        const dateString = date.toISOString().split('T')[0];
        dayDiv.dataset.date = dateString; // Store the date in a data attribute
        dayDiv.textContent = date.getDate(); // Display only the day number

        // Verifica se la data è disabilitata
        const isDisabled = isDateDisabled(dateString);
        if (isDisabled) {
            dayDiv.classList.add('disabled');
        }

        // Apply background color based on the month
        const month = date.getMonth() + 1; // Months are 0-indexed
        if (month === 7) {
            dayDiv.style.backgroundColor = 'lightblue'; // Light blue for July
        } else if (month === 8) {
            dayDiv.style.backgroundColor = 'violet'; // Violet for August
        }

        // Add event listeners for both mouse and touch
        // Mouse events
        dayDiv.addEventListener('mousedown', (e) => {
            if (isDisabled) return; // Non fare nulla se il giorno è disabilitato
            
            isDragging = true;
            const index = Array.from(calendarContainer.children).indexOf(dayDiv);
            startDayIndex = index;
            // Determine if we're selecting or deselecting based on current state
            isSelectMode = !dayDiv.classList.contains('selected');
            toggleDaySelection(dayDiv, isSelectMode); // Toggle based on mode
        });

        dayDiv.addEventListener('mouseenter', () => {
            if (isDragging && !isDisabled) { // Controlla anche qui se il giorno è disabilitato
                const index = Array.from(calendarContainer.children).indexOf(dayDiv);
                selectDaysInPattern(startDayIndex, index, isSelectMode); // Pass selection mode
            }
        });

        // Touch events for mobile devices
        dayDiv.addEventListener('touchstart', (e) => {
            if (isDisabled) return; // Non fare nulla se il giorno è disabilitato
            
            // Prevent default to avoid scrolling while selecting
            e.preventDefault();
            isDragging = true;
            const index = Array.from(calendarContainer.children).indexOf(dayDiv);
            startDayIndex = index;
            // Determine if we're selecting or deselecting based on current state
            isSelectMode = !dayDiv.classList.contains('selected');
            toggleDaySelection(dayDiv, isSelectMode); // Toggle based on mode
        });

        dayDiv.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            // Get the touch position
            const touch = e.touches[0];
            // Find which element is under the touch point
            const elementAtTouch = document.elementFromPoint(touch.clientX, touch.clientY);
            
            // Check if the touch is over a calendar day
            if (elementAtTouch && elementAtTouch.classList.contains('calendar-day')) {
                const index = Array.from(calendarContainer.children).indexOf(elementAtTouch);
                selectDaysInPattern(startDayIndex, index, isSelectMode);
            }
        });

        calendarContainer.appendChild(dayDiv);
    }

    // Add event listeners to handle drag selection for both mouse and touch
    document.addEventListener('mouseup', () => {
        isDragging = false;
        startDayIndex = null;
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
        startDayIndex = null;
    });

    // Prevent scrolling when touch-selecting in the calendar
    calendarContainer.addEventListener('touchmove', (e) => {
        if (isDragging) {
            e.preventDefault();
        }
    }, { passive: false });

    // Function to toggle day selection
    function toggleDaySelection(dayDiv, selectMode) {
        // Non permettere la selezione di giorni disabilitati
        if (dayDiv.classList.contains('disabled')) return;
        
        if (selectMode) {
            dayDiv.classList.add('selected');
        } else {
            dayDiv.classList.remove('selected');
        }
    }

    // Function to select days in the described pattern
    function selectDaysInPattern(startIndex, endIndex, selectMode) {
        const totalColumns = 7; // Number of columns in the grid
        const startRow = Math.floor(startIndex / totalColumns);
        const endRow = Math.floor(endIndex / totalColumns);


        if (startRow === endRow) {
            // If dragging within the same row, select all days between startIndex and endIndex
            for (let i = Math.min(startIndex, endIndex); i <= Math.max(startIndex, endIndex); i++) {
                // Salta i giorni disabilitati
                if (!calendarContainer.children[i].classList.contains('disabled')) {
                    toggleDaySelection(calendarContainer.children[i], selectMode);
                }
            }
        } else if (endRow > startRow) {
            // Select days in the starting row from startIndex to the end of the row
            for (let i = startIndex; i < (startRow + 1) * totalColumns; i++) {
                if (!calendarContainer.children[i].classList.contains('disabled')) {
                    toggleDaySelection(calendarContainer.children[i], selectMode);
                }
            }

            // Select all days in rows between the start and end rows
            for (let row = startRow + 1; row < endRow; row++) {
                for (let i = row * totalColumns; i < (row + 1) * totalColumns; i++) {
                    if (!calendarContainer.children[i].classList.contains('disabled')) {
                        toggleDaySelection(calendarContainer.children[i], selectMode);
                    }
                }
            }

            // Select days in the ending row from the start to endIndex
            for (let i = endRow * totalColumns; i <= endIndex; i++) {
                if (!calendarContainer.children[i].classList.contains('disabled')) {
                    toggleDaySelection(calendarContainer.children[i], selectMode);
                }
            }
        }
    }

    // Add visual cue for selection mode
    calendarContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('calendar-day')) {
            if (!e.target.classList.contains('selected')) {
                calendarContainer.classList.add('select-mode');
                calendarContainer.classList.remove('deselect-mode');
            } else {
                calendarContainer.classList.add('deselect-mode');
                calendarContainer.classList.remove('select-mode');
            }
        }
    });
    
    calendarContainer.addEventListener('touchstart', (e) => {
        const touchedElement = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        if (touchedElement && touchedElement.classList.contains('calendar-day')) {
            if (!touchedElement.classList.contains('selected')) {
                calendarContainer.classList.add('select-mode');
                calendarContainer.classList.remove('deselect-mode');
            } else {
                calendarContainer.classList.add('deselect-mode');
                calendarContainer.classList.remove('select-mode');
            }
        }
    });
    
    // Reset visual mode when done dragging
    document.addEventListener('mouseup', () => {
        calendarContainer.classList.remove('select-mode', 'deselect-mode');
    });
    
    document.addEventListener('touchend', () => {
        calendarContainer.classList.remove('select-mode', 'deselect-mode');
    });
});

document.getElementById('availability-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const selectedDays = Array.from(document.querySelectorAll('#calendar .calendar-day.selected'))
        .map(dayDiv => dayDiv.dataset.date); // Get the selected dates

    try {
        const response = await fetch('/api/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, days: selectedDays, clan: localStorage.getItem('currentClan') })
        });

        if (response.ok) {
            window.location.href = '/results'; // Redirect to the results page
        } else {
            const errorData = await response.json();
            console.error('Error submitting availability:', errorData);
            alert(`Error: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Network error:', error);
        alert('Network error while submitting availability.');
    }
});