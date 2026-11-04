import { test, expect } from 'vitest'
import { leadingSilence } from './trim'

test('leading silence in seconds', () => {
  const s = new Float32Array(44100).fill(0.5)
  s.fill(0, 0, 4410)
  expect(leadingSilence(s, 44100)).toBeCloseTo(0.1, 3)
})
test('all silent returns 0', () => {
  expect(leadingSilence(new Float32Array(1000), 44100)).toBe(0)
})
