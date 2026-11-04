<script setup lang="ts">
import { useAppStore } from './app/store'
import BottomNav from './components/BottomNav.vue'
import AppToast from './components/AppToast.vue'
import ListView from './views/ListView.vue'
import ReadyView from './views/ReadyView.vue'
import EditView from './views/EditView.vue'
import SettingsView from './views/SettingsView.vue'
import RunView from './views/RunView.vue'

const store = useAppStore()
</script>

<template>
  <div class="app">
    <ListView v-if="store.state.view === 'list'" />
    <ReadyView v-else-if="store.state.view === 'ready'" />
    <EditView v-else-if="store.state.view === 'edit'" />
    <SettingsView v-else-if="store.state.view === 'settings'" />
    <RunView v-else-if="store.state.view === 'run'" />
    <BottomNav v-if="store.state.view === 'list' || store.state.view === 'settings'" />
    <AppToast />
  </div>
</template>

<style scoped lang="scss">
.app {
  container-type: size;
  height: 100dvh;
  position: relative;
  overflow: hidden;
  background: var(--c-bg);
  color: var(--c-fg);
}
</style>
