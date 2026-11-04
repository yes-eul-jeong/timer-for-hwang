import type { Timer } from './types'

export type TimerField = 'prepare' | 'work' | 'rest' | 'sets' | 'rounds' | 'roundRest'

export const TIMER_FIELDS: { key: TimerField; label: string; sub?: string; time: boolean; min: number; max: number }[] = [
  { key: 'prepare', label: '준비', sub: '시작 전 대기', time: true, min: 0, max: 3600 },
  { key: 'work', label: '운동', time: true, min: 5, max: 3600 },
  { key: 'rest', label: '휴식', sub: '세트 사이', time: true, min: 0, max: 3600 },
  { key: 'sets', label: '세트', time: false, min: 1, max: 99 },
  { key: 'rounds', label: '라운드', time: false, min: 1, max: 99 },
  { key: 'roundRest', label: '라운드 간 휴식', sub: '0이면 세트 휴식과 같음', time: true, min: 0, max: 3600 },
]

export function stepValue(field: TimerField, value: number, dir: 1 | -1): number {
  const def = TIMER_FIELDS.find((f) => f.key === field)!
  let step = 1
  if (def.time) {
    const big = dir === 1 ? value >= 60 : value > 60
    step = big ? 15 : 5
  }
  return Math.min(def.max, Math.max(def.min, value + dir * step))
}

export function isValidTimer(x: unknown): x is Timer {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.createdAt !== 'string') return false
  if (typeof o.name !== 'string' || o.name.length < 1 || o.name.length > 20) return false
  return TIMER_FIELDS.every((f) => {
    const v = o[f.key]
    return typeof v === 'number' && Number.isInteger(v) && v >= f.min && v <= f.max
  })
}
