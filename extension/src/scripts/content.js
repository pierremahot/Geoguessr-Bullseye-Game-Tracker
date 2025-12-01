// Un drapeau pour s'assurer que nous n'enregistrons qu'une seule fois par partie.
let hasGameBeenSaved = false;
// Un objet pour stocker les données de la partie en cours.
let currentGameData = null;
// Un objet pour stocker les données du lobby (pour les pseudos)
let lobbyData = null;

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
                        // We construct a BullseyePayload compatible object
                        const payloadToSend = {
                            gameId: newGame.id || newGame.gameId,
                            totalDuration: newGame.totalDuration,
                            bullseye: {
                                state: newGame
                            }
                        };

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

// 2. Fonction pour commencer à observer la page (pour le bouton Save)
function startObserver() {
    console.log('Bullseye Tracker: Observateur activé...');

    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    const callback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;

                    // Inject "Save to Tracker" button on Game Finished screen
                    const endScreenSelector = '.game-finished_container__TEK6Q'; // Adjust selector if needed
                    // Also check for the "Play Again" or "View Summary" area to inject near
                    if (node.querySelector(endScreenSelector) || node.matches(endScreenSelector)) {
                        injectSaveButton();
                    }
                });
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);

    // Initial check
    injectSaveButton();
}

function injectSaveButton() {
    // Check if we are on a finished game page and button not already injected
    if (document.querySelector('#bullseye-tracker-save-btn')) return;

    // Try to find a suitable place to inject. 
    // Usually near the "Play Again" button or the score.
    const container = document.querySelector('.game-finished_container__TEK6Q') ||
        document.querySelector('div[class*="game-finished_buttons"]'); // Heuristic

    if (container) {
        console.log('Bullseye Tracker: Injecting Save Button...');
        const btn = document.createElement('button');
        btn.id = 'bullseye-tracker-save-btn';
        btn.innerText = 'Save to Tracker';
        btn.style.cssText = 'background-color: #7c3aed; color: white; padding: 10px 20px; border-radius: 9999px; font-weight: bold; margin-top: 10px; cursor: pointer; border: none; z-index: 9999;';

        btn.onclick = () => {
            if (currentGameData) {
                saveGame(false);
                btn.innerText = 'Saved!';
                btn.disabled = true;
                btn.style.backgroundColor = '#10b981';
            } else {
                alert('No game data available to save. Please refresh the page to capture data if this is an old game.');
            }
        };

        container.appendChild(btn);
    }
}

// 3. Fonction pour surveiller les changements d'URL (Reset state)
function startUrlObserver() {
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            onUrlChange(url);
        }
    }).observe(document, { subtree: true, childList: true });

    onUrlChange(location.href);

    function onUrlChange(newUrl) {
        console.log('Bullseye Tracker: Changement d\'URL détecté ->', newUrl);
        if (newUrl.includes('/bullseye/') && !currentGameData) {
            // New game potentially starting, wait for API/WS
            hasGameBeenSaved = false;
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

// Écouter les messages du script injecté
window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    // 0. Lobby Data (for nicknames)
    if (event.data.type === 'BULLSEYE_LOBBY_DATA') {
        console.log('Bullseye Tracker: Lobby data received', event.data.payload);
        lobbyData = event.data.payload;
    }

    // 1. Initial Game Data (API)
    if (event.data.type === 'BULLSEYE_GAME_DATA') {
        console.log('Bullseye Tracker: Game API data received', event.data.payload);
        // Initialize or Reset current game data
        // The payload IS the state (mostly)
        currentGameData = event.data.payload;
        hasGameBeenSaved = false;
        updateScoreFromGameData(currentGameData);
        fetchMissingNicknames();
        saveLiveState();
    }

    // 2. WebSocket Events
    if (event.data.type === 'BULLSEYE_WS') {
        const wsData = event.data.payload;
        console.log('Bullseye Tracker: WS data received', wsData);

        if (wsData.code === 'BullseyeRoundStarted') {
            // Update state with new round info
            if (wsData.bullseye && wsData.bullseye.state) {
                mergeGameState(wsData.bullseye.state);
            }
        } else if (wsData.code === 'BullseyeGuess') {
            // Update state with guess info
            if (wsData.bullseye && wsData.bullseye.state) {
                mergeGameState(wsData.bullseye.state);
            }
        } else if (wsData.code === 'BullseyeRoundEnded') {
            // Update state
            if (wsData.bullseye && wsData.bullseye.state) {
                mergeGameState(wsData.bullseye.state);

                // Check if game is finished
                if (wsData.bullseye.state.status === 'Finished') {
                    console.log('Bullseye Tracker: Game Finished via WS!');
                    saveGame(false);
                }
            }
        } else if (wsData.code === 'GameAborted') {
            console.log('Bullseye Tracker: Game Aborted via WS!');
            // For aborted games, we might not have the full state in the WS payload (it's null in the example)
            // So we save whatever we have currently
            saveGame(true);
        }
    }
});

