<script setup lang="ts">
import { useAppStore } from '../app/store'
import { buildSequence } from '../core/sequence'
import { formatClock, summarize } from '../core/format'

const store = useAppStore()
</script>

<template>
  <section class="view" data-view="list">
    <div class="vhead"><span class="label-en">TIMERS</span><h2>타이머</h2></div>
    <div class="scroll">
      <button v-for="t in store.state.timers" :key="t.id" type="button" class="tcard" @click="store.openReady(t.id)">
        <span class="name">{{ t.name }}</span>
        <span class="sum">{{ summarize(t) }}</span>
        <span class="dur">{{ formatClock(buildSequence(t).total) }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.view {
  position: absolute;
  inset: 0 0 calc(10cqh + env(safe-area-inset-bottom, 0px)) 0;
  display: flex;
  flex-direction: column;
}
.vhead {
  padding: calc(4.5cqh + env(safe-area-inset-top, 0px)) 5cqw 3cqh;
  display: flex;
  flex-direction: column;
  gap: 1cqh;
  h2 {
    margin: 0;
    font-size: 10cqw;
    font-weight: 700;
    letter-spacing: -.04em;
    line-height: 1;
  }
}
.label-en {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 2.8cqw;
  letter-spacing: var(--tr-widest);
  color: var(--c-accent);
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 5cqw 4cqh;
  display: flex;
  flex-direction: column;
  gap: 2cqw;
}
.tcard {
  text-align: left;
  background: var(--c-surface);
  border: 1px solid var(--c-line-2);
  border-radius: 0;
  padding: 4cqw;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1cqh 3cqw;
  align-items: end;
  &:active {
    border-color: var(--c-accent);
  }
}
.name {
  font-size: 5.6cqw;
  font-weight: 700;
  letter-spacing: -.02em;
}
.sum {
  grid-column: 1;
  font-size: 3.4cqw;
  color: var(--c-muted);
  font-variant-numeric: tabular-nums;
}
.dur {
  grid-row: 1 / 3;
  grid-column: 2;
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 7cqw;
  letter-spacing: var(--tr-tight);
  font-variant-numeric: tabular-nums;
}
</style>
