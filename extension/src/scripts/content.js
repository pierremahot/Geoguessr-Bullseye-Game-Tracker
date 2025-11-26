// Un drapeau pour s'assurer que nous n'enregistrons qu'une seule fois par partie.
let hasGameBeenSaved = false;
// Un objet pour stocker les données de la partie en cours.
let currentGameData = null;
// Variable to store the latest raw WebSocket payload
let latestPayload = null;
// Variable to store the latest raw Lobby payload
let latestLobbyPayload = null;

// ... (rest of the file)


// Une variable pour mettre en cache le nom de la carte sélectionnée dans le lobby.


// 1. Fonction pour récupérer les données et les sauvegarder
function saveGame(isGaveUp = false) {
    if (hasGameBeenSaved) {
        console.log('Bullseye Tracker: Game already saved.');
        return;
    }
    if (!currentGameData) {
        console.error('Bullseye Tracker: Tentative de sauvegarde sans données de partie.');
        return;
    }

    try {
        // Si la partie est terminée normalement, on fait une dernière passe pour avoir le score final.
        if (!isGaveUp) {
            const finalScoreEl = document.querySelector('h2.game-finished_points__SMS4e');
            if (finalScoreEl) {
                const finalScore = parseInt(finalScoreEl.innerText.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(finalScore) && finalScore !== currentGameData.score) {
                    console.log(`Bullseye Tracker: Score final détecté -> ${finalScore}`);
                    currentGameData.score = finalScore;
                } else {
                    console.log(`Bullseye Tracker: Score final confirmé -> ${currentGameData.score}`);
                }
            }
        }

        // --- Construire et sauvegarder l'objet de la partie ---
        const newGame = {
            ...currentGameData,
            date: new Date().toISOString(),
            gaveUp: isGaveUp,
        };

        console.log('Bullseye Tracker: Sauvegarde de l\'objet partie suivant :', newGame);

        // Sauvegarder dans chrome.storage
        chrome.storage.local.get(['games'], (result) => {
            const games = result.games || [];
            games.push(newGame);
            chrome.storage.local.set({ games: games }, () => {
                const status = isGaveUp ? 'abandonnée' : 'terminée';
                console.log(`Bullseye Tracker: Partie ${status} sauvegardée !`);
                hasGameBeenSaved = true; // Marquer comme sauvegardé
                currentGameData = null; // Nettoyer les données de la partie en cours

                // Clear live game state
                chrome.storage.local.remove('currentLiveGame');

                // --- SYNC WITH API ---
                chrome.storage.local.get(['apiUrl', 'apiToken'], (config) => {
                    console.log('Bullseye Tracker: Retrieved config:', config);
                    if (config.apiUrl) {
                        console.log(`Bullseye Tracker: Syncing game to ${config.apiUrl}...`);

                        // Construct the payload to send
                        // 1. Start with the raw WS payload if available, or a basic object
                        let payloadToSend = latestPayload ? { ...latestPayload } : {};

                        // 2. If we don't have a WS payload, try to construct a minimal compatible one from newGame
                        if (!latestPayload) {
                            payloadToSend.gameId = newGame.id;
                            // We could try to reconstruct more, but the backend mainly needs gameId and raw data
                            // If we have nothing else, we might send newGame as a fallback field?
                            // But backend expects BullseyePayload structure.
                            // Let's at least ensure gameId is there.
                        }

                        // 3. Inject the Lobby payload if available
                        if (latestLobbyPayload) {
                            console.log('Bullseye Tracker: Injecting lobby payload into request.');
                            payloadToSend.lobby = latestLobbyPayload;
                        }

                        console.log('Bullseye Tracker: Sending payload (JSON):', JSON.stringify(payloadToSend, null, 2));

                        fetch(config.apiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(config.apiToken ? { 'Authorization': `Bearer ${config.apiToken}` } : {})
                            },
                            body: JSON.stringify(payloadToSend)
                        })
                            .then(res => {
                                if (res.ok) console.log('Bullseye Tracker: Game synced successfully!');
                                else console.error('Bullseye Tracker: Sync failed', res.status);
                            })
                            .catch(err => console.error('Bullseye Tracker: Sync error', err));
                    }
                });
            });
        });

    } catch (error) {
        console.error('Bullseye Tracker Save Error:', error);
    }
}

