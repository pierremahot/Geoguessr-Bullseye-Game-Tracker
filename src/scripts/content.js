// Un drapeau pour s'assurer que nous n'enregistrons qu'une seule fois par partie.
let hasGameBeenSaved = false;
// Un objet pour stocker les données de la partie en cours.
let currentGameData = null;
// Une variable pour mettre en cache le nom de la carte sélectionnée dans le lobby.
let cachedMapName = 'Inconnue';

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

                    // --- DÉTECTION DU NOM DE LA CARTE DANS LE LOBBY ---
                    // On cherche le conteneur parent qui contient le bouton de sélection de carte
                    const mapSelectionContainer = document.querySelector('[data-qa="party-select-map-button"]')?.parentElement;
                    let mapTitleEl = null;
                    if (mapSelectionContainer) {
                        mapTitleEl = mapSelectionContainer.querySelector('h3.footer-controls_buttonTitle__i1udH');
                    }
                    if (mapTitleEl && mapTitleEl.textContent) {
                        const newMapName = mapTitleEl.textContent.trim();
                        if (newMapName !== cachedMapName) {
                            cachedMapName = newMapName;
                            console.log(`Bullseye Tracker: Nom de carte mis en cache -> ${cachedMapName}`);
                        }
                    }

                    // --- DÉTECTION DU SCORE DE FIN DE TOUR ---
                    if (currentGameData) {
                        const roundScoreSelector = 'h2.round-score_points__BQdOM';
                        const roundScoreEl = node.querySelector(roundScoreSelector) || (node.matches(roundScoreSelector) ? node : null);
                        if (roundScoreEl) {
                            const roundScore = parseInt(roundScoreEl.textContent.replace(/[^0-9]/g, ''), 10);
                            currentGameData.score = roundScore; // Le score du tour devient le score total
                            console.log(`Bullseye Tracker: Score mis à jour (via score du tour) -> ${roundScore}`);
                        }
                    }

                    // --- DÉTECTION DU SCORE (VIA AJOUT D'ÉLÉMENT) ---
                    if (currentGameData) {
                        const scoreContainer = node.querySelector('[data-qa="score"]') || (node.matches('[data-qa="score"]') ? node : null);
                        if (scoreContainer) {
                            const scoreValueEl = scoreContainer.querySelector('.status_value__oUOZ0');
                            if (scoreValueEl) {
                                const newScore = parseInt(scoreValueEl.textContent.replace(/[^0-9]/g, ''), 10);
                                if (!isNaN(newScore) && newScore !== currentGameData.score) {
                                    currentGameData.score = newScore;
                                    console.log(`Bullseye Tracker: Score mis à jour (via DOM) -> ${newScore}`);
                                }
                            }
                        }
                    }
                });
            } else if (mutation.type === 'characterData') { // Détection de changement de texte
                // On vérifie si le changement a eu lieu dans notre élément de score
                const scoreValueEl = mutation.target.parentElement;
                if (scoreValueEl && scoreValueEl.matches('.status_value__oUOZ0') && scoreValueEl.closest('[data-qa="score"]')) {
                    const newScore = parseInt(scoreValueEl.textContent.replace(/[^0-9]/g, ''), 10);
                    // On vérifie que le score est un nombre et qu'il a changé
                    if (!isNaN(newScore) && newScore !== currentGameData.score) {
                        currentGameData.score = newScore;
                        console.log(`Bullseye Tracker: Score mis à jour (via texte) -> ${newScore}`);
                    }
                }

                // --- DÉTECTION CHANGEMENT NOM CARTE (TEXTE) ---
                const mapTitleParent = mutation.target.parentElement;
                // On s'assure que le titre modifié est bien celui associé au bouton de sélection de carte
                const mapSelectionContainer = document.querySelector('[data-qa="party-select-map-button"]')?.parentElement;
                if (mapTitleParent && mapTitleParent.matches('h3.footer-controls_buttonTitle__i1udH') && mapSelectionContainer?.contains(mapTitleParent)) {
                    const newMapName = mapTitleParent.textContent.trim();
                    if (newMapName !== cachedMapName) {
                        cachedMapName = newMapName;
                        console.log(`Bullseye Tracker: Nom de carte mis à jour en cache -> ${cachedMapName}`);
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
        // Fonction pour tenter de récupérer les données du lobby
        const tryToGetData = () => {
            const scoreEl = document.querySelector('[data-qa="score"]');
            if (!scoreEl) return false; // L'interface du jeu n'est pas encore là

            const nextDataEl = document.getElementById('__NEXT_DATA__');
            if (nextDataEl?.textContent) {
                const data = JSON.parse(nextDataEl.textContent);
                const lobby = data?.props?.pageProps?.lobbyToJoin || data?.props?.pageProps?.lobby;
                if (lobby) {
                    console.log('Bullseye Tracker: Données du lobby trouvées !');
                    resolve(lobby);
                    return true; // Succès
                }
            }
            return false; // Données pas encore prêtes
        };

        const observer = new MutationObserver((mutations, obs) => {
            if (tryToGetData()) {
                obs.disconnect();
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

        currentGameData = {
            id: gameId,
            players: players, // Utilisation du nom de carte mis en cache depuis le lobby
            mapName: cachedMapName,
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
            // Tenter de lire le nom de la carte immédiatement au cas où il serait déjà affiché
            const mapSelectionContainer = document.querySelector('[data-qa="party-select-map-button"]')?.parentElement;
            let mapTitleEl = null;
            if (mapSelectionContainer) {
                mapTitleEl = mapSelectionContainer.querySelector('h3.footer-controls_buttonTitle__i1udH');
            }
            if (mapTitleEl && mapTitleEl.textContent) {
                const newMapName = mapTitleEl.textContent.trim();
                cachedMapName = newMapName;
                console.log(`Bullseye Tracker: Nom de carte initial mis en cache -> ${cachedMapName}`);
            }
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