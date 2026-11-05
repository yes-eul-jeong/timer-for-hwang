import { test, expect, describe } from 'vitest'
import { stepValue, isValidTimer, TIMER_FIELDS, toVolume } from './limits'
import type { Timer } from './types'

const ok: Timer = { id: 'a', name: '타바타', prepare: 10, work: 20, rest: 10, sets: 8, rounds: 1, roundRest: 0, createdAt: '2026-11-04T00:00:00.000Z' }

describe('stepValue', () => {
  test.each([
    ['work', 55, 1, 60],
    ['work', 60, 1, 75],
    ['work', 60, -1, 55],
    ['work', 75, -1, 60],
    ['work', 5, -1, 5],
    ['rest', 0, -1, 0],
    ['sets', 99, 1, 99],
    ['roundRest', 3600, 1, 3600],
  ] as const)('%s %i dir %i → %i', (f, v, d, out) => {
    expect(stepValue(f, v, d)).toBe(out)
  })
  test('세트·라운드는 1씩', () => {
    expect(stepValue('sets', 3, 1)).toBe(4)
    expect(stepValue('rounds', 1, -1)).toBe(1)
  })
})

describe('isValidTimer', () => {
  test('정상', () => expect(isValidTimer(ok)).toBe(true))
  test.each([
    ['work -5', { work: -5 }],
    ['sets 0', { sets: 0 }],
    ['sets 1000', { sets: 1000 }],
    ['name 없음', { name: undefined }],
    ['name 빈 문자열', { name: '' }],
    ['name 21자', { name: 'a'.repeat(21) }],
    ['소수', { rest: 1.5 }],
    ['work 4', { work: 4 }],
    ['id 숫자', { id: 1 }],
  ])('거부: %s', (_n, patch) => {
    expect(isValidTimer({ ...ok, ...patch })).toBe(false)
  })
  test('null·비객체 거부', () => {
    expect(isValidTimer(null)).toBe(false)
    expect(isValidTimer('x')).toBe(false)
  })
  test('필드 정의 6개', () => expect(TIMER_FIELDS).toHaveLength(6))
})

test('toVolume: 정수 1~5만 통과, 나머지는 5', () => {
  for (const v of [1, 2, 3, 4, 5]) expect(toVolume(v)).toBe(v)
  for (const v of [0, 6, 2.5, '3', null, undefined, NaN]) expect(toVolume(v)).toBe(5)
})
