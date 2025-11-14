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