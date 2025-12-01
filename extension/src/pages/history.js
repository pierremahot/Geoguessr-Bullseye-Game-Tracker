import { getAllGames, deleteGameById, clearAllGames } from '../scripts/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('historyTableBody');
    const clearHistoryBtn = document.getElementById('clearHistory');

    // NOUVEAU : Références pour les filtres et la moyenne
    const dateFilter = document.getElementById('dateFilter');
    const playersFilter = document.getElementById('playersFilter');
    const mapFilter = document.getElementById('mapFilter'); // <-- NOUVEAU
    const scoreFilter = document.getElementById('scoreFilter');
    const averageScoreCell = document.getElementById('averageScoreCell');

    // NOUVEAU : État global
    let allGames = []; // La liste complète, non modifiée
    let currentSort = {
        column: 'date',
        ascending: false // Les plus récents (desc) d'abord
    };

    // --- Fonctions principales ---

    // 1. Charger l'historique complet
    async function loadFullHistory() {
        allGames = await getAllGames();
        applyFiltersAndRender();
    }

    // 2. NOUVEAU : Appliquer les filtres et le tri, puis afficher
    function applyFiltersAndRender() {
        // Obtenir les valeurs des filtres
        const dateValue = dateFilter.value.toLowerCase();
        const playersValue = playersFilter.value.toLowerCase();
        const mapValue = mapFilter.value.toLowerCase(); // <-- NOUVEAU
        const scoreValue = scoreFilter.value.toLowerCase();

        // Filtrer les jeux
        let filteredGames = allGames.filter(game => {
            // Filtre Joueur (vérifie si au moins un joueur correspond)
            const playerMatch = game.players.some(p => {
                let name = p;
                if (typeof p === 'object' && p !== null) {
                    name = p.nick || p.playerId || '';
                }
                return name.toLowerCase().includes(playersValue);
            });
            // Filtre Carte (gère les anciennes parties sans mapName)
            const mapName = game.mapName || '';
            const mapMatch = mapName.toLowerCase().includes(mapValue);
            // Filtre Date
            const dateMatch = new Date(game.date).toLocaleString().toLowerCase().includes(dateValue);
            // Filtre Score
            const scoreMatch = game.score.toString().includes(scoreValue);

            return playerMatch && mapMatch && dateMatch && scoreMatch;
        });

        // Trier les jeux filtrés
        filteredGames.sort((a, b) => {
            let valA, valB;

            switch (currentSort.column) {
                case 'date':
                    valA = new Date(a.date);
                    valB = new Date(b.date);
                    break;
                case 'score':
                    valA = a.score;
                    valB = b.score;
                    break;
                case 'players':
                    // Trie par le premier joueur de la liste
                    valA = a.players[0];
                    if (typeof valA === 'object' && valA !== null) valA = valA.nick || valA.playerId || '';
                    valA = (valA || '').toLowerCase();

                    valB = b.players[0];
                    if (typeof valB === 'object' && valB !== null) valB = valB.nick || valB.playerId || '';
                    valB = (valB || '').toLowerCase();
                    break;
                case 'map': // <-- NOUVEAU
                    valA = (a.mapName || '').toLowerCase();
                    valB = (b.mapName || '').toLowerCase();
                    break;
                default:
                    return 0;
            }

            if (valA < valB) {
                return currentSort.ascending ? -1 : 1;
            }
            if (valA > valB) {
                return currentSort.ascending ? 1 : -1;
            }
            return 0;
        });

        // Mettre à jour l'interface
        renderTable(filteredGames);
        calculateAndDisplayAverage(filteredGames);
        updateSortArrows();
    }

    // 3. Afficher la table (maintenant avec les jeux filtrés/triés)
    function renderTable(games) {
        if (!games || games.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No matching games found.</td></tr>';
            return;
        }

        tableBody.innerHTML = ''; // Effacer

        games.forEach(game => {
            const row = document.createElement('tr');

            const gameLink = game.url
                ? `<a href="${game.url}" target="_blank">Voir le récap.</a>`
                : '<span>N/A</span>';

            let playersHtml = 'No players found';
            if (Array.isArray(game.players) && game.players.length > 0) {
                // MODIFIÉ : Transformer les joueurs en liens vers stats.html
                const statsPageUrl = chrome.runtime.getURL('pages/stats.html');
                playersHtml = game.players.map(p => {
                    let name = p;
                    if (typeof p === 'object' && p !== null) {
                        name = p.nick || p.playerId || 'Unknown';
                    }
                    return `<a href="${statsPageUrl}?player=${encodeURIComponent(name)}" target="_blank" class="player-tag clickable">${name}</a>`;
                }).join(' ');
            } else if (typeof game.players === 'string' && game.players) {
                // Gérer l'ancien format (non cliquable)
                playersHtml = `<span class="player-tag">${game.players}</span>`;
            }

            // Format Limit
            let limitStr = 'Infinite';
            if (game.roundTime && game.roundTime > 0) {
                const min = Math.floor(game.roundTime / 60);
                const sec = game.roundTime % 60;
                limitStr = sec > 0 ? `${min}m${sec}s` : `${min}m`;
            }

            // Format Duration
            let durationStr = '-';
            if (game.totalDuration) {
                const dMin = Math.floor(game.totalDuration / 60);
                const dSec = game.totalDuration % 60;
                durationStr = `${dMin}m ${dSec}s`;
            }

            row.innerHTML = `
                <td class="font-medium">${new Date(game.date).toLocaleString()}</td>
                <td><div class="player-list">${playersHtml}</div></td>
                <td>${game.mapName || 'Inconnue'}</td>
                <td>${limitStr}</td>
                <td>${durationStr}</td>
                <td>${game.score}</td>
                <td>
                    ${game.gaveUp
                    ? '<span class="status-badge status-gaveup">Gave Up</span>'
                    : '<span class="status-badge status-finished">Finished</span>'
                }
                </td>
                <td>${gameLink}</td>
                <td class="text-right">
                    <button class="delete-btn" data-id="${game.id}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // 4. NOUVEAU : Calculer et afficher la moyenne
    function calculateAndDisplayAverage(games) {
        if (games.length === 0) {
            averageScoreCell.textContent = 'N/A';
            return;
        }

        const totalScore = games.reduce((sum, game) => sum + game.score, 0);
        const average = totalScore / games.length;
        averageScoreCell.textContent = `${average.toFixed(0)}`;
    }

    // 5. NOUVEAU : Mettre à jour les flèches de tri
    function updateSortArrows() {
        document.querySelectorAll('th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.getAttribute('data-sort-key') === currentSort.column) {
                th.classList.add(currentSort.ascending ? 'sort-asc' : 'sort-desc');
            }
        });
    }

    // --- Écouteurs d'événements ---

    // Écouteurs pour les filtres
    [dateFilter, playersFilter, mapFilter, scoreFilter].forEach(filter => {
        filter.addEventListener('input', applyFiltersAndRender);
    });

    // Écouteurs pour le tri
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.getAttribute('data-sort-key');
            if (currentSort.column === sortKey) {
                currentSort.ascending = !currentSort.ascending; // Inverser la direction
            } else {
                currentSort.column = sortKey;
                currentSort.ascending = true; // Défaut : ascendant (sauf pour la date)
            }
            applyFiltersAndRender();
        });
    });

    // Écouteur pour "Clear All History"
    clearHistoryBtn.addEventListener('click', async () => {
        if (confirm('Êtes-vous sûr de vouloir supprimer tout l\'historique ? Cette action est irréversible.')) {
            await clearAllGames();
            // Le listener `chrome.storage.onChanged` s'occupera de la mise à jour de l'UI.
        }
    });

    // Écouteur pour la suppression (délégation)
    tableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const gameId = e.target.getAttribute('data-id');
            await deleteGameById(gameId);
            // Le listener `chrome.storage.onChanged` s'occupera de la mise à jour de l'UI.
        }
    });

    // Écouteur pour les changements de stockage (si une autre page modifie les données)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.games) {
            allGames = changes.games.newValue || [];
            applyFiltersAndRender();
        }
    });

    // Chargement initial
    loadFullHistory();
});