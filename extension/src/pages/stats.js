import ApexCharts from 'apexcharts';
import { getAllGames } from '../scripts/storage.js';

// Thème global pour les graphiques en mode sombre
const chartTheme = {
  theme: { mode: 'dark' },
  chart: { background: 'transparent' },
  grid: { borderColor: '#374151' }, // gray-700
  xaxis: { labels: { style: { colors: '#9ca3af' } } }, // gray-400
  yaxis: { labels: { style: { colors: '#9ca3af' } } }, // gray-400
  tooltip: { theme: 'dark' },
};

document.addEventListener('DOMContentLoaded', async () => {
  // <-- Passage en async
  // Récupérer le nom du joueur depuis l'URL (ex: ?player=Pierre%20MAHOT)
  const params = new URLSearchParams(window.location.search);
  const playerName = params.get('player');

  if (!playerName) {
    document.getElementById('playerName').textContent =
      'Erreur: Joueur non trouvé';
    return;
  }

  document.getElementById('playerName').textContent = playerName;

  // Charger toutes les données de jeu
  const allGames = await getAllGames();

  // Filtrer les parties pour n'inclure que celles de ce joueur
  const playerGames = allGames.filter(
    (game) =>
      Array.isArray(game.players) &&
      game.players.some((p) => {
        const name =
          typeof p === 'object' && p !== null ? p.nick || p.playerId : p;
        return name === playerName;
      })
  );

  if (playerGames.length === 0) {
    document.getElementById('playerName').textContent =
      `Aucune donnée pour ${playerName}`;
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
  const chartEl = document.getElementById('avgScoreChart');
  const totalScore = games.reduce((sum, game) => sum + game.score, 0);
  const avgScore = Math.round(totalScore / games.length);
  const remainingScore = 25000 - avgScore;

  const options = {
    ...chartTheme,
    series: [avgScore, remainingScore],
    chart: { ...chartTheme.chart, type: 'donut', height: '100%' },
    labels: ['Score Moyen', 'Points Restants'],
    colors: ['#ef4444', '#374151'], // red-500, gray-700
    stroke: { colors: ['#1f2937'] }, // gray-800 (fond de la carte)
    legend: {
      position: 'top',
      labels: { colors: '#374151' }, // Utilisation d'un gris foncé (gray-700) pour la lisibilité
    },
    dataLabels: { enabled: false },
    tooltip: {
      y: { formatter: (val) => `${val.toLocaleString()} pts` },
    },
  };

  const chart = new ApexCharts(chartEl, options);
  chart.render();
}

/**
 * Affiche le graphique en barres des scores moyens par carte.
 */
function renderScoreByMapBar(games) {
  const chartEl = document.getElementById('scoreByMapChart');
  // S'assurer que l'élément canvas existe avant de continuer
  if (!chartEl) {
    console.warn("L'élément canvas 'scoreByMapChart' n'a pas été trouvé.");
    return;
  }

  const scoresByMap = {}; // ex: { "A Diverse World": { total: 5000, count: 1 }, ... }

  games.forEach((game) => {
    // Utiliser 'Inconnue' si le nom de la carte n'est pas défini (pour les anciennes parties)
    const mapName = game.mapName || 'Inconnue';
    const roundTime = game.roundTime !== undefined ? game.roundTime : 0;

    let displayMapName = mapName;
    if (roundTime === 0) {
      displayMapName += ' (Infinite)';
    } else {
      const minutes = Math.floor(roundTime / 60);
      const seconds = roundTime % 60;
      const timeStr = seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`;
      displayMapName += ` (${timeStr})`;
    }

    if (!scoresByMap[displayMapName]) {
      scoresByMap[displayMapName] = { total: 0, count: 0 };
    }
    scoresByMap[displayMapName].total += game.score;
    scoresByMap[displayMapName].count++;
  });

  const labels = Object.keys(scoresByMap);
  const data = labels.map((mapName) => {
    return Math.round(scoresByMap[mapName].total / scoresByMap[mapName].count);
  });

  const options = {
    ...chartTheme,
    series: [{ name: 'Score Moyen par Carte', data: data }],
    chart: { ...chartTheme.chart, type: 'bar', height: '100%' },
    plotOptions: { bar: { horizontal: true } },
    colors: ['#16a34a'], // green-600
    xaxis: {
      ...chartTheme.xaxis,
      categories: labels,
      min: 0,
      max: 25000,
      title: { text: 'Score Moyen' },
    },
    legend: { show: false },
  };

  const chart = new ApexCharts(chartEl, options);
  chart.render();
}

/**
 * Affiche le graphique en barres des scores moyens par nombre de joueurs.
 */
function renderScoreByPlayersBar(games) {
  const chartEl = document.getElementById('scoreByPlayersChart');

  const scoresByPlayerCount = {}; // ex: { 2: { total: 5000, count: 1 }, 3: { ... } }

  games.forEach((game) => {
    const count = game.players.length;
    if (!scoresByPlayerCount[count]) {
      scoresByPlayerCount[count] = { total: 0, count: 0 };
    }
    scoresByPlayerCount[count].total += game.score;
    scoresByPlayerCount[count].count++;
  });

  const labels = Object.keys(scoresByPlayerCount)
    .sort((a, b) => a - b)
    .map((count) => `${count} Joueurs`);
  const data = Object.keys(scoresByPlayerCount)
    .sort((a, b) => a - b)
    .map((count) => {
      return Math.round(
        scoresByPlayerCount[count].total / scoresByPlayerCount[count].count
      );
    });

  const options = {
    ...chartTheme,
    series: [{ name: 'Score Moyen', data: data }],
    chart: { ...chartTheme.chart, type: 'bar', height: '100%' },
    colors: ['#dc2626'], // red-600
    xaxis: {
      ...chartTheme.xaxis,
      categories: labels,
    },
    yaxis: {
      ...chartTheme.yaxis,
      min: 0,
      max: 25000,
      title: { text: 'Score Moyen' },
    },
    legend: { show: false },
  };

  const chart = new ApexCharts(chartEl, options);
  chart.render();
}

/**
 * Calcule et affiche la "Meilleure Équipe" (partenaire avec la meilleure moyenne).
 */
function renderBestTeam(games, currentPlayerName) {
  const teammateStats = new Map(); // Map<string, { total: number, count: number }>

  games.forEach((game) => {
    // Ne considérer que les parties à 2 joueurs pour "Meilleure Équipe" pour simplifier
    if (game.players.length === 2) {
      const teammateObj = game.players.find((p) => {
        const name =
          typeof p === 'object' && p !== null ? p.nick || p.playerId : p;
        return name !== currentPlayerName;
      });

      if (teammateObj) {
        const teammate =
          typeof teammateObj === 'object' && teammateObj !== null
            ? teammateObj.nick || teammateObj.playerId
            : teammateObj;
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
    document.getElementById('bestTeamLoading').textContent =
      'Aucune partie en duo trouvée.';
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
  document.getElementById('bestTeamNames').textContent =
    `${currentPlayerName} + ${bestTeammate}`;
  document.getElementById('bestTeamScore').textContent =
    `${Math.round(bestAvg)} pts`;
  document.getElementById('bestTeamGameCount').textContent =
    `sur ${gameCount} partie(s)`;

  document.getElementById('bestTeamLoading').style.display = 'none';
  document.getElementById('bestTeamContent').style.display = 'block';
}

/**
 * Affiche le graphique en ligne de l'évolution du score moyen par jour.
 */
function renderScoreOverTimeChart(games) {
  const chartEl = document.getElementById('scoreOverTimeChart');

  const scoresByDay = {}; // ex: { '2025-11-10': { total: 5000, count: 1 }, ... }

  games.forEach((game) => {
    const day = game.date.split('T')[0]; // Format 'YYYY-MM-DD'
    if (!scoresByDay[day]) {
      scoresByDay[day] = { total: 0, count: 0 };
    }
    scoresByDay[day].total += game.score;
    scoresByDay[day].count++;
  });

  const data = Object.keys(scoresByDay)
    .sort()
    .map((day) => {
      return {
        x: day,
        y: Math.round(scoresByDay[day].total / scoresByDay[day].count),
      };
    });

  const options = {
    ...chartTheme,
    series: [{ name: 'Score Moyen par Jour', data: data }],
    chart: {
      ...chartTheme.chart,
      type: 'line',
      height: '100%',
      zoom: { enabled: true },
      toolbar: {
        tools: {
          download: false, // On peut cacher les outils non désirés
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
    },
    colors: ['#ef4444'], // red-500
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      ...chartTheme.xaxis,
      type: 'datetime',
      labels: { ...chartTheme.xaxis.labels, datetimeUTC: false }, // Pour utiliser le fuseau horaire local
    },
    yaxis: { ...chartTheme.yaxis, min: 0, max: 25000 },
    legend: { show: false },
  };

  const chart = new ApexCharts(chartEl, options);
  chart.render();
}
