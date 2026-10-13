document.addEventListener('DOMContentLoaded', () => {
    const clanForm = document.getElementById('clan-form');
    const existingClansSelect = document.getElementById('existing-clans');
    const submitBtn = document.getElementById('submit-btn');

    // Load available clans on mount
    loadExistingClans();

    // Dropdown change handler
    existingClansSelect.addEventListener('change', () => {
        const selectedValue = existingClansSelect.value.trim();
        if (selectedValue) {
            useClan(selectedValue);
        }
    });

    // Form submission for creating / entering a clan
    clanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const clanInput = document.getElementById('clan-name');
        const clanName = clanInput.value.trim();

        if (!clanName) {
            showToast('Per favore, inserisci un nome valido per il clan.', 'error');
            clanInput.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Accesso in corso...</span>';

        try {
            const response = await fetch('/api/clan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clanName })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showToast(`Benvenuto nel Clan "${data.clanName}"!`, 'success');
                setTimeout(() => {
                    useClan(data.clanName);
                }, 400);
            } else {
                showToast(data.message || 'Si è verificato un errore durante l\'accesso.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Entra nel Gruppo</span> <span>→</span>';
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Errore di connessione al server.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Entra nel Gruppo</span> <span>→</span>';
        }
    });

    // Fetch existing clans
    async function loadExistingClans() {
        try {
            const response = await fetch('/api/clans');
            const data = await response.json();

            existingClansSelect.innerHTML = '<option value="">-- Seleziona un clan esistente --</option>';

            if (data.status === 'success' && data.clans && data.clans.length > 0) {
                data.clans.forEach(clan => {
                    const option = document.createElement('option');
                    option.value = clan;
                    option.textContent = clan;
                    existingClansSelect.appendChild(option);
                });
            } else {
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = 'Nessun clan trovato. Creane uno qui sotto!';
                emptyOption.disabled = true;
                existingClansSelect.appendChild(emptyOption);
            }
        } catch (error) {
            console.error('Error loading clans:', error);
            existingClansSelect.innerHTML = '<option value="">Errore nel caricamento dei clan</option>';
            showToast('Impossibile caricare i clan salvati.', 'error');
        }
    }

    function useClan(clanName) {
        localStorage.setItem('currentClan', clanName);
        window.location.href = '/home';
    }

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