// 2. Fonction pour commencer à observer la page
function startObserver() {
    console.log('Bullseye Tracker: Observateur activé...');

    const targetNode = document.body;
    const config = { childList: true, subtree: true, characterData: true };

    const callback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) { // Détection d'éléments ajoutés
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return; // Ignorer les noeuds qui ne sont pas des éléments

                    // --- DÉTECTION DE FIN DE PARTIE (TERMINÉE) ---
                    const endScreenSelector = '.game-finished_container__TEK6Q';
                    if (node.querySelector(endScreenSelector) || node.matches(endScreenSelector)) {
                        console.log('Bullseye Tracker: Écran de fin de partie détecté.');
                        saveGame(false); // Sauvegarder comme partie terminée
                        return;
                    }

                    // --- DÉTECTION DU BOUTON "FINISH GAME" ---
                    const finishButtonSelector = 'button.button_variantPrimary__u3WzI';
                    const finishButton = node.querySelector(finishButtonSelector) || (node.matches(finishButtonSelector) ? node : null);
                    if (finishButton && finishButton.innerText.includes('Finish game')) {
                        console.log('Bullseye Tracker: Bouton "Finish game" détecté. Ajout du listener.');
                        finishButton.addEventListener('click', () => {
                            setTimeout(() => saveGame(false), 500); // Attendre 500ms que l'UI se mette à jour
                        }, { once: true });
                    }




                });



            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
}

// Fonction pour initialiser les données d'une nouvelle partie
function initializeNewGame(url) {
    console.log('Bullseye Tracker: Détection d\'une nouvelle partie.');
    hasGameBeenSaved = false;

    // Si on a déjà des données (venant de l'interception dans le lobby), on les utilise !
    if (currentGameData && currentGameData.id) {
        console.log('Bullseye Tracker: Utilisation des données interceptées dans le lobby.', currentGameData);
        currentGameData.url = url; // Mettre à jour l'URL
    } else {
        console.log('Bullseye Tracker: Aucune donnée de lobby interceptée pour le moment.');
    }
}

// 3. Fonction pour surveiller les changements d'URL
function startUrlObserver() {
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            onUrlChange(url);
        }
    }).observe(document, { subtree: true, childList: true });

    // Vérifier l'URL actuelle au moment du chargement du script
    onUrlChange(location.href);

    function onUrlChange(newUrl) {
        console.log('Bullseye Tracker: Changement d\'URL détecté ->', newUrl);

        // Cas 1: L'utilisateur abandonne et retourne au lobby
        if (newUrl.includes('/party') && currentGameData && !hasGameBeenSaved) {
            console.log('Bullseye Tracker: Retour au lobby détecté (abandon).');
            saveGame(true); // Sauvegarder comme partie abandonnée
        }
        // Cas 2: L'utilisateur est dans le lobby (après une partie ou au démarrage)
        else if (newUrl.includes('/party')) {
            console.log('Bullseye Tracker: Retour au lobby détecté. Prêt pour la prochaine partie.');

        }
        // Cas 3: L'utilisateur lance une nouvelle partie Bullseye
        else if (newUrl.includes('/bullseye/')) {
            initializeNewGame(newUrl);
        }
    }
}

// Démarrer l'observateur
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        startObserver();
        startUrlObserver();
    });
} else {
    startObserver();
    startUrlObserver();
}

