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

<style scoped lang="scss" src="./ReadyView.scss"></style>
