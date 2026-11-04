<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../app/store'
import { buildSequence } from '../core/sequence'
import { formatClock, summarize } from '../core/format'
import { getAudioPlayer } from '../audio/player'
import Stepper from '../components/Stepper.vue'

const store = useAppStore()
const today = computed(() => store.state.today)
const total = computed(() => (today.value ? formatClock(buildSequence(today.value).total) : ''))

function start() {
  void getAudioPlayer().unlock()
  store.startRun()
}
</script>

<template>
  <section v-if="today" class="view" data-view="ready">
    <div class="bar">
      <button type="button" data-back @click="store.go('list')">‹ 목록</button>
      <button type="button" data-edit @click="store.openEdit(store.state.currentId)">편집</button>
    </div>
    <div class="ready-body">
      <div class="name">{{ today.name }}</div>
      <div class="sum">{{ summarize(today) }}</div>
      <div class="ready-total"><span class="label-en">TOTAL</span><b>{{ total }}</b></div>
      <div class="steppers">
        <Stepper label="세트" sub="라운드마다 반복" :value="String(today.sets)" @dec="store.adjustToday('sets', -1)" @inc="store.adjustToday('sets', 1)" />
        <Stepper label="라운드" sub="전체 반복" :value="String(today.rounds)" @dec="store.adjustToday('rounds', -1)" @inc="store.adjustToday('rounds', 1)" />
      </div>
      <button class="start" type="button" @click="start"><strong>시작</strong><em>START</em></button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}
.bar {
  padding: calc(3.5cqh + env(safe-area-inset-top, 0px)) 3cqw 1cqh;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2cqw;
  button {
    background: none;
    border: 0;
    border-radius: 0;
    font-size: 4.2cqw;
    font-weight: 700;
    padding: 2cqw 2.5cqw;
    color: var(--c-muted);
  }
}
.ready-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 2cqh 5cqw calc(4cqh + env(safe-area-inset-bottom, 0px));
  gap: 2.5cqh;
}
.name {
  font-size: 9cqw;
  font-weight: 900;
  letter-spacing: -.04em;
  line-height: 1.05;
}
.sum {
  font-size: 3.8cqw;
  color: var(--c-muted);
  margin-top: -1.5cqh;
}
.label-en {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 2.8cqw;
  letter-spacing: var(--tr-widest);
  color: var(--c-muted);
}
.ready-total {
  display: flex;
  flex-direction: column;
  gap: .6cqh;
  b {
    font-family: var(--font-num);
    font-weight: 900;
    font-size: 20cqw;
    letter-spacing: var(--tr-tight);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
}
.steppers {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--c-line-2);
}
.start {
  margin-top: auto;
  min-height: 12cqh;
  background: var(--c-accent);
  color: var(--c-on-accent);
  border: 0;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3cqw;
  strong {
    font-size: 8.5cqw;
    font-weight: 900;
    letter-spacing: -.03em;
  }
  em {
    font-style: normal;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 3cqw;
    letter-spacing: var(--tr-widest);
    color: var(--c-on-accent-sub);
  }
}
</style>
