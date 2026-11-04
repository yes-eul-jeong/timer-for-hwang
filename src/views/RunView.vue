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

const st = computed(() => state.value)
const done = computed(() => st.value.phase === 'done')
const phaseName = computed(() => (st.value.step ? stepName(st.value.step) : PH.done))
const phaseEn = computed(() => (st.value.step?.roundRest ? 'ROUND REST' : EN[st.value.phase]))
const num = computed(() => (done.value ? '땡' : formatSeconds(st.value.remaining)))
const numClass = computed(() => ({
  long: !done.value && st.value.remaining >= 60,
  xlong: !done.value && st.value.remaining >= 600,
}))

function onTap() {
  if (done.value) store.endRun()
  else toggle()
}

function onEnd() {
  stop()
  store.endRun()
}
</script>

<template>
  <section
    class="view run"
    data-view="run"
    :data-phase="st.phase"
    :data-index="st.index"
    @click="onTap"
  >
    <div class="rbody">
      <div class="rtop">
        <div class="rphase"><em>{{ phaseEn }}</em><strong>{{ phaseName }}</strong></div>
        <div class="rtotal"><em>TOTAL</em><b>{{ formatClock(st.totalRemaining) }}</b></div>
      </div>
      <div class="rnum" :class="numClass">{{ num }}</div>
      <div class="rstats">
        <div class="rstat"><span>남은 세트</span><b>{{ st.setsLeft }}<small>/ {{ config.sets }}</small></b></div>
        <div class="rstat"><span>남은 라운드</span><b>{{ st.roundsLeft }}<small>/ {{ config.rounds }}</small></b></div>
      </div>
    </div>

    <div class="rnext" :data-next="st.next?.phase ?? 'none'">
      <template v-if="st.next">
        <small>NEXT</small><span class="lab">{{ stepName(st.next) }}</span><b>{{ formatSeconds(st.next.duration) }}</b>
      </template>
      <span v-else-if="done" class="lab">누르면 돌아가기</span>
      <template v-else><small>NEXT</small><span class="lab">끝</span></template>
    </div>

    <div v-if="flashKey > 0" :key="flashKey" class="flash" aria-hidden="true"></div>

    <div v-if="paused" class="pause">
      <em>PAUSED</em>
      <div class="row">
        <button type="button" @click.stop="skip">다음 단계로</button>
        <button type="button" @click.stop="restart">처음부터</button>
        <button type="button" class="end" @click.stop="onEnd">종료</button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.view {
  position: absolute;
  inset: 0;
}
.run {
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  --band: 17cqh;
  --safe-t: env(safe-area-inset-top, 0px);
  --safe-b: env(safe-area-inset-bottom, 0px);
  --pbg: var(--c-surface-2);
  --pink: var(--c-fg);
  --pnum: var(--c-accent);
  --psub: var(--c-muted);
  &[data-phase='work'],
  &[data-phase='done'] {
    --pbg: var(--c-accent);
    --pink: var(--c-on-accent);
    --pnum: var(--c-on-accent);
    --psub: var(--c-on-accent-sub);
  }
  &[data-phase='rest'] {
    --pbg: var(--c-bg);
    --pink: var(--c-fg);
    --pnum: var(--c-fg);
    --psub: var(--c-muted);
  }
}
.rbody {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: calc(var(--band) + var(--safe-b));
  padding: calc(4cqh + var(--safe-t)) 6cqw 3cqh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 2cqh;
  background: var(--pbg);
  color: var(--pink);
}
.rtop {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 4cqw;
}
.rphase,
.rtotal {
  display: flex;
  flex-direction: column;
  gap: .6cqh;
  em {
    font-style: normal;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 3cqw;
    letter-spacing: var(--tr-widest);
    color: var(--psub);
  }
}
.rtotal {
  text-align: right;
  b {
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 7.5cqw;
    line-height: 1;
    letter-spacing: var(--tr-snug);
    font-variant-numeric: tabular-nums;
  }
}
.rphase strong {
  font-weight: 700;
  font-size: 9.5cqw;
  line-height: 1;
  letter-spacing: var(--tr-snug);
}
.rnum {
  align-self: center;
  justify-self: center;
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 86cqw;
  line-height: 1;
  letter-spacing: var(--tr-tight);
  font-variant-numeric: tabular-nums;
  color: var(--pnum);
  white-space: nowrap;
  &.long { font-size: 54cqw; }
  &.xlong { font-size: 43cqw; }
}
.rstats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3cqw;
  border-top: 1px solid color-mix(in srgb, var(--pink) 18%, transparent);
  padding-top: 2cqh;
}
.rstat {
  display: flex;
  flex-direction: column;
  gap: .8cqh;
  span {
    font-weight: 700;
    font-size: 3.8cqw;
    color: var(--psub);
  }
  b {
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 11cqw;
    line-height: 1;
    letter-spacing: -.04em;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-size: 5cqw;
    font-weight: 700;
    color: var(--psub);
    margin-left: 1.2cqw;
    letter-spacing: 0;
  }
}
.rnext {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--band) + var(--safe-b));
  padding: 0 6cqw var(--safe-b);
  display: flex;
  align-items: center;
  gap: 3cqw;
  background: var(--c-bg);
  color: var(--c-fg);
  border-top: 1px solid var(--c-line-2);
  &[data-next='prepare'] {
    background: var(--c-surface-2);
  }
  &[data-next='work'] {
    background: var(--c-accent);
    color: var(--c-on-accent);
  }
  small {
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 3cqw;
    letter-spacing: var(--tr-widest);
    opacity: .6;
  }
  .lab {
    font-weight: 700;
    font-size: 7cqw;
    letter-spacing: var(--tr-snug);
  }
  b {
    margin-left: auto;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 9cqw;
    letter-spacing: -.04em;
    font-variant-numeric: tabular-nums;
  }
}
.flash {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: var(--c-accent);
  opacity: 0;
  pointer-events: none;
  animation: flash var(--d-base) var(--e-out);
}
@keyframes flash {
  0% { opacity: .9; }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .flash { animation-duration: calc(var(--d-base) * 2); }
}
.pause {
  position: absolute;
  inset: 0;
  z-index: 6;
  background: var(--c-scrim);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6cqh;
  padding-bottom: var(--safe-b);
  em {
    font-style: normal;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 15cqw;
    line-height: 1;
    letter-spacing: .02em;
    color: var(--c-accent);
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 2cqh;
    width: 86cqw;
  }
  button {
    font-size: 6.2cqw;
    font-weight: 700;
    letter-spacing: -.02em;
    min-height: 11cqh;
    background: var(--c-surface-2);
    color: var(--c-fg);
    border: 1px solid var(--c-line-2);
    border-radius: 0;
    cursor: pointer;
  }
  .end { color: var(--c-muted); }
}
</style>
