import { getAllGames } from '../scripts/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const teamsLeaderboard = document.getElementById('teamsLeaderboard');
    const playersLeaderboard = document.getElementById('playersLeaderboard');

    const allGames = await getAllGames();
    renderLeaderboards(allGames);

    function renderLeaderboards(games) {
        // Filtrer les parties abandonnées pour des stats plus justes
        const finishedGames = games.filter(game => !game.gaveUp);

        // --- Calcul du classement des joueurs ---
        const playerStats = {};
        finishedGames.forEach(game => {
            if (Array.isArray(game.players)) {
                game.players.forEach(player => {
                    if (!playerStats[player]) {
                        playerStats[player] = { totalScore: 0, gameCount: 0 };
                    }
                    playerStats[player].totalScore += game.score;
                    playerStats[player].gameCount++;
                });
            }
        });

        const sortedPlayers = Object.entries(playerStats)
            .map(([name, stats]) => ({
                name,
                avgScore: stats.totalScore / stats.gameCount,
                gameCount: stats.gameCount
            }))
            .sort((a, b) => b.avgScore - a.avgScore);

        // --- Calcul du classement des équipes ---
        const teamStats = {};
        finishedGames.forEach(game => {
            if (Array.isArray(game.players) && game.players.length > 0) {
                const teamKey = [...game.players].sort().join(', ');
                if (!teamStats[teamKey]) {
                    teamStats[teamKey] = { totalScore: 0, gameCount: 0 };
                }
                teamStats[teamKey].totalScore += game.score;
                teamStats[teamKey].gameCount++;
            }
        });

        const sortedTeams = Object.entries(teamStats)
            .map(([name, stats]) => ({
                name,
                avgScore: stats.totalScore / stats.gameCount,
                gameCount: stats.gameCount
            }))
            .sort((a, b) => b.avgScore - a.avgScore);

        // --- Affichage ---
        renderList(playersLeaderboard, sortedPlayers.slice(0, 10)); // Top 10
        renderList(teamsLeaderboard, sortedTeams.slice(0, 10)); // Top 10

        // --- Calcul et affichage des classements par carte ---
        renderMapLeaderboards(finishedGames);
    }

    function renderMapLeaderboards(games) {
        const container = document.getElementById('mapLeaderboardsContainer');
        container.innerHTML = ''; // Vider

        const gamesByMap = {};
        games.forEach(game => {
            const mapName = game.mapName || 'Inconnue';
            const roundTime = game.roundTime !== undefined ? game.roundTime : 0;
            const key = JSON.stringify({ name: mapName, time: roundTime });

            if (!gamesByMap[key]) {
                gamesByMap[key] = [];
            }
            gamesByMap[key].push(game);
        });

        if (Object.keys(gamesByMap).length === 0) return;

        const sectionTitle = document.createElement('h2');
        sectionTitle.className = 'section-title';
        sectionTitle.textContent = 'Classements par Carte';
        container.appendChild(sectionTitle);

        const grid = document.createElement('div');
        grid.className = 'leaderboards-grid';
        container.appendChild(grid);

        // Trier les cartes par nombre de parties jouées
        const sortedMaps = Object.keys(gamesByMap).sort((a, b) => gamesByMap[b].length - gamesByMap[a].length);

        for (const key of sortedMaps) {
            const gamesOnMap = gamesByMap[key];
            const { name: mapName, time: roundTime } = JSON.parse(key);

            // Format display name
            let displayMapName = mapName;
            if (roundTime === 0) {
                displayMapName += ' (Infinite)';
            } else {
                const minutes = Math.floor(roundTime / 60);
                const seconds = roundTime % 60;
                const timeStr = seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`;
                displayMapName += ` (${timeStr})`;
            }

            // Stats joueurs pour cette carte
            const playerStatsOnMap = {};
            gamesOnMap.forEach(game => {
                game.players.forEach(player => {
                    if (!playerStatsOnMap[player]) playerStatsOnMap[player] = { gameCount: 0, totalScore: 0 };
                    playerStatsOnMap[player].gameCount++;
                    playerStatsOnMap[player].totalScore += game.score;
                });
            });
            const sortedPlayersOnMap = Object.entries(playerStatsOnMap).map(([name, stats]) => ({ name, ...stats, avgScore: stats.totalScore / stats.gameCount })).sort((a, b) => b.gameCount - a.gameCount);

            // Stats équipes pour cette carte
            const teamStatsOnMap = {};
            gamesOnMap.forEach(game => {
                if (game.players.length > 0) {
                    const teamKey = [...game.players].sort().join(', ');
                    if (!teamStatsOnMap[teamKey]) teamStatsOnMap[teamKey] = { gameCount: 0, totalScore: 0 };
                    teamStatsOnMap[teamKey].gameCount++;
                    teamStatsOnMap[teamKey].totalScore += game.score;
                }
            });
            const sortedTeamsOnMap = Object.entries(teamStatsOnMap).map(([name, stats]) => ({ name, ...stats, avgScore: stats.totalScore / stats.gameCount })).sort((a, b) => b.gameCount - a.gameCount);

            // Créer et ajouter la carte de classement pour cette map
            const mapCard = createMapLeaderboardCard(displayMapName, gamesOnMap.length, sortedPlayersOnMap.slice(0, 5), sortedTeamsOnMap.slice(0, 5));
            grid.appendChild(mapCard);
        }
    }

    function renderList(element, items) {
        element.innerHTML = ''; // Vider la liste
        if (items.length === 0) {
            element.innerHTML = '<li>Pas de données disponibles.</li>';
            return;
        }
        const statsPageUrl = chrome.runtime.getURL('pages/stats.html');

        items.forEach(item => {
            const li = document.createElement('li');

            // Rendre les noms de joueurs cliquables
            const playerLinks = item.name.split(', ').map(p =>
                `<a href="${statsPageUrl}?player=${encodeURIComponent(p)}" target="_blank">${p}</a>`
            ).join(', ');

            li.innerHTML = `
                <span class="leaderboard-name">${playerLinks}</span>
                <span class="leaderboard-score">${item.avgScore.toFixed(0)} <small>(${item.gameCount} parties)</small></span>
            `;
            element.appendChild(li);
        });
    }

    function createMapLeaderboardCard(mapName, totalGames, topPlayers, topTeams) {
        const card = document.createElement('div');
        card.className = 'card';

        const statsPageUrl = chrome.runtime.getURL('pages/stats.html');

        const renderItems = (items) => {
            if (items.length === 0) return '<li>Aucune donnée</li>';
            return items.map(item => {
                const playerLinks = item.name.split(', ').map(p =>
                    `<a href="${statsPageUrl}?player=${encodeURIComponent(p)}" target="_blank">${p}</a>`
                ).join(', ');
                return `
                    <li>
                        <span class="leaderboard-name">${playerLinks}</span>
                        <span class="leaderboard-score">${item.gameCount} <small>parties</small></span>
                    </li>
                `;
            }).join('');
        };

        card.innerHTML = `
            <h3>${mapName} <small>(${totalGames} parties)</small></h3>
            <div class="sub-leaderboard">
                <h4>Top Joueurs (par participations)</h4>
                <ol>${renderItems(topPlayers)}</ol>
            </div>
            <div class="sub-leaderboard">
                <h4>Top Équipes (par participations)</h4>
                <ol>${renderItems(topTeams)}</ol>
            </div>
        `;

        return card;
    }
});