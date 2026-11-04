<script setup lang="ts">
import { useAppStore } from '../app/store'
const store = useAppStore()
</script>

<template>
  <nav class="foot" aria-label="메뉴">
    <button type="button" :aria-current="store.state.view === 'list' ? 'page' : undefined" @click="store.go('list')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      타이머
    </button>
    <button type="button" class="add" @click="store.openEdit(null)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><path d="M12 4v16M4 12h16" /></svg>
      추가
    </button>
    <button type="button" :aria-current="store.state.view === 'settings' ? 'page' : undefined" @click="store.go('settings')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><rect x="14" y="5" width="4" height="4" /><rect x="6" y="15" width="4" height="4" /></svg>
      설정
    </button>
  </nav>
</template>

<style scoped lang="scss">
.foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  height: calc(10cqh + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  background: var(--c-bg);
  border-top: 1px solid var(--c-line-2);
}
button {
  background: none;
  border: 0;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .8cqh;
  font-size: 3.4cqw;
  font-weight: 700;
  color: var(--c-muted);
  position: relative;
  svg {
    width: 6.5cqw;
    height: 6.5cqw;
  }
  &[aria-current='page'] {
    color: var(--c-fg);
    &::before {
      content: '';
      position: absolute;
      top: -1px;
      left: 0;
      right: 0;
      height: .9cqw;
      background: var(--c-accent);
    }
  }
  &.add {
    background: var(--c-accent);
    color: var(--c-on-accent);
  }
}
</style>
