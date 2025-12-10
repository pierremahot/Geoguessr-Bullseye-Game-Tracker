
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

export async function fetchAdminPlayers() {
    const response = await fetch(`${API_URL}/admin/players`);
    if (!response.ok) {
        throw new Error('Failed to fetch players');
    }
    return await response.json();
}

export async function linkPlayers(primaryId, aliasId) {
    const response = await fetch(`${API_URL}/admin/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            primary_id: primaryId,
            alias_id: aliasId
        })
    });
    if (!response.ok) {
        throw new Error('Failed to link players');
    }
}

export async function unlinkPlayer(aliasId) {
    const response = await fetch(`${API_URL}/admin/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias_id: aliasId })
    });
    if (!response.ok) {
        throw new Error('Failed to unlink player');
    }
}