// Injecter le script d'interception
const script = document.createElement('script');
script.src = chrome.runtime.getURL('scripts/inject.js');
script.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Écouter les messages du script injecté
window.addEventListener('message', (event) => {
    // On vérifie que le message vient bien de la même fenêtre
    if (event.source !== window) return;

    if (event.data.type && event.data.type === 'BULLSEYE_LOBBY_DATA') {
        console.log('Bullseye Tracker: Données du lobby interceptées !', event.data.payload);
        const lobbyData = event.data.payload;
        latestLobbyPayload = lobbyData; // Store raw lobby data

        // Si on a intercepté les données, on peut initialiser/mettre à jour currentGameData
        // Note: On utilise l'URL actuelle car l'interception se fait sur la page du lobby
        const currentUrl = location.href;

        // On s'assure qu'on est bien dans un contexte où on veut tracker (optionnel, mais plus sûr)
        // Mais comme l'API est spécifique, c'est probablement bon.

        const gameId = lobbyData.gameLobbyId;
        const players = lobbyData.players?.map(p => p.nick.trim()) || [];
        const mapName = lobbyData.mapName;

        // Si currentGameData n'existe pas encore, on le crée
        if (!currentGameData) {
            currentGameData = {
                id: gameId,
                players: players,
                mapName: mapName || 'Inconnue',
                score: 0,
                url: currentUrl
            };
            console.log('Bullseye Tracker: Données initialisées via interception lobby.', currentGameData);
        } else {
            // Mise à jour des données existantes
            currentGameData.players = players;
            if (gameId) currentGameData.id = gameId;
            if (mapName) currentGameData.mapName = mapName;

            // Capture options if available (e.g. roundTime, mapSlug)
            if (lobbyData.gameOptions) {
                if (lobbyData.gameOptions.roundTime !== undefined) currentGameData.roundTime = lobbyData.gameOptions.roundTime;
                if (lobbyData.gameOptions.mapSlug) currentGameData.mapSlug = lobbyData.gameOptions.mapSlug;
            }

            console.log('Bullseye Tracker: Données mises à jour via interception lobby.', currentGameData);
        }
        saveLiveState();
    }

    if (event.data.type && event.data.type === 'BULLSEYE_GAME_DATA') {
        console.log('Bullseye Tracker: Données de jeu API interceptées !', event.data.payload);
        const gameData = event.data.payload;
        latestLobbyPayload = gameData; // Use this as the "lobby" payload as it contains similar info

        const currentUrl = location.href;
        const gameId = gameData.gameLobbyId || gameData.gameId; // Handle potential variations
        const players = gameData.players?.map(p => p.nick.trim()) || [];
        const mapName = gameData.mapName;

        if (!currentGameData) {
            currentGameData = {
                id: gameId,
                players: players,
                mapName: mapName || 'Inconnue',
                score: 0,
                url: currentUrl
            };
            console.log('Bullseye Tracker: Données initialisées via interception API.', currentGameData);
        } else {
            // Mise à jour des données existantes
            currentGameData.players = players;
            if (gameId) currentGameData.id = gameId;
            if (mapName) currentGameData.mapName = mapName;

            // Capture options
            if (gameData.gameOptions) {
                if (gameData.gameOptions.roundTime !== undefined) currentGameData.roundTime = gameData.gameOptions.roundTime;
                if (gameData.gameOptions.mapSlug) currentGameData.mapSlug = gameData.gameOptions.mapSlug;
            }
            console.log('Bullseye Tracker: Données mises à jour via interception API.', currentGameData);
        }
        saveLiveState();
    }

    // Handle API Guess Response
    if (event.data.type === 'BULLSEYE_GUESS') {
        const gameData = event.data.payload;
        console.log('Bullseye Tracker: Guess API data received', gameData);
        updateScoreFromGameData(gameData);
    }

    // Handle WebSocket Guess Message
    if (event.data.type === 'BULLSEYE_WS') {
        const wsData = event.data.payload;
        console.log('Bullseye Tracker: WS Guess data received', wsData);
        latestPayload = wsData; // Store the raw payload
        // The WS payload has a 'bullseye' object which contains the game state similar to the API
        if (wsData.bullseye) {
            updateScoreFromGameData(wsData.bullseye);
        }
    }
});

