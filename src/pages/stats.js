import {
    Chart,
    LineController,
    BarController,
    DoughnutController,
    CategoryScale,
    LinearScale,
    TimeScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Legend,
    Tooltip
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import { getAllGames } from '../scripts/storage.js';

// Enregistrer les plugins et les contrôleurs nécessaires
Chart.register(
    LineController, BarController, DoughnutController,
    CategoryScale, LinearScale, TimeScale,
    PointElement, LineElement, BarElement, ArcElement, // Éléments de base
    Legend, Tooltip // Plugins de base
);

document.addEventListener('DOMContentLoaded', async () => { // <-- Passage en async
    // Récupérer le nom du joueur depuis l'URL (ex: ?player=Pierre%20MAHOT)
    const params = new URLSearchParams(window.location.search);
    const playerName = params.get('player');

    if (!playerName) {
        document.getElementById('playerName').textContent = 'Erreur: Joueur non trouvé';
        return;
    }

    document.getElementById('playerName').textContent = playerName;

    // Charger toutes les données de jeu
    const allGames = await getAllGames();
    
    // Filtrer les parties pour n'inclure que celles de ce joueur
    const playerGames = allGames.filter(game => 
        Array.isArray(game.players) && game.players.includes(playerName)
    );

    if (playerGames.length === 0) {
        document.getElementById('playerName').textContent = `Aucune donnée pour ${playerName}`;
        return;
    }

    // Rendu des graphiques
    console.log(playerGames);
    renderAvgScoreDoughnut(playerGames);
    renderScoreByPlayersBar(playerGames);
    renderBestTeam(playerGames, playerName);
    renderScoreOverTimeChart(playerGames);
    renderScoreByMapBar(playerGames); // <-- NOUVEAU GRAPHIQUE
});

/**
 * Affiche le graphique "camembert" de la moyenne générale.
 * Utilise un graphique en anneau (doughnut) pour montrer le score / 25000.
 */
function renderAvgScoreDoughnut(games) {
    const ctx = document.getElementById('avgScoreChart').getContext('2d');
    const totalScore = games.reduce((sum, game) => sum + game.score, 0);
    const avgScore = Math.round(totalScore / games.length);
    const remainingScore = 25000 - avgScore;
    console.log(avgScore, remainingScore, totalScore,ctx);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Score Moyen', 'Points Restants'],
            datasets: [{
                label: 'socre Dataset',
                data: [avgScore, remainingScore],
                backgroundColor: ['#ef4444', '#374151'], // red-500, gray-700
                borderColor: '#1f2937' // gray-800 (fond de la carte)
            }]
        },
        options: {
            responsive: false, // DÉSACTIVÉ : Pour résoudre le conflit avec CSS Grid
            maintainAspectRatio: false, // Empêche les conflits de redimensionnement
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#f3f4f6' }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.label}: ${context.raw.toLocaleString()} pts`
                    }
                }
            }
        }
    });
}

/**
 * Affiche le graphique en barres des scores moyens par carte.
 */
