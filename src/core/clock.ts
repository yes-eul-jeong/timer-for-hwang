import type { RunState, Sequence } from './types'

export function stateAt(seq: Sequence, sets: number, rounds: number, elapsed: number): RunState {
  const e = Math.max(0, elapsed)
  const index = seq.steps.findIndex(s => e < s.start + s.duration)
  if (index === -1) {
    return { phase: 'done', index: seq.steps.length, step: null, next: null, remaining: 0, totalRemaining: 0, setsLeft: 0, roundsLeft: 0 }
  }
  const step = seq.steps[index]!
  return {
    phase: step.phase,
    index,
    step,
    next: seq.steps[index + 1] ?? null,
    remaining: Math.ceil(step.start + step.duration - e),
    totalRemaining: Math.ceil(seq.total - e),
    setsLeft: sets - (step.set - 1),
    roundsLeft: rounds - (step.round - 1),
  }
}

export interface RunClock {
  elapsed(): number
  readonly paused: boolean
  pause(): void
  resume(): void
  skip(seq: Sequence): void
  restart(): void
}

export function createRunClock(now: () => number): RunClock {
  let acc = 0 // 누적 경과 초
  let runningSince: number | null = now()

  const elapsed = () => (runningSince === null ? acc : acc + (now() - runningSince) / 1000)

  return {
    elapsed,
    get paused() { return runningSince === null },
    pause() {
      if (runningSince === null) return
      acc = elapsed()
      runningSince = null
    },
    resume() {
      if (runningSince !== null) return
      runningSince = now()
    },
    skip(seq) {
      const e = elapsed()
      const step = seq.steps.find(s => e < s.start + s.duration)
      if (!step) return
      acc = step.start + step.duration
      if (runningSince !== null) runningSince = now()
    },
    restart() {
      acc = 0
      runningSince = now()
    },
  }
}