function mergeGameState(newState) {
    if (!currentGameData) {
        // If we missed the initial API call (e.g. refresh mid-game), initialize from WS state
        currentGameData = newState;
    } else {
        // Merge fields. 
        // CAUTION: WS state 'players' array only has IDs and guesses, no nicks.
        // We want to preserve the nicks we got from the initial API call.
        const existingPlayers = currentGameData.players;

        currentGameData = { ...currentGameData, ...newState };

        // Restore/Merge players
        if (existingPlayers && Array.isArray(existingPlayers) && existingPlayers.length > 0) {
            // If existing players are strings (nicks) or objects with nicks
            // and new players (from WS) are just objects with IDs...
            // We should try to keep the nicks.

            // Actually, the best way is probably to NOT overwrite 'players' from newState 
            // if we already have them, OR to merge guesses into the existing player objects.
            // But 'newState.players' has the latest guesses.

            if (newState.players && Array.isArray(newState.players)) {
                currentGameData.players = newState.players.map(newP => {
                    const existingP = existingPlayers.find(ep =>
                        (typeof ep === 'string' ? ep === newP.playerId : (ep.playerId === newP.playerId || ep.nick === newP.playerId))
                    );

                    // If existingP is a string, it's the nick.
                    // If it's an object, it might have a nick property.
                    let nick = 'Unknown';
                    if (typeof existingP === 'string') nick = existingP;
                    else if (existingP && existingP.nick) nick = existingP.nick;
                    else if (existingP && existingP.playerId) nick = existingP.playerId; // Fallback

                    // Return merged object: keep WS data (guesses) but add nick
                    return { ...newP, nick: nick };
                });
            } else {
                // If newState doesn't have players, keep old ones
                currentGameData.players = existingPlayers;
            }
        }
    }

    // Recalculate Score using the updated data
    // We pass currentGameData because it now contains the merged 'rounds'
    updateScoreFromGameData(currentGameData);

    // Try to fetch nicknames if missing
    fetchMissingNicknames();

    // Recalculate derived stats if needed (like total duration if not provided directly)
    // The backend expects 'totalDuration' at the top level of payload, or we can put it in the state.
    // Let's calculate it to be safe and store it.

    if (currentGameData.rounds && currentGameData.rounds.length > 0) {
        const sortedRounds = [...currentGameData.rounds].sort((a, b) => a.roundNumber - b.roundNumber);
        const firstRound = sortedRounds[0];
        if (firstRound && firstRound.startTime) {
            const startTime = new Date(firstRound.startTime).getTime();
            const now = Date.now();
            if (!isNaN(startTime) && now > startTime) {
                currentGameData.totalDuration = Math.floor((now - startTime) / 1000);
            }
        }
    }

    saveLiveState();
}

function updateScoreFromGameData(gameData) {
    if (!gameData) return;

    let totalScore = 0;
    if (gameData.rounds && Array.isArray(gameData.rounds)) {
        totalScore = gameData.rounds.reduce((sum, round) => {
            const points = (round.score && typeof round.score.points === 'number') ? round.score.points : 0;
            return sum + points;
        }, 0);
    }

    // Update the gameData object directly
    gameData.score = totalScore;
    console.log('Bullseye Tracker: Calculated score:', totalScore);
}

function saveLiveState() {
    if (currentGameData && !hasGameBeenSaved) {
        chrome.storage.local.set({ currentLiveGame: currentGameData });
    }
}

async function fetchMissingNicknames() {
    if (!currentGameData || !currentGameData.players) return;

    let updated = false;

    // 1. Try to enrich from Lobby Data first
    if (lobbyData && lobbyData.players) {
        currentGameData.players.forEach(p => {
            if (typeof p === 'object' && p.playerId && (!p.nick || p.nick === p.playerId || p.nick === 'Unknown')) {
                const lobbyPlayer = lobbyData.players.find(lp => lp.playerId === p.playerId);
                if (lobbyPlayer && lobbyPlayer.nick) {
                    p.nick = lobbyPlayer.nick;
                    updated = true;
                    console.log(`Bullseye Tracker: Enriched nick from Lobby for ${p.playerId} -> ${p.nick}`);
                }
            }
        });
    }

    // 2. Fetch from API if still missing
    const fetchPromises = currentGameData.players.map(async (p) => {
        if (typeof p === 'object' && p.playerId && (!p.nick || p.nick === p.playerId || p.nick === 'Unknown')) {
            try {
                const response = await fetch(`https://www.geoguessr.com/api/v3/users/${p.playerId}`);
                if (response.ok) {
                    const userData = await response.json();
                    if (userData && userData.nick) {
                        p.nick = userData.nick;
                        updated = true;
                        console.log(`Bullseye Tracker: Fetched nick for ${p.playerId} -> ${p.nick}`);
                    }
                }
            } catch (err) {
                console.error(`Bullseye Tracker: Failed to fetch nick for ${p.playerId}`, err);
            }
        }
    });

    await Promise.all(fetchPromises);

    if (updated) {
        saveLiveState();
    }
}