document.addEventListener('DOMContentLoaded', () => {
    console.log('Script is connected and running!');

    const calendarContainer = document.getElementById('calendar');
    const startDate = new Date('2025-07-01');
    const endDate = new Date('2025-08-31');
    let isDragging = false;
    let startDayIndex = null;

    // Generate calendar
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.dataset.date = date.toISOString().split('T')[0]; // Store the date in a data attribute
        dayDiv.textContent = date.getDate(); // Display only the day number

        // Apply background color based on the month
        const month = date.getMonth() + 1; // Months are 0-indexed
        if (month === 7) {
            dayDiv.style.backgroundColor = 'lightblue'; // Light blue for July
        } else if (month === 8) {
            dayDiv.style.backgroundColor = 'violet'; // Violet for August
        }

        // Add click event to toggle selection
        dayDiv.addEventListener('mousedown', (e) => {
            isDragging = true;
            const index = Array.from(calendarContainer.children).indexOf(dayDiv);
            startDayIndex = index;
            toggleDaySelection(dayDiv); // Toggle selection or deselection
        });

        dayDiv.addEventListener('mouseenter', () => {
            if (isDragging) {
                const index = Array.from(calendarContainer.children).indexOf(dayDiv);
                selectDaysInPattern(startDayIndex, index); // Select days in the described pattern
            }
        });

        calendarContainer.appendChild(dayDiv);
    }

    // Add event listeners to handle drag selection
    document.addEventListener('mouseup', () => {
        isDragging = false;
        startDayIndex = null;
    });

    // Function to toggle day selection
    function toggleDaySelection(dayDiv) {
        dayDiv.classList.toggle('selected'); // Add or remove the 'selected' class
    }

    // Function to select days in the described pattern
    function selectDaysInPattern(startIndex, endIndex) {
        const totalColumns = 7; // Number of columns in the grid
        const startRow = Math.floor(startIndex / totalColumns);
        const endRow = Math.floor(endIndex / totalColumns);


        if (startRow === endRow) {
            // If dragging within the same row, select all days between startIndex and endIndex
            for (let i = Math.min(startIndex, endIndex); i <= Math.max(startIndex, endIndex); i++) {
                calendarContainer.children[i].classList.add('selected');
            }
        } else if (endRow > startRow) {
            // Select days in the starting row from startIndex to the end of the row
            for (let i = startIndex; i < (startRow + 1) * totalColumns; i++) {
                calendarContainer.children[i].classList.add('selected');
            }

            // Select all days in rows between the start and end rows
            for (let row = startRow + 1; row < endRow; row++) {
                for (let i = row * totalColumns; i < (row + 1) * totalColumns; i++) {
                    calendarContainer.children[i].classList.add('selected');
                }
            }

            // Select days in the ending row from the start to endIndex
            for (let i = endRow * totalColumns; i <= endIndex; i++) {
                calendarContainer.children[i].classList.add('selected');
            }
        }
    }

    const form = document.getElementById('availability-form');
    const resultDiv = document.getElementById('result');

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = document.getElementById('name').value;
        resultDiv.textContent = `Thank you, ${name}, for submitting your availability!`;
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
            body: JSON.stringify({ name, days: selectedDays })
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
