(function () {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);

        try {
            const url = args[0] instanceof Request ? args[0].url : args[0];

            // Check if the URL matches the lobby API pattern
            // Pattern 1: https://game-server.geoguessr.com/api/parties/v2/*/lobby (GET)
            // Pattern 2: https://game-server.geoguessr.com/api/lobby/*/join (POST)
            if (url && typeof url === 'string' && (
                (url.includes('/api/parties/v2/') && url.includes('/lobby')) ||
                (url.includes('/api/lobby/') && url.includes('/join'))
            )) {
                console.log('Bullseye Tracker: Lobby data intercepted:', url);
                const clone = response.clone();
                clone.json().then(data => {
                    console.log('Bullseye Tracker: Intercepted payload:', data);
                    window.postMessage({
                        type: 'BULLSEYE_LOBBY_DATA',
                        payload: data
                    }, '*');
                }).catch(err => {
                    console.error('Bullseye Tracker: Failed to parse intercepted lobby data', err);
                });
            }
        } catch (err) {
            console.error('Bullseye Tracker: Error in fetch interceptor', err);
        }

        return response;
    };

    console.log('Bullseye Tracker: Fetch interceptor injected.');
})();
