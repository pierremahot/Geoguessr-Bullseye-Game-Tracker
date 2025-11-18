// Un drapeau pour s'assurer que nous n'enregistrons qu'une seule fois par partie.
let hasGameBeenSaved = false;
// Un objet pour stocker les données de la partie en cours.
let currentGameData = null;

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
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // Vérifier si c'est un élément
                         // Nous cherchons le conteneur de fin de partie.
                         // --- DÉTECTION DE FIN DE PARTIE (TERMINÉE) ---
                        const endScreenSelector = '.game-finished_container__TEK6Q';
                        if (node.querySelector(endScreenSelector) || node.classList.contains(endScreenSelector.substring(1))) {
                            console.log('Bullseye Tracker: Écran de fin de partie détecté.');
                            saveGame(false); // Sauvegarder comme partie terminée
                            return;
                        }

                        const finishButtonSelector = 'button.button_variantPrimary__u3WzI';
                        const finishButton = node.querySelector(finishButtonSelector) || (node.matches && node.matches(finishButtonSelector) ? node : null);
                        if (finishButton && finishButton.innerText.includes('Finish game')) {
                            console.log('Bullseye Tracker: Bouton "Finish game" détecté. Ajout du listener.');
                            finishButton.addEventListener('click', () => {
                                setTimeout(() => saveGame(false), 500); // Attendre 500ms que l'UI se mette à jour
                            }, { once: true }); // Le listener ne s'exécutera qu'une fois
                        }
                    }
                }
            } else if (mutation.type === 'characterData' && currentGameData) { // Détection de changement de texte
                // On vérifie si le changement a eu lieu dans notre élément de score
                const scoreValueEl = mutation.target.parentElement;
                if (scoreValueEl && scoreValueEl.matches('.status_value__oUOZ0') && scoreValueEl.closest('[data-qa="score"]')) {
                    const newScore = parseInt(scoreValueEl.textContent.replace(/[^0-9]/g, ''), 10);
                    // On vérifie que le score est un nombre et qu'il a changé
                    if (!isNaN(newScore) && newScore !== currentGameData.score) {
                        currentGameData.score = newScore;
                        console.log(`Bullseye Tracker: Score mis à jour -> ${newScore}`);
                    }
                }
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
}

// Fonction pour initialiser les données d'une nouvelle partie
async function initializeNewGame(url) {
    console.log('Bullseye Tracker: Détection d\'une nouvelle partie. En attente des données...');
    hasGameBeenSaved = false;
    currentGameData = null; // Réinitialiser

    // Attendre que la page soit prête en observant l'apparition d'un élément clé
    const waitForGameData = new Promise((resolve, reject) => {
        const observer = new MutationObserver((mutations, obs) => {
            const mapNameEl = document.querySelector('[data-qa="map-name"]');
            if (mapNameEl) {
                console.log('Bullseye Tracker: Données de la partie détectées dans le DOM.');
                obs.disconnect(); // Arrêter d'observer
                try {
                    const nextDataEl = document.getElementById('__NEXT_DATA__');
                    if (!nextDataEl || !nextDataEl.textContent) {
                        return reject(new Error('__NEXT_DATA__ introuvable.'));
                    }
                    const data = JSON.parse(nextDataEl.textContent);
                    const lobby = data?.props?.pageProps?.lobbyToJoin;

                    if (!lobby) {
                        return reject(new Error('Données du lobby introuvables.'));
                    }
                    resolve(lobby);
                } catch (error) {
                    reject(error);
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Sécurité : si rien n'est trouvé après 10 secondes, on abandonne.
        setTimeout(() => {
            observer.disconnect();
            reject(new Error('Timeout: les données de la partie n\'ont pas été trouvées à temps.'));
        }, 10000);
    });

    try {
        const lobbyData = await waitForGameData;
        const gameId = lobbyData.gameLobbyId || `game_${new Date().getTime()}`;
        const players = lobbyData.players?.map(p => p.nick.trim()) || [];
        const mapName = lobbyData.mapName || 'Inconnue';

        currentGameData = {
            id: gameId,
            players: players,
            mapName: mapName,
            score: 0, // Le score commence à 0
            url: url
        };
        console.log('Bullseye Tracker: Données de la partie initialisées.', currentGameData);
    } catch (error) {
        console.error('Bullseye Tracker: Erreur lors de l\'initialisation de la partie.', error);
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
    }).observe(document, {subtree: true, childList: true});
 
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
startObserver();
startUrlObserver(); // Démarrer la surveillance de l'URL