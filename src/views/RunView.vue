<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../app/store'
import { formatClock, formatSeconds } from '../core/format'
import type { RunState, Step, TimerConfig } from '../core/types'
import { useRun, type RunDeps } from '../run/useRun'

const props = defineProps<{ deps?: Partial<RunDeps> }>()

const store = useAppStore()
// 시작 전 화면에서만 들어오므로 today는 항상 있다. 실행 중 값이 바뀌지 않도록 복사해 둔다.
const config: TimerConfig = { ...store.state.today! }
const { state, paused, flashKey, toggle, skip, restart, stop } = useRun(config, store.state.settings, props.deps)

const PH: Record<RunState['phase'], string> = { prepare: '준비', work: '운동', rest: '휴식', done: '끝' }
const EN: Record<RunState['phase'], string> = { prepare: 'READY', work: 'WORK', rest: 'REST', done: 'FINISH' }
const stepName = (s: Step) => (s.roundRest ? '라운드 휴식' : PH[s.phase])

const done = computed(() => state.value.phase === 'done')
const phaseName = computed(() => (state.value.step ? stepName(state.value.step) : PH.done))
const phaseEn = computed(() => (state.value.step?.roundRest ? 'ROUND REST' : EN[state.value.phase]))
const num = computed(() => (done.value ? '땡' : formatSeconds(state.value.remaining)))
const numClass = computed(() => ({
  long: !done.value && state.value.remaining >= 60,
  xlong: !done.value && state.value.remaining >= 600,
  ttaeng: done.value,
}))

function onEnd() {
  stop()
  store.endRun()
}
</script>

<template>
  <section
    class="view run"
    :class="{ paused }"
    data-view="run"
    :data-phase="state.phase"
    :data-index="state.index"
  >
    <div class="rbody">
      <div class="rtop">
        <div class="rphase"><em>{{ phaseEn }}</em><strong>{{ phaseName }}</strong></div>
        <div v-if="!done" class="tools">
          <button type="button" class="tb" aria-label="처음부터" @click="restart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9A8 8 0 1 1 4 13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/><path d="M3 3.5V10h6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></svg>
          </button>
          <button type="button" class="tb" aria-label="다음 단계" @click="skip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 15.5 12 4 20Z" fill="currentColor"/><rect x="17" y="4" width="3.4" height="16" fill="currentColor"/></svg>
          </button>
          <button type="button" class="tb" aria-label="종료" @click="onEnd">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
      <div class="numwrap">
        <div class="rnum" :class="numClass">{{ num }}</div>
        <span v-if="paused" class="chip">PAUSED</span>
      </div>
      <div class="total"><span>전체 남은 시간</span><b>{{ formatClock(state.totalRemaining) }}</b></div>
      <div class="srow">
        <div class="rstat"><span>남은 세트</span><b>{{ state.setsLeft }}<small>/ {{ config.sets }}</small></b></div>
        <button v-if="!done" type="button" class="play" :aria-label="paused ? '재생' : '일시정지'" @click="toggle">
          <svg v-if="paused" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5 21 12 6 20.5Z" fill="currentColor"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" fill="currentColor"/><rect x="14" y="4" width="5" height="16" fill="currentColor"/></svg>
        </button>
        <div class="rstat rt"><span>남은 라운드</span><b>{{ state.roundsLeft }}<small>/ {{ config.rounds }}</small></b></div>
      </div>
    </div>

    <div v-if="!done" class="rnext" :data-next="state.next?.phase ?? 'none'">
      <template v-if="state.next">
        <small>NEXT</small><span class="lab">{{ stepName(state.next) }}</span><b>{{ formatSeconds(state.next.duration) }}</b>
      </template>
      <template v-else><small>NEXT</small><span class="lab">끝</span></template>
    </div>
    <button v-else type="button" class="back" @click="store.endRun()">돌아가기</button>

    <div v-if="flashKey > 0" :key="flashKey" class="flash" aria-hidden="true"></div>
  </section>
</template>

<style scoped lang="scss" src="./RunView.scss"></style>