function renderScoreByMapBar(games) {
    const ctx = document.getElementById('scoreByMapChart')?.getContext('2d');
    // S'assurer que l'élément canvas existe avant de continuer
    if (!ctx) {
        console.warn("L'élément canvas 'scoreByMapChart' n'a pas été trouvé.");
        return;
    }

    const scoresByMap = {}; // ex: { "A Diverse World": { total: 5000, count: 1 }, ... }

    games.forEach(game => {
        // Utiliser 'Inconnue' si le nom de la carte n'est pas défini (pour les anciennes parties)
        const mapName = game.mapName || 'Inconnue';
        if (!scoresByMap[mapName]) {
            scoresByMap[mapName] = { total: 0, count: 0 };
        }
        scoresByMap[mapName].total += game.score;
        scoresByMap[mapName].count++;
    });

    const labels = Object.keys(scoresByMap);
    const data = labels.map(mapName => {
        return Math.round(scoresByMap[mapName].total / scoresByMap[mapName].count);
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score Moyen par Carte',
                data: data,
                backgroundColor: '#16a34a', // green-600
                borderColor: '#22c55e', // green-500
                borderWidth: 1
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            indexAxis: 'y', // <-- Affiche les barres horizontalement pour une meilleure lisibilité des noms de cartes
            scales: {
                x: { beginAtZero: true, max: 25000, ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
                y: { ticks: { color: '#9ca3af' }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

/**
 * Affiche le graphique en barres des scores moyens par nombre de joueurs.
 */
function renderScoreByPlayersBar(games) {
    const ctx = document.getElementById('scoreByPlayersChart').getContext('2d');
    
    const scoresByPlayerCount = {}; // ex: { 2: { total: 5000, count: 1 }, 3: { ... } }

    games.forEach(game => {
        const count = game.players.length;
        if (!scoresByPlayerCount[count]) {
            scoresByPlayerCount[count] = { total: 0, count: 0 };
        }
        scoresByPlayerCount[count].total += game.score;
        scoresByPlayerCount[count].count++;
    });

    const labels = Object.keys(scoresByPlayerCount).sort((a, b) => a - b).map(count => `${count} Joueurs`);
    const data = Object.keys(scoresByPlayerCount).sort((a, b) => a - b).map(count => {
        return Math.round(scoresByPlayerCount[count].total / scoresByPlayerCount[count].count);
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score Moyen',
                data: data,
                backgroundColor: '#dc2626', // red-600
                borderColor: '#ef4444', // red-500
                borderWidth: 1
            }]
        },
        options: {
            responsive: false, // DÉSACTIVÉ : Pour résoudre le conflit avec CSS Grid
            maintainAspectRatio: false, // Empêche les conflits de redimensionnement
            scales: {
                y: {
                    beginAtZero: true,
                    max: 25000,
                    ticks: { color: '#9ca3af' }, // gray-400
                    grid: { color: '#374151' } // gray-700
                },
                x: {
                    ticks: { color: '#9ca3af' }, // gray-400
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

/**
 * Calcule et affiche la "Meilleure Équipe" (partenaire avec la meilleure moyenne).
 */
function renderBestTeam(games, currentPlayerName) {
    const teammateStats = new Map(); // Map<string, { total: number, count: number }>

    games.forEach(game => {
        // Ne considérer que les parties à 2 joueurs pour "Meilleure Équipe" pour simplifier
        if (game.players.length === 2) {
            const teammate = game.players.find(p => p !== currentPlayerName);
            if (teammate) {
                if (!teammateStats.has(teammate)) {
                    teammateStats.set(teammate, { total: 0, count: 0 });
                }
                const stats = teammateStats.get(teammate);
                stats.total += game.score;
                stats.count++;
                teammateStats.set(teammate, stats);
            }
        }
    });

    if (teammateStats.size === 0) {
        document.getElementById('bestTeamLoading').textContent = 'Aucune partie en duo trouvée.';
        return;
    }

    let bestTeammate = '';
    let bestAvg = 0;
    let gameCount = 0;

    teammateStats.forEach((stats, name) => {
        const avg = stats.total / stats.count;
        if (avg > bestAvg) {
            bestAvg = avg;
            bestTeammate = name;
            gameCount = stats.count;
        }
    });

    // Afficher les résultats
    document.getElementById('bestTeamNames').textContent = `${currentPlayerName} + ${bestTeammate}`;
    document.getElementById('bestTeamScore').textContent = `${Math.round(bestAvg)} pts`;
    document.getElementById('bestTeamGameCount').textContent = `sur ${gameCount} partie(s)`;
    
    document.getElementById('bestTeamLoading').style.display = 'none';
    document.getElementById('bestTeamContent').style.display = 'block';
}

/**
 * Affiche le graphique en ligne de l'évolution du score moyen par jour.
 */
function renderScoreOverTimeChart(games) {
    const ctx = document.getElementById('scoreOverTimeChart').getContext('2d');

    const scoresByDay = {}; // ex: { '2025-11-10': { total: 5000, count: 1 }, ... }

    games.forEach(game => {
        const day = game.date.split('T')[0]; // Format 'YYYY-MM-DD'
        if (!scoresByDay[day]) {
            scoresByDay[day] = { total: 0, count: 0 };
        }
        scoresByDay[day].total += game.score;
        scoresByDay[day].count++;
    });

    const data = Object.keys(scoresByDay).sort().map(day => {
        return {
            x: day,
            y: Math.round(scoresByDay[day].total / scoresByDay[day].count)
        };
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            // Le plugin de zoom est enregistré localement ici
            datasets: [{
                label: 'Score Moyen par Jour',
                data: data,
                fill: false,
                borderColor: '#ef4444', // red-500
                tension: 0.1
            }]
        },
        plugins: [zoomPlugin], // <-- AJOUT CRUCIAL
        options: {
            // DÉSACTIVÉ : Le plugin de zoom peut entrer en conflit avec la gestion responsive native.
            responsive: false, 
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        parser: 'yyyy-MM-dd',
                        tooltipFormat: 'PP' // Format 'Nov 13, 2025'
                    },
                    ticks: { color: '#9ca3af' }, // gray-400
                    grid: { color: '#374151' } // gray-700
                },
                y: {
                    beginAtZero: true,
                    max: 25000,
                    ticks: { color: '#9ca3af' }, // gray-400
                    grid: { color: '#374151' } // gray-700
                }
            },
            plugins: {
                legend: { display: false },
                // Activer le zoom et le panoramique
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    }
                }
            }
        }
    });
}