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
});