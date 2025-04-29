document.addEventListener('DOMContentLoaded', function() {
    const clanForm = document.getElementById('clan-form');
    const existingClansSelect = document.getElementById('existing-clans');
    const errorMessage = document.getElementById('error-message');
    const loading = document.getElementById('loading');
    
    // Load existing clans when the page loads
    loadExistingClans();
    
    // Handle clan selection from dropdown
    existingClansSelect.addEventListener('change', function() {
        const selectedValue = this.value;
        if (selectedValue) {
            const [tableName, clanName] = selectedValue.split('|');
            useClan(clanName, tableName);
        }
    });

    // Handle form submission for new clan
    clanForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const clanName = document.getElementById('clan-name').value.trim();
        if (!clanName) {
            showError('Per favore, inserisci un nome del clan.');
            return;
        }

        showLoading();
        
        try {
            const response = await fetch('/api/clan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ clanName })
            });

            const data = await response.json();
            hideLoading();
            
            if (data.success) {
                // Use the newly created or existing clan
                useClan(data.clanName, data.tableName);
            } else {
                showError(data.message || 'Si è verificato un errore.');
            }
        } catch (error) {
            hideLoading();
            console.error('Error:', error);
            showError('Si è verificato un errore di connessione.');
        }
    });

    // Function to load existing clans
    async function loadExistingClans() {
        showLoading();
        try {
            const response = await fetch('/api/clans');
            const data = await response.json();
            
            if (data.status === 'success' && data.clans.length > 0) {
                data.clans.forEach(clan => {
                    const option = document.createElement('option');
                    // Store both table name and display name in the value, separated by |
                    option.value = clan;
                    option.textContent = clan;
                    existingClansSelect.appendChild(option);
                });
            }
            hideLoading();
        } catch (error) {
            hideLoading();
            console.error('Error loading clans:', error);
            showError('Impossibile caricare i clan esistenti.');
        }
    }

    // Function to use the selected or created clan
    function useClan(clanName, tableName) {
        // Store clan info in localStorage for use in other pages
        localStorage.setItem('currentClan', clanName);
        localStorage.setItem('clanTableName', tableName);
        
        // Redirect to home page
        window.location.href = '/home';
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        setTimeout(() => {
            errorMessage.classList.add('hidden');
        }, 5000);
    }
    
    function showLoading() {
        loading.classList.remove('hidden');
    }
    
    function hideLoading() {
        loading.classList.add('hidden');
    }
});
