document.addEventListener('DOMContentLoaded', function() {
    const clanName = localStorage.getItem('currentClan');
    document.getElementById('clan-name').textContent = clanName;
            
    // Update page title         
    document.title = `Route 2025 - ${clanName}`;
});