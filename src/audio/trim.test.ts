import { test, expect } from 'vitest'
import { leadingSilence, peakOf } from './trim'

test('leading silence in seconds', () => {
  const s = new Float32Array(44100).fill(0.5)
  s.fill(0, 0, 4410)
  expect(leadingSilence(s, 44100)).toBeCloseTo(0.1, 3)
})
test('all silent returns 0', () => {
  expect(leadingSilence(new Float32Array(1000), 44100)).toBe(0)
})
test('peakOf는 모든 채널의 절댓값 최대', () => {
  expect(peakOf([new Float32Array([0.1, -0.8]), new Float32Array([0.5])])).toBeCloseTo(0.8, 5)
})
