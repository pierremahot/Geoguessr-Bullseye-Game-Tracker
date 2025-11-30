
const API_URL = 'http://localhost:3000/api';

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

export async function fetchTeamLeaderboard() {
    const response = await fetch(`${API_URL}/leaderboard/teams`);
    if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
    }
    return await response.json();
}
