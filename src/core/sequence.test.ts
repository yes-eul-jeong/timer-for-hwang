import { test, expect, describe } from 'vitest'
import { buildSequence } from './sequence'

const base = { name: 't', prepare: 10, work: 20, rest: 10, sets: 8, rounds: 1, roundRest: 0 }
test('tabata: prepare + 8 work + 7 rest, total 240', () => {
  const s = buildSequence(base)
  expect(s.steps.map(x => x.phase).join(',')).toBe('prepare,' + Array(8).fill('work').join(',rest,'))
  expect(s.total).toBe(10 + 8 * 20 + 7 * 10)
  expect(s.steps[1]).toMatchObject({ start: 10, duration: 20, set: 1, round: 1 })
})
test('rest after a set points to the next set', () => {
  const s = buildSequence(base)
  expect(s.steps[0]).toMatchObject({ phase: 'prepare', set: 1, round: 1 })
  expect(s.steps[2]).toMatchObject({ phase: 'rest', set: 2, round: 1 })
})
test('8 sets x 3 rounds without roundRest uses rest between rounds', () => {
  const s = buildSequence({ ...base, rounds: 3 })
  expect(s.steps.filter(x => x.phase === 'work')).toHaveLength(24)
  expect(s.steps.filter(x => x.roundRest)).toHaveLength(0)
  expect(s.total).toBe(10 + 24 * 20 + 23 * 10)
})
test('roundRest replaces rest only between rounds', () => {
  const s = buildSequence({ ...base, sets: 2, rounds: 2, roundRest: 60 })
  expect(s.steps.map(x => `${x.phase}${x.roundRest ? '*' : ''}:${x.duration}`))
    .toEqual(['prepare:10', 'work:20', 'rest:10', 'work:20', 'rest*:60', 'work:20', 'rest:10', 'work:20'])
  expect(s.steps[4]).toMatchObject({ set: 1, round: 2 })
})
describe('edge configs', () => {
  test('prepare 0 and rest 0 skip those steps', () => {
    const s = buildSequence({ ...base, prepare: 0, rest: 0, sets: 3 })
    expect(s.steps.map(x => x.phase)).toEqual(['work', 'work', 'work'])
    expect(s.total).toBe(60)
  })
  test('1 set 1 round with roundRest ignores roundRest', () => {
    const s = buildSequence({ ...base, sets: 1, rounds: 1, roundRest: 60 })
    expect(s.steps.map(x => x.phase)).toEqual(['prepare', 'work'])
  })
  test('kickboxing 3x3min', () => {
    expect(buildSequence({ ...base, work: 180, rest: 60, sets: 3 }).total).toBe(10 + 540 + 120)
  })
})
