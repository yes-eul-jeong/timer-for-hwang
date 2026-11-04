import { test, expect } from 'vitest'
import { buildSequence } from '../core/sequence'
import { cuesFrom } from './cues'

const seq = buildSequence({ name: '', prepare: 3, work: 5, rest: 2, sets: 2, rounds: 1, roundRest: 0 }) // 0-3 P, 3-8 W, 8-10 R, 10-15 W
test('countdown and transitions', () => {
  expect(cuesFrom(seq, -1)).toMatchObject([
    { at: 1, kind: 'count2' }, { at: 2, kind: 'count1' }, { at: 3, kind: 'work' },
    { at: 5, kind: 'count3' }, { at: 6, kind: 'count2' }, { at: 7, kind: 'count1' }, { at: 8, kind: 'rest' },
    { at: 9, kind: 'count1' }, { at: 10, kind: 'work' },
    { at: 12, kind: 'count3' }, { at: 13, kind: 'count2' }, { at: 14, kind: 'count1' }, { at: 15, kind: 'end' },
  ])
})
test('only future cues', () => expect(cuesFrom(seq, 8)[0]).toMatchObject({ at: 9, kind: 'count1' }))
test('counts in steps of 3s or less are beepOnly', () => {
  const c = cuesFrom(seq, -1)
  expect(c.filter((x) => x.beepOnly).map((x) => x.at)).toEqual([1, 2, 9])
  expect(c.filter((x) => !x.kind.startsWith('count')).every((x) => !x.beepOnly)).toBe(true)
})
test('round rest transition is rest', () => {
  const s = buildSequence({ name: '', prepare: 0, work: 5, rest: 0, sets: 1, rounds: 2, roundRest: 30 })
  expect(cuesFrom(s, -1).filter((c) => c.kind === 'rest')).toMatchObject([{ at: 5, kind: 'rest' }])
})
