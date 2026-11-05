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
    :data-phase="st.phase"
    :data-index="st.index"
  >
    <div class="rbody">
      <div class="rtop">
        <div class="rphase"><em>{{ phaseEn }}</em><strong>{{ phaseName }}</strong></div>
        <button v-if="!done" type="button" class="pz" @click="toggle"><span class="ico" aria-hidden="true"></span>멈춤</button>
      </div>
      <div class="rnum" :class="numClass">{{ num }}</div>
      <div class="rstats">
        <div class="rstat"><span>남은 세트</span><b>{{ st.setsLeft }}<small>/ {{ config.sets }}</small></b></div>
        <div class="rstat"><span>남은 라운드</span><b>{{ st.roundsLeft }}<small>/ {{ config.rounds }}</small></b></div>
        <div class="rstat tot"><span>전체 남은 시간</span><b>{{ formatClock(st.totalRemaining) }}</b></div>
      </div>
    </div>

    <div v-if="!done" class="rnext" :data-next="st.next?.phase ?? 'none'">
      <template v-if="st.next">
        <small>NEXT</small><span class="lab">{{ stepName(st.next) }}</span><b>{{ formatSeconds(st.next.duration) }}</b>
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

<style scoped lang="scss">
.view {
  position: absolute;
  inset: 0;
}
.run {
  user-select: none;
  -webkit-user-select: none;
  --band: 12cqh;
  --k: 1.25;
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
  padding: calc(2cqh + var(--safe-t)) 6cqw 2.6cqh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 1.6cqh;
  background: var(--pbg);
  color: var(--pink);
}
.rtop {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4cqw;
}
.rphase {
  display: flex;
  flex-direction: column;
  gap: .5cqh;
  em {
    font-style: normal;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 2.8cqw;
    letter-spacing: var(--tr-widest);
    color: var(--psub);
  }
}
.pz {
  flex: none;
  height: 12.5cqw;
  padding: 0 4.2cqw 0 3.6cqw;
  display: inline-flex;
  align-items: center;
  gap: 2.2cqw;
  background: var(--pink);
  color: var(--pbg);
  border: 2px solid var(--pink);
  border-radius: 0;
  font-weight: 700;
  font-size: 4.4cqw;
  letter-spacing: -.02em;
  cursor: pointer;
  .ico {
    display: inline-flex;
    gap: 1cqw;
    height: 3.8cqw;
    &::before,
    &::after {
      content: '';
      width: 1.1cqw;
      background: currentColor;
    }
  }
  &:active { transform: translateY(1px); }
}
.rphase strong {
  font-weight: 700;
  font-size: 7.6cqw;
  line-height: 1;
  letter-spacing: var(--tr-snug);
}
.rnum {
  align-self: center;
  justify-self: center;
  font-family: var(--font-num);
  font-weight: 700;
  font-size: calc(min(86cqw, 42cqh) * var(--k));
  line-height: 1;
  letter-spacing: var(--tr-tight);
  font-variant-numeric: tabular-nums;
  color: var(--pnum);
  white-space: nowrap;
  &.long { font-size: calc(min(54cqw, 26cqh) * var(--k)); }
  &.xlong { font-size: calc(min(43cqw, 21cqh) * var(--k)); }
  &.ttaeng {
    font-family: var(--font-kr);
    font-size: 62cqw;
    letter-spacing: -.06em;
  }
}
.rstats {
  display: grid;
  grid-template-columns: 1fr 1fr 1.15fr;
  gap: 3cqw;
  border-top: 1px solid color-mix(in srgb, var(--pink) 18%, transparent);
  padding-top: 1.8cqh;
}
.rstat {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: .7cqh;
  span {
    font-weight: 700;
    font-size: 3.2cqw;
    white-space: nowrap;
    color: var(--psub);
  }
  b {
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 8.6cqw;
    white-space: nowrap;
    line-height: 1;
    letter-spacing: -.04em;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-size: 4cqw;
    font-weight: 700;
    color: var(--psub);
    margin-left: 1cqw;
    letter-spacing: 0;
  }
  &.tot { text-align: right; }
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
    font-size: 2.6cqw;
    letter-spacing: var(--tr-widest);
    opacity: .6;
  }
  .lab {
    font-weight: 700;
    font-size: 5.6cqw;
    letter-spacing: var(--tr-snug);
  }
  b {
    margin-left: auto;
    font-family: var(--font-num);
    font-weight: 700;
    font-size: 7cqw;
    letter-spacing: -.04em;
    font-variant-numeric: tabular-nums;
  }
}
.back {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--band) + var(--safe-b));
  padding-bottom: var(--safe-b);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2.4cqw;
  background: var(--c-bg);
  color: var(--c-fg);
  border: 0;
  border-top: 1px solid var(--c-line-2);
  border-radius: 0;
  font-weight: 700;
  font-size: 5.6cqw;
  letter-spacing: -.02em;
  cursor: pointer;
  &::before {
    content: '';
    width: 2.6cqw;
    height: 2.6cqw;
    border-left: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(45deg);
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
  .go {
    background: var(--c-accent);
    color: var(--c-on-accent);
    border-color: var(--c-accent);
    min-height: 14cqh;
    font-size: 7.4cqw;
  }
  .end { color: var(--c-muted); }
}
</style>
