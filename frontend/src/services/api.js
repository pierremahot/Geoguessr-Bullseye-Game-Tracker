
const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function fetchGames() {
    const response = await fetch(`${API_URL}/games`);
    if (!response.ok) {
        throw new Error('Failed to fetch games');
    }
    return await response.json();
}

export async function fetchStats() {
    const response = await fetch(`${API_URL}/stats`);
    if (!response.ok) {
        throw new Error('Failed to fetch stats');
    }
    return await response.json();
}

export async function fetchTeamLeaderboard(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/leaderboard/teams?${query}`);
    if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
    }
    return await response.json();
}

export async function fetchPlayerStats(playerId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/players/${playerId}/stats?${query}`);
    if (!response.ok) {
        throw new Error('Failed to fetch player stats');
    }
    return await response.json();
}

export async function fetchTeamStats(teamId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/teams/${teamId}/stats?${query}`);
    if (!response.ok) {
        throw new Error('Failed to fetch team stats');
    }
    return await response.json();
}

export async function deleteGame(id) {
    const response = await fetch(`${API_URL}/games/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete game');
    }
}
