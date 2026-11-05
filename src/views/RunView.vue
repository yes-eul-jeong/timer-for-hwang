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
    data-view="run"
    :data-phase="state.phase"
    :data-index="state.index"
  >
    <div class="rbody">
      <div class="rtop">
        <div class="rphase"><em>{{ phaseEn }}</em><strong>{{ phaseName }}</strong></div>
        <button v-if="!done" type="button" class="pz" @click="toggle"><span class="ico" aria-hidden="true"></span>멈춤</button>
      </div>
      <div class="rnum" :class="numClass">{{ num }}</div>
      <div class="rstats">
        <div class="rstat"><span>남은 세트</span><b>{{ state.setsLeft }}<small>/ {{ config.sets }}</small></b></div>
        <div class="rstat"><span>남은 라운드</span><b>{{ state.roundsLeft }}<small>/ {{ config.rounds }}</small></b></div>
        <div class="rstat tot"><span>전체 남은 시간</span><b>{{ formatClock(state.totalRemaining) }}</b></div>
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

    <div v-if="paused" class="pause">
      <em>PAUSED</em>
      <div class="row">
        <button type="button" class="go" @click="toggle">계속</button>
        <button type="button" @click="skip">다음 단계로</button>
        <button type="button" @click="restart">처음부터</button>
        <button type="button" class="end" @click="onEnd">종료</button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss" src="./RunView.scss"></style>
