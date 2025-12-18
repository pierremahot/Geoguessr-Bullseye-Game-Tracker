/**
 * Ce module fournit des fonctions utilitaires pour interagir avec le
 * chrome.storage.local de l'extension.
 */

/**
 * Récupère toutes les parties sauvegardées.
 * @returns {Promise<Array>} Une promesse qui se résout avec le tableau des parties.
 */
export async function getAllGames() {
  const result = await chrome.storage.local.get(['games']);
  return result.games || [];
}

/**
 * Sauvegarde un tableau complet de parties.
 * @param {Array} games - Le tableau de parties à sauvegarder.
 * @returns {Promise<void>}
 */
export async function saveAllGames(games) {
  await chrome.storage.local.set({ games: games });
}

/**
 * Supprime une partie par son ID.
 * @param {string} gameId - L'ID de la partie à supprimer.
 * @returns {Promise<void>}
 */
export async function deleteGameById(gameId) {
  const allGames = await getAllGames();
  const updatedGames = allGames.filter((game) => game.id !== gameId);
  await saveAllGames(updatedGames);
}

/**
 * Supprime toutes les parties.
 * @returns {Promise<void>}
 */
export async function clearAllGames() {
  await saveAllGames([]);
}
