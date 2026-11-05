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

<style scoped lang="scss" src="./ListView.scss"></style>
