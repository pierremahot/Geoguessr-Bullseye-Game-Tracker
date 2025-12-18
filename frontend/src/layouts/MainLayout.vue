import { Home, Trophy, Settings } from 'lucide-vue-next';

<template>
  <div
    class="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-purple-500 selection:text-white"
  >
    <!-- Navigation Bar -->
    <nav
      class="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800"
    >
      <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <h1
                class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500"
              >
                Bullseye Tracker
              </h1>
            </div>
            <div class="hidden md:block">
              <div class="ml-10 flex items-baseline space-x-4">
                <router-link
                  to="/"
                  class="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                >
                  <Home class="w-4 h-4" /> Dashboard
                </router-link>
                <router-link
                  to="/leaderboard"
                  class="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                >
                  <Trophy class="w-4 h-4" /> Leaderboard
                </router-link>
                <router-link
                  to="/admin"
                  class="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                >
                  <Settings class="w-4 h-4" /> Admin
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <!-- Page Content -->
    <main class="max-w-full mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <RouterView v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </div>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
