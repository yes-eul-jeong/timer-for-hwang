import type { TimerConfig } from './types'

export const PRESET_TIMERS: TimerConfig[] = [
  { name: '타바타', prepare: 10, work: 20, rest: 10, sets: 8, rounds: 1, roundRest: 0 },
  { name: '러닝머신 체력', prepare: 10, work: 20, rest: 10, sets: 8, rounds: 3, roundRest: 0 },
  { name: '30/30 인터벌', prepare: 10, work: 30, rest: 30, sets: 10, rounds: 1, roundRest: 0 },
  { name: '킥복싱 3분 3R', prepare: 10, work: 180, rest: 60, sets: 3, rounds: 1, roundRest: 0 },
]
