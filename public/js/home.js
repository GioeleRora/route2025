document.addEventListener('DOMContentLoaded', async () => {
    const clanName = localStorage.getItem('currentClan');

    // If no clan is selected, redirect to selection screen
    if (!clanName) {
        window.location.href = '/clan-select';
        return;
    }

    // Set clan title & badge
    const navClanName = document.getElementById('nav-clan-name');
    const displayClanName = document.getElementById('display-clan-name');
    if (navClanName) navClanName.textContent = clanName;
    if (displayClanName) displayClanName.textContent = clanName;

    document.title = `Route Planner - Clan ${clanName}`;

    // Load clan statistics & members
    const memberCountLabel = document.getElementById('member-count-label');
    const membersList = document.getElementById('members-list');

    try {
        const response = await fetch(`/api/members?clan=${encodeURIComponent(clanName)}`);
        if (!response.ok) throw new Error('Errore nel recupero dati');

        const data = await response.json();
        const members = data.members || [];

        if (memberCountLabel) {
            memberCountLabel.textContent = members.length === 1 
                ? '1 partecipante' 
                : `${members.length} partecipanti`;
        }

        if (membersList) {
            membersList.innerHTML = '';
            if (members.length === 0) {
                membersList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem; font-style: italic;">Nessuna risposta ancora. Clicca su "Aggiungi Disponibilità" per essere il primo!</span>';
            } else {
                members.forEach(member => {
                    const chip = document.createElement('span');
                    chip.className = 'member-chip';
                    chip.textContent = `${member.name} (${member.day_count} gg)`;
                    membersList.appendChild(chip);
                });
            }
        }
    } catch (err) {
        console.error('Error fetching clan statistics:', err);
        if (memberCountLabel) memberCountLabel.textContent = 'Dati non disponibili';
        if (membersList) membersList.innerHTML = '<span style="color: var(--danger); font-size: 0.85rem;">Impossibile caricare i partecipanti.</span>';
    }
});