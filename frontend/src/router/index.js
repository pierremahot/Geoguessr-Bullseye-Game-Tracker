import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import LeaderboardView from '../views/LeaderboardView.vue';
import PlayerStatsView from '../views/PlayerStatsView.vue';
import TeamStatsView from '../views/TeamStatsView.vue';
import AdminView from '../views/AdminView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
    },
    {
      path: '/leaderboard',
      name: 'leaderboard',
      component: LeaderboardView,
    },
    {
      path: '/player/:id',
      name: 'player-stats',
      component: PlayerStatsView,
    },
    {
      path: '/team/:id',
      name: 'team-stats',
      component: TeamStatsView,
    },
  ],
});

export default router;
