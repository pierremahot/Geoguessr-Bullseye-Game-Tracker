(function () {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);

        try {
            const url = args[0] instanceof Request ? args[0].url : args[0];

            // Check if the URL matches the lobby API pattern
            // Pattern 1: https://game-server.geoguessr.com/api/parties/v2/*/lobby (GET)
            // Pattern 2: https://game-server.geoguessr.com/api/lobby/*/join (POST)
            if (url && typeof url === 'string') {
                // Pattern 1: Lobby Data
                if ((url.includes('/api/parties/v2/') && url.includes('/lobby')) ||
                    (url.includes('/api/lobby/') && url.includes('/join'))) {
                    console.log('Bullseye Tracker: Lobby data intercepted:', url);
                    const clone = response.clone();
                    clone.json().then(data => {
                        console.log('Bullseye Tracker: Intercepted lobby payload:', data);
                        window.postMessage({
                            type: 'BULLSEYE_LOBBY_DATA',
                            payload: data
                        }, '*');
                    }).catch(err => console.error('Bullseye Tracker: Failed to parse lobby data', err));
                }

                // Pattern 2: Guess Data (API)
                // https://game-server.geoguessr.com/api/bullseye/*/guess
                if (url.includes('/api/bullseye/') && url.includes('/guess')) {
                    console.log('Bullseye Tracker: Guess data intercepted:', url);
                    const clone = response.clone();
                    clone.json().then(data => {
                        // We only care if it's not a draft, but we send everything to content.js to decide
                        console.log('Bullseye Tracker: Intercepted guess payload:', data);
                        window.postMessage({
                            type: 'BULLSEYE_GUESS',
                            payload: data
                        }, '*');
                    }).catch(err => console.error('Bullseye Tracker: Failed to parse guess data', err));
                }
            }
        } catch (err) {
            console.error('Bullseye Tracker: Error in fetch interceptor', err);
        }

        return response;
    };

    console.log('Bullseye Tracker: Fetch interceptor injected.');

    // WebSocket Interceptor
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function (...args) {
        const socket = new OriginalWebSocket(...args);

        socket.addEventListener('message', (event) => {
            try {
                if (typeof event.data === 'string') {
                    // Geoguessr usually sends JSON strings
                    if (event.data.startsWith('{')) {
                        const data = JSON.parse(event.data);
                        if (data.code === 'BullseyeGuess') {
                            console.log('Bullseye Tracker: WebSocket Guess intercepted:', data);
                            window.postMessage({
                                type: 'BULLSEYE_WS',
                                payload: data
                            }, '*');
                        }
                    }
                }
            } catch (err) {
                // Ignore parsing errors for non-JSON messages
            }
        });

        return socket;
    };
    // Copy static properties/methods
    Object.assign(window.WebSocket, OriginalWebSocket);
    window.WebSocket.prototype = OriginalWebSocket.prototype;

    console.log('Bullseye Tracker: WebSocket interceptor injected.');
})();
