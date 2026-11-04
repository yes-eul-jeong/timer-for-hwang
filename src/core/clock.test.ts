import { test, expect, describe } from 'vitest'
import { buildSequence } from './sequence'
import { stateAt, createRunClock } from './clock'

const seq = buildSequence({ name: '', prepare: 10, work: 20, rest: 10, sets: 2, rounds: 1, roundRest: 0 }) // total 60
test('prepare at 0', () => expect(stateAt(seq, 2, 1, 0)).toMatchObject({ phase: 'prepare', remaining: 10, totalRemaining: 60, setsLeft: 2, roundsLeft: 1 }))
test('remaining uses ceil', () => expect(stateAt(seq, 2, 1, 10.2)).toMatchObject({ phase: 'work', remaining: 20 }))
test('rest counts the upcoming set', () => expect(stateAt(seq, 2, 1, 31)).toMatchObject({ phase: 'rest', setsLeft: 1 }))
test('next step', () => expect(stateAt(seq, 2, 1, 0).next?.phase).toBe('work'))
test('done at total and beyond', () => {
  expect(stateAt(seq, 2, 1, 60)).toMatchObject({ phase: 'done', remaining: 0, totalRemaining: 0, step: null, next: null })
  expect(stateAt(seq, 2, 1, 999).phase).toBe('done')
})
test('pause excludes paused time', () => {
  let t = 0; const c = createRunClock(() => t)
  t = 5000; c.pause(); t = 65000; expect(c.elapsed()).toBe(5); c.resume(); t = 66000
  expect(c.elapsed()).toBe(6)
})
test('skip jumps to end of current step and stays paused', () => {
  let t = 0; const c = createRunClock(() => t)
  c.pause(); c.skip(seq); expect(c.elapsed()).toBe(10); expect(c.paused).toBe(true)
})
describe('controls at boundaries', () => {
  test('skip on last step goes to done', () => { let t = 0; const c = createRunClock(() => t); t = 45000; c.pause(); c.skip(seq); expect(stateAt(seq, 2, 1, c.elapsed()).phase).toBe('done') })
  test('skip when done is a no-op', () => { let t = 0; const c = createRunClock(() => t); t = 99000; c.pause(); c.skip(seq); expect(c.elapsed()).toBe(99) })
  test('restart while paused runs from 0', () => { let t = 0; const c = createRunClock(() => t); t = 20000; c.pause(); c.restart(); expect(c.paused).toBe(false); t = 21000; expect(c.elapsed()).toBe(1) })
})
