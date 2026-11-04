import type { Sequence, Step, TimerConfig } from './types'

export function buildSequence(t: TimerConfig): Sequence {
  const steps: Step[] = []
  let start = 0
  const push = (phase: Step['phase'], duration: number, roundRest = false) => {
    steps.push({ phase, duration, start, roundRest, set: 1, round: 1 })
    start += duration
  }

  if (t.prepare > 0) push('prepare', t.prepare)
  for (let r = 1; r <= t.rounds; r++) {
    for (let s = 1; s <= t.sets; s++) {
      push('work', t.work)
      steps[steps.length - 1]!.set = s
      steps[steps.length - 1]!.round = r
      if (r === t.rounds && s === t.sets) break
      if (s < t.sets) {
        if (t.rest > 0) push('rest', t.rest)
      } else if (t.roundRest > 0) {
        push('rest', t.roundRest, true)
      } else if (t.rest > 0) {
        push('rest', t.rest)
      }
    }
  }

  // 뒤에서부터 순회하며 가장 가까운 다음 운동 단계의 set/round를 채운다
  let nextSet = 1
  let nextRound = 1
  for (let i = steps.length - 1; i >= 0; i--) {
    const st = steps[i]!
    if (st.phase === 'work') {
      nextSet = st.set
      nextRound = st.round
    } else {
      st.set = nextSet
      st.round = nextRound
    }
  }
  return { steps, total: start }
}
