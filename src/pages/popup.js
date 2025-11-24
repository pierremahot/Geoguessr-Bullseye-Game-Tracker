import { getAllGames } from '../scripts/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const quickHistory = document.getElementById('quickHistory');
    const viewAllHistoryBtn = document.getElementById('viewAllHistory');
    const viewLeaderboardBtn = document.getElementById('viewLeaderboard');

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
                <p class="history-date">${new Date(game.date).toLocaleString()}</p>
                <div class="history-details player-list">${playersHtml}</div>
                <p class="history-details">Map: ${game.mapName || 'Inconnue'}</p>
                <p class="history-details">Score: ${game.score} ${game.gaveUp ? '(Gave Up)' : ''}</p>
                ${gameLink}
            `;
            quickHistory.appendChild(gameEl);
        });
    }

    // Gérer le clic sur "View Full History"
    viewAllHistoryBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Empêcher le comportement par défaut du lien
        chrome.tabs.create({ url: 'pages/history.html' });
    });

    // Gérer le clic sur "View Leaderboards"
    viewLeaderboardBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Empêcher le comportement par défaut du lien
        chrome.tabs.create({ url: 'pages/leaderboard.html' });
    });

    // Chargement initial
    loadLiveGame();
    loadQuickHistory();

    // Fonction pour charger et afficher la partie en cours
    function loadLiveGame() {
        const liveGameContainer = document.getElementById('liveGameContainer');
        const liveGameContent = document.getElementById('liveGameContent');

        chrome.storage.local.get(['currentLiveGame'], (result) => {
            const game = result.currentLiveGame;
            if (game) {
                liveGameContainer.style.display = 'block';

                // Format round time if available
                let timeInfo = '';
                if (game.roundTime !== undefined) {
                    const seconds = game.roundTime;
                    const minutes = Math.floor(seconds / 60);
                    const remainingSeconds = seconds % 60;
                    timeInfo = `<p class="live-detail">⏱️ Time: ${minutes}m ${remainingSeconds}s</p>`;
                }

                liveGameContent.innerHTML = `
                    <p class="live-map">🗺️ ${game.mapName || 'Unknown Map'}</p>
                    <p class="live-score">🎯 Score: <strong>${game.score}</strong></p>
                    ${timeInfo}
                    ${game.totalDuration ? `<p class="live-detail">⏳ Total Time: ${Math.floor(game.totalDuration / 60)}m ${game.totalDuration % 60}s</p>` : ''}
                    <p class="live-status">Players: ${Array.isArray(game.players) ? game.players.length : 0}</p>
                `;
            } else {
                liveGameContainer.style.display = 'none';
            }
        });
    }

    // Écouter les changements de stockage pour le live update
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.games) {
                loadQuickHistory();
            }
            if (changes.currentLiveGame) {
                loadLiveGame();
            }
        }
    });
});