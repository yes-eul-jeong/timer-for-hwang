import type { Sequence } from '../core/types'

export type CueKind = 'count3' | 'count2' | 'count1' | 'work' | 'rest' | 'end'
export interface Cue {
  at: number
  kind: CueKind
  beepOnly: boolean
}

const COUNTS = [3, 2, 1] as const

export function cuesFrom(seq: Sequence, fromElapsed: number): Cue[] {
  const cues: Cue[] = []
  seq.steps.forEach((step, i) => {
    if (i > 0 && step.phase !== 'prepare') {
      cues.push({ at: step.start, kind: step.phase, beepOnly: false })
    }
    for (const k of COUNTS) {
      if (k < step.duration) {
        cues.push({
          at: step.start + step.duration - k,
          kind: `count${k}` as CueKind,
          beepOnly: step.duration <= 3,
        })
      }
    }
  })
  cues.push({ at: seq.total, kind: 'end', beepOnly: false })
  return cues.filter((c) => c.at > fromElapsed).sort((a, b) => a.at - b.at)
}
