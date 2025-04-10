document.addEventListener('DOMContentLoaded', () => {
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

    const searchButton = document.getElementById('search-button');
    const nameInput = document.getElementById('name-search');
    const userDataDiv = document.getElementById('user-data');
    const messageDiv = document.getElementById('message');
    const calendarContainer = document.getElementById('calendar');
    const form = document.getElementById('availability-form');
    const calendarPlaceholder = document.getElementById('calendar-placeholder');
    
    let currentUserData = null;
    let isDragging = false;
    let startDayIndex = null;
    let isSelectMode = true;

    // Funzione per gestire la visibilità del placeholder basata sulla visibilità dei dati dell'utente
    function updatePlaceholderVisibility() {
        if (userDataDiv.style.display === 'none') {
            calendarPlaceholder.style.display = 'block';
        } else {
            calendarPlaceholder.style.display = 'none';
        }
    }

    // Inizializzazione
    updatePlaceholderVisibility();

    // Set up search functionality
    searchButton.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            showMessage('Inserisci un nome per cercare i tuoi dati.', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/user/${encodeURIComponent(name)}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    showMessage(`Nessun dato trovato per "${name}".`, 'error');
                } else {
                    showMessage('Errore durante il recupero dei dati.', 'error');
                }
                userDataDiv.style.display = 'none';
                updatePlaceholderVisibility();
                return;
            }
            
            const userData = await response.json();
            currentUserData = userData;
            
            // Show the user data section
            userDataDiv.style.display = 'block';
            updatePlaceholderVisibility();
            
            // Initialize calendar
            initializeCalendar(userData.days);
            showMessage(`Dati trovati per "${userData.name}". Puoi modificare la tua disponibilità.`, 'success');
            
        } catch (error) {
            console.error('Error fetching user data:', error);
            showMessage('Errore di rete durante il recupero dei dati.', 'error');
            userDataDiv.style.display = 'none';
            updatePlaceholderVisibility();
        }
    });
    
    // Function to initialize the calendar with user data
    function initializeCalendar(selectedDays) {
        // Clear existing calendar days (except headers)
        const headers = Array.from(calendarContainer.querySelectorAll('.calendar-header'));
        calendarContainer.innerHTML = '';
        
        // Re-add headers
        headers.forEach(header => calendarContainer.appendChild(header));
        
        const startDate = new Date('2025-07-01');
        const endDate = new Date('2025-08-31');
        
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
            const dateString = date.toISOString().split('T')[0]; // Store the date in a data attribute
            dayDiv.dataset.date = dateString;
            dayDiv.textContent = date.getDate(); // Display only the day number
            
            // Check if the day is in the user's selected days
            if (selectedDays.includes(dateString)) {
                dayDiv.classList.add('selected');
            }
            
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
            
            // Add mouse event listeners
            dayDiv.addEventListener('mousedown', (e) => {
                if (isDisabled) return; // Non fare nulla se il giorno è disabilitato
                
                isDragging = true;
                const index = Array.from(calendarContainer.children).indexOf(dayDiv);
                startDayIndex = index;
                isSelectMode = !dayDiv.classList.contains('selected');
                toggleDaySelection(dayDiv, isSelectMode);
            });
            
            dayDiv.addEventListener('mouseenter', () => {
                if (isDragging && !isDisabled) { // Controlla anche qui se il giorno è disabilitato
                    const index = Array.from(calendarContainer.children).indexOf(dayDiv);
                    selectDaysInPattern(startDayIndex, index, isSelectMode);
                }
            });
            
            // Add touch event listeners
            dayDiv.addEventListener('touchstart', (e) => {
                if (isDisabled) return; // Non fare nulla se il giorno è disabilitato
                
                e.preventDefault();
                isDragging = true;
                const index = Array.from(calendarContainer.children).indexOf(dayDiv);
                startDayIndex = index;
                isSelectMode = !dayDiv.classList.contains('selected');
                toggleDaySelection(dayDiv, isSelectMode);
            });
            
            dayDiv.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                
                const touch = e.touches[0];
                const elementAtTouch = document.elementFromPoint(touch.clientX, touch.clientY);
                
                if (elementAtTouch && elementAtTouch.classList.contains('calendar-day') && 
                    !elementAtTouch.classList.contains('disabled')) {
                    const index = Array.from(calendarContainer.children).indexOf(elementAtTouch);
                    selectDaysInPattern(startDayIndex, index, isSelectMode);
                }
            });
            
            calendarContainer.appendChild(dayDiv);
        }
        
        // Add visual cues for selection mode
        addSelectionVisualCues();
    }
    
    // Add touch and mouse event listeners to handle drag end
    document.addEventListener('mouseup', () => {
        isDragging = false;
        startDayIndex = null;
        calendarContainer.classList.remove('select-mode', 'deselect-mode');
    });
    
    document.addEventListener('touchend', () => {
        isDragging = false;
        startDayIndex = null;
        calendarContainer.classList.remove('select-mode', 'deselect-mode');
    });
    
    // Function to add visual cues for selection mode
    function addSelectionVisualCues() {
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
    }
    
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
    
    // Function to select days in a pattern
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
            // Stesse modifiche per tutte le sezioni della selezione
            for (let i = startIndex; i < (startRow + 1) * totalColumns; i++) {
                if (!calendarContainer.children[i].classList.contains('disabled')) {
                    toggleDaySelection(calendarContainer.children[i], selectMode);
                }
            }
            
            for (let row = startRow + 1; row < endRow; row++) {
                for (let i = row * totalColumns; i < (row + 1) * totalColumns; i++) {
                    if (!calendarContainer.children[i].classList.contains('disabled')) {
                        toggleDaySelection(calendarContainer.children[i], selectMode);
                    }
                }
            }
            
            for (let i = endRow * totalColumns; i <= endIndex; i++) {
                if (!calendarContainer.children[i].classList.contains('disabled')) {
                    toggleDaySelection(calendarContainer.children[i], selectMode);
                }
            }
        }
    }
    
    // Handle form submission to update availability
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUserData) {
            showMessage('Nessun utente selezionato.', 'error');
            return;
        }
        
        const selectedDays = Array.from(document.querySelectorAll('#calendar .calendar-day.selected'))
            .map(dayDiv => dayDiv.dataset.date);
        
        try {
            const response = await fetch('/api/availability', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: currentUserData.name, 
                    days: selectedDays 
                })
            });
            
            if (response.ok) {
                showMessage('Disponibilità aggiornata con successo!', 'success');
                // Add redirect to results page after successful update
                setTimeout(() => {
                    window.location.href = '/results';
                }, 1000); // Short delay to show the success message before redirecting
            } else {
                const errorData = await response.json();
                showMessage(`Errore: ${errorData.error}`, 'error');
            }
        } catch (error) {
            console.error('Network error:', error);
            showMessage('Errore di rete durante l\'aggiornamento dei dati.', 'error');
        }
    });
    
    // Function to show messages
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
        messageDiv.style.display = 'block';
        
        // Hide the message after 5 seconds
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
});
