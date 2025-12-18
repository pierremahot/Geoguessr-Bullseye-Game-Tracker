(function () {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = args[0] instanceof Request ? args[0].url : args[0];

      // Pattern 1: Lobby Data (Legacy/Party)
      if (
        (url.includes('/api/parties/v2/') && url.includes('/lobby')) ||
        (url.includes('/api/lobby/') && url.includes('/join'))
      ) {
        console.log('Bullseye Tracker: Lobby data intercepted:', url);
        const clone = response.clone();
        clone
          .json()
          .then((data) => {
            console.log('Bullseye Tracker: Intercepted lobby payload:', data);
            window.postMessage(
              {
                type: 'BULLSEYE_LOBBY_DATA',
                payload: data,
              },
              '*'
            );
          })
          .catch((err) =>
            console.error('Bullseye Tracker: Failed to parse lobby data', err)
          );
      }

      // Pattern 3: Bullseye Game Data (GET /api/bullseye/<UUID>)
      // Regex to match /api/bullseye/ followed by a UUID, and nothing else (except query params)
      // This avoids matching /guess, /result, etc.
      const gameDataRegex = /\/api\/bullseye\/[0-9a-f-]{36}(\?|$)/i;
      if (gameDataRegex.test(url)) {
        console.log(
          'Bullseye Tracker: Game API data intercepted (Regex Match):',
          url
        );
        const clone = response.clone();
        clone
          .json()
          .then((data) => {
            console.log(
              'Bullseye Tracker: Intercepted game API payload:',
              data
            );
            window.postMessage(
              {
                type: 'BULLSEYE_GAME_DATA',
                payload: data,
              },
              '*'
            );
          })
          .catch((err) =>
            console.error(
              'Bullseye Tracker: Failed to parse game API data',
              err
            )
          );
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

            // Capture relevant Bullseye events
            if (
              data.code === 'BullseyeGuess' ||
              data.code === 'BullseyeRoundStarted' ||
              data.code === 'BullseyeRoundEnded' ||
              data.code === 'GameAborted'
            ) {
              console.log(
                `Bullseye Tracker: WebSocket ${data.code} intercepted:`,
                data
              );
              window.postMessage(
                {
                  type: 'BULLSEYE_WS',
                  payload: data,
                },
                '*'
              );
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
