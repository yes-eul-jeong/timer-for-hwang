import { test, expect } from 'vitest'
import { formatSeconds, formatClock, summarize, defaultName } from './format'
import { PRESET_TIMERS } from './presets'

const base = { name: 't', prepare: 10, work: 20, rest: 10, sets: 8, rounds: 1, roundRest: 0 }
test('formatSeconds', () => {
  expect(formatSeconds(0)).toBe('0')
  expect(formatSeconds(20)).toBe('20')
  expect(formatSeconds(59)).toBe('59')
  expect(formatSeconds(60)).toBe('1:00')
  expect(formatSeconds(180)).toBe('3:00')
  expect(formatSeconds(3600)).toBe('60:00')
})
test('formatClock', () => {
  expect(formatClock(5)).toBe('0:05')
  expect(formatClock(240)).toBe('4:00')
  expect(formatClock(3725)).toBe('62:05')
})
test('summarize', () => {
  expect(summarize(base)).toBe('운동 20 · 휴식 10 · 8세트')
  expect(summarize({ ...base, rounds: 3 })).toBe('운동 20 · 휴식 10 · 8세트 × 3라운드')
  expect(summarize({ ...base, work: 180, rest: 60, sets: 3 })).toBe('운동 3:00 · 휴식 1:00 · 3세트')
})
test('defaultName', () => expect(defaultName(base)).toBe('20/10 인터벌'))
test('presets', () => {
  expect(PRESET_TIMERS.map(p => p.name)).toEqual(['타바타', '러닝머신 체력', '30/30 인터벌', '킥복싱 3분 3R'])
})
