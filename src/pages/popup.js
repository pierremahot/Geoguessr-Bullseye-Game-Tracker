import { getAllGames } from '../scripts/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const quickHistory = document.getElementById('quickHistory');
    const viewAllHistoryBtn = document.getElementById('viewAllHistory');

    // Fonction pour charger et afficher les 3 derniers matchs
    async function loadQuickHistory() {
        const games = await getAllGames();
        if (games.length === 0) {
            quickHistory.innerHTML = '<p class="no-games">No games logged yet.</p>';
            return;
        }

        const recentGames = games.slice(-3).reverse();
        quickHistory.innerHTML = ''; // Effacer
        
        recentGames.forEach(game => {
            const gameEl = document.createElement('div');
            gameEl.className = 'history-item';
            
            // Lien vers la partie
            const gameLink = game.url 
                ? `<p class="history-details"><a href="${game.url}" target="_blank">Voir la partie</a></p>` 
                : '';

            // MODIFIÉ : Gérer l'affichage des joueurs
            let playersHtml = 'No players found';
            if (Array.isArray(game.players) && game.players.length > 0) {
                const statsPageUrl = chrome.runtime.getURL('pages/stats.html');
                // C'est un tableau (nouvelle méthode) -> Rendre cliquable
                playersHtml = game.players.map(p => 
                    `<a href="${statsPageUrl}?player=${encodeURIComponent(p)}" target="_blank" class="player-tag clickable">${p}</a>`
                ).join(' ');
            } else if (typeof game.players === 'string' && game.players) {
                // C'est une chaîne (ancienne méthode)
                playersHtml = `<span class="player-tag">${game.players}</span>`;
            }

            gameEl.innerHTML = `
                <p class="history-date">${new Date(game.date).toLocaleDateString()}</p>
                <div class="history-details player-list">${playersHtml}</div>
                <p class="history-details">Score: ${game.score} ${game.gaveUp ? '(Gave Up)' : ''}</p>
                ${gameLink}
            `;
            quickHistory.appendChild(gameEl);
        });
    }

    // Gérer le clic sur "View Full History"
    viewAllHistoryBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'history.html' });
    });

    // Écouter les changements de stockage
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.games) {
            loadQuickHistory();
        }
    });

    // Chargement initial
    loadQuickHistory();
});