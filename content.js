// Un drapeau pour s'assurer que nous n'enregistrons qu'une seule fois par partie.
let hasGameBeenSaved = false;

// 1. Fonction pour récupérer les données et les sauvegarder
function scrapeAndSave() {
    if (hasGameBeenSaved) {
        console.log('Bullseye Tracker: Game already saved.');
        return;
    }

    console.log('Bullseye Tracker: Fin de partie détectée ! Récupération des données...');

    let players = []; // <-- MODIFIÉ : Devient un tableau
    let score = 0;
    let gameId = null;
    let gameUrl = window.location.href; 

    try {
        // --- Récupérer les joueurs et l'ID de la partie depuis __NEXT_DATA__ (Stable) ---
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (nextDataEl && nextDataEl.textContent) {
            const data = JSON.parse(nextDataEl.textContent);
            
            // Récupérer les joueurs
            const playerList = data?.props?.pageProps?.lobbyToJoin?.players;
            if (playerList && Array.isArray(playerList)) {
                players = playerList.map(p => p.nick.trim()); // <-- MODIFIÉ : Stocké comme tableau
            }

            // Récupérer un ID de partie unique pour éviter les doublons
            gameId = data?.props?.pageProps?.lobbyToJoin?.gameLobbyId;
            if (!gameId) {
                 gameId = `game_${new Date().getTime()}`; // ID de secours
            }

        } else {
            console.warn('Bullseye Tracker: __NEXT_DATA__ introuvable.');
        }

        // --- CORRECTION : Récupérer le score final ---
        // Essayer le sélecteur d'écran de fin de partie
        let scoreEl = document.querySelector('h2.game-finished_points__SMS4e');
        
        if (!scoreEl) {
             // Fallback sur le sélecteur d'écran de fin de round
             scoreEl = document.querySelector('h2.round-score_points__BQdOM');
        }

        if (scoreEl) {
            score = parseInt(scoreEl.innerText.replace(/[^0-9]/g, ''), 10);
        } else {
             console.warn('Bullseye Tracker: Élément du score final introuvable.');
        }
        
        if (isNaN(score)) score = 0;

        // --- Construire et sauvegarder l'objet de la partie ---
        const newGame = {
            id: gameId,
            date: new Date().toISOString(),
            players: players, // Sera un tableau
            score: score, // Sera le score correct
            gaveUp: false, 
            url: gameUrl 
        };

        // Sauvegarder dans chrome.storage
        chrome.storage.local.get(['games'], (result) => {
            const games = result.games || [];

            // Vérifier si cet ID de partie est déjà sauvegardé
            const alreadyExists = games.some(g => g.id === newGame.id);
            
            if (alreadyExists) {
                console.log(`Bullseye Tracker: Partie ${newGame.id} déjà sauvegardée.`);
                hasGameBeenSaved = true; // Marquer comme sauvegardé pour cette session
                return;
            }

            // Ajouter la nouvelle partie et sauvegarder
            games.push(newGame);
            chrome.storage.local.set({ games: games }, () => {
                console.log('Bullseye Tracker: Partie sauvegardée automatiquement !');
                hasGameBeenSaved = true; // Marquer comme sauvegardé
            });
        });

    } catch (error) {
        console.error('Bullseye Tracker Auto-Save Error:', error);
    }
}

// 2. Fonction pour commencer à observer la page
function startObserver() {
    console.log('Bullseye Tracker: Observateur de fin de partie activé...');

    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    const callback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // Vérifier si c'est un élément
                         // Nous cherchons le conteneur de fin de partie.
                         // Ces classes peuvent changer lors des mises à jour de GeoGuessr !
                        const endScreenSelector = '.game-finished_container__TEK6Q';
                        if (node.querySelector(endScreenSelector) || node.classList.contains(endScreenSelector.substring(1))) {
                            // L'écran de fin est apparu !
                            scrapeAndSave();
                            // On pourrait arrêter l'observateur, mais on le laisse actif
                            // si l'utilisateur lance une autre partie sans recharger la page.
                            hasGameBeenSaved = false; // Réinitialiser pour la prochaine partie
                            return;
                        }
                    }
                }
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
}

// Démarrer l'observateur
startObserver();