document.addEventListener('DOMContentLoaded', function() {
    const clanForm = document.getElementById('clan-form');
    const errorMessage = document.getElementById('error-message');

    clanForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const clanName = document.getElementById('clan-name').value.trim();
        if (!clanName) {
            showError('Per favore, inserisci un nome del clan.');
            return;
        }

        try {
            const response = await fetch('/api/clan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ clanName })
            });

            const data = await response.json();
            if (data.success) {
                // Store clan name in localStorage for use in other pages
                localStorage.setItem('currentClan', clanName);
                localStorage.setItem('clanTableName', data.tableName);
                
                // Display message if it's a new clan
                if (data.isNew) {
                    console.log('Nuovo clan creato!');
                }
                
                // Redirect to home page
                window.location.href = '/home';
            } else {
                showError(data.message || 'Si è verificato un errore.');
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Si è verificato un errore di connessione.');
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        setTimeout(() => {
            errorMessage.classList.add('hidden');
        }, 5000);
    }
});