// Helper to ensure currentGameData exists using the rich data from API/WS
function ensureGameData(data) {
    // Try to find the state object
    // WS: data is bullseye object -> data.state
    // API: data might be the state itself or have a state property
    const state = data.state || (data.gameId ? data : null);

    // If we don't have data yet, try to initialize
    if (!currentGameData) {
        if (state && state.gameId) {
            console.log('Bullseye Tracker: Initializing game data from event payload...');

            const gameId = state.gameId;
            const mapName = state.mapName || (state.options && state.options.mapSlug) || 'Inconnue';

            // Extract players
            let players = [];
            if (state.players && Array.isArray(state.players)) {
                players = state.players.map(p => p.nick || p.playerId || 'Unknown');
            }

            currentGameData = {
                id: gameId,
                players: players,
                mapName: mapName,
                score: 0,
                url: location.href,
                roundTime: state.options ? state.options.roundTime : 0,
                mapSlug: state.options ? state.options.mapSlug : null
            };
            console.log('Bullseye Tracker: Data initialized from event:', currentGameData);
            return true;
        }
        return false;
    }

    // If we DO have data, check if we can enrich it with missing info
    if (currentGameData && state) {
        let updated = false;

        // Update roundTime if missing
        if (state.options && state.options.roundTime !== undefined && currentGameData.roundTime === undefined) {
            currentGameData.roundTime = state.options.roundTime;
            updated = true;
        }

        // Update mapSlug if missing
        if (state.options && state.options.mapSlug && !currentGameData.mapSlug) {
            currentGameData.mapSlug = state.options.mapSlug;
            updated = true;
        }

        // Update mapName if it was unknown
        if (currentGameData.mapName === 'Inconnue' && state.mapName) {
            currentGameData.mapName = state.mapName;
            updated = true;
        }

        if (updated) {
            console.log('Bullseye Tracker: Game data enriched from event:', currentGameData);
            saveLiveState();
        }
    }

    return true;
}

// Helper to calculate and update score from game data
function updateScoreFromGameData(data) {
    // Try to initialize if missing
    ensureGameData(data);

    if (!currentGameData) return;

    // Handle both API (data.rounds) and WS (data.state.rounds) structures
    const rounds = data.rounds || (data.state && data.state.rounds);

    if (rounds && Array.isArray(rounds) && rounds.length > 0) {
        let totalScore = 0;

        // Calculate Score
        rounds.forEach(round => {
            if (round.score && typeof round.score.points === 'number') {
                totalScore += round.score.points;
            }
        });

        // Calculate Total Duration
        // We use the start time of the first round as the game start.
        // The total duration is simply Now - GameStart.
        // This accounts for all rounds and intermissions.
        let totalDurationMs = 0;

        // Sort rounds by roundNumber to be sure we have the first one
        const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
        const firstRound = sortedRounds[0];

        if (firstRound && firstRound.startTime) {
            const startTime = new Date(firstRound.startTime).getTime();
            const now = Date.now();
            if (!isNaN(startTime) && now > startTime) {
                totalDurationMs = now - startTime;
            }
        }

        let hasChanged = false;
        if (totalScore !== currentGameData.score) {
            console.log(`Bullseye Tracker: Score updated via interception -> ${totalScore}`);
            currentGameData.score = totalScore;
            hasChanged = true;
        }

        // Always update duration
        currentGameData.totalDuration = Math.floor(totalDurationMs / 1000); // Store in seconds

        saveLiveState();
    }
}

// Helper to save live state to storage
function saveLiveState() {
    if (currentGameData && !hasGameBeenSaved) {
        chrome.storage.local.set({ currentLiveGame: currentGameData });
    }
}