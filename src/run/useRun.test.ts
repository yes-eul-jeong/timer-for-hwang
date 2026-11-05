import { test, expect, vi, beforeEach } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import type { Settings, TimerConfig } from '../core/types'
import type { AudioPlayer } from '../audio/player'
import { useRun, type RunDeps } from './useRun'

const tabata: TimerConfig = { name: '타바타', prepare: 10, work: 20, rest: 10, sets: 8, rounds: 1, roundRest: 0 }

function fakeDeps() {
  let t = 0
  let nextId = 1
  const frames = new Map<number, () => void>()
  const audio = { unlock: vi.fn(async () => {}), schedule: vi.fn(), cancel: vi.fn(), setVolume: vi.fn(), preview: vi.fn() } satisfies AudioPlayer
  const release = vi.fn(async () => {})
  const wakeLock = vi.fn(async () => ({ release }))
  const deps: RunDeps = {
    now: () => t,
    raf: (cb) => {
      const id = nextId++
      frames.set(id, cb)
      return id
    },
    caf: (id) => void frames.delete(id),
    audio,
    wakeLock,
    doc: document,
  }
  return {
    deps,
    audio,
    wakeLock,
    release,
    frames,
    setNow: (ms: number) => void (t = ms),
    flush() {
      const cbs = [...frames.values()]
      frames.clear()
      cbs.forEach((cb) => cb())
    },
  }
}

let scope: EffectScope
beforeEach(() => {
  scope?.stop()
  scope = effectScope()
})

function start(f: ReturnType<typeof fakeDeps>, settings: Settings = { sound: 'beep', flash: true, volume: 5 }, config = tabata) {
  return scope.run(() => useRun(config, settings, f.deps))!
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

test('첫 예약 전에 설정 음량을 적용한다', () => {
  const f = fakeDeps()
  start(f, { sound: 'beep', flash: true, volume: 2 })
  expect(f.audio.setVolume).toHaveBeenCalledWith(2)
  expect(f.audio.setVolume.mock.invocationCallOrder[0]!).toBeLessThan(f.audio.schedule.mock.invocationCallOrder[0]!)
})

test('schedules cues once at start from before zero', () => {
  const f = fakeDeps()
  start(f)
  expect(f.audio.schedule).toHaveBeenCalledTimes(1)
  const [cues, elapsedNow, mode] = f.audio.schedule.mock.calls[0]!
  expect(cues[0]).toMatchObject({ at: 7, kind: 'count3' })
  expect(elapsedNow).toBe(0)
  expect(mode).toBe('beep')
  expect(f.wakeLock).toHaveBeenCalledTimes(1)
})

test('advances on animation frame and bumps flashKey', () => {
  const f = fakeDeps()
  const r = start(f)
  expect(r.flashKey.value).toBe(0)
  f.setNow(10500)
  f.flush()
  expect(r.state.value.phase).toBe('work')
  expect(r.flashKey.value).toBe(1)
})

test('flash off keeps flashKey at 0', () => {
  const f = fakeDeps()
  const r = start(f, { sound: 'beep', flash: false, volume: 5 })
  f.setNow(10500)
  f.flush()
  expect(r.state.value.phase).toBe('work')
  expect(r.flashKey.value).toBe(0)
})

test('toggle pauses, cancels audio, and resumes from paused elapsed', () => {
  const f = fakeDeps()
  const r = start(f)
  f.setNow(4000)
  r.toggle()
  expect(r.paused.value).toBe(true)
  expect(f.audio.cancel).toHaveBeenCalled()
  expect(f.frames.size).toBe(0)
  f.setNow(9000)
  r.toggle()
  expect(r.paused.value).toBe(false)
  expect(f.audio.schedule).toHaveBeenCalledTimes(2)
  expect(f.audio.schedule.mock.calls[1]![1]).toBe(4)
  expect(r.state.value.remaining).toBe(6)
  expect(f.frames.size).toBe(1)
})

test('skip resumes, recomputes immediately, and reschedules', () => {
  const f = fakeDeps()
  const r = start(f)
  f.setNow(3000)
  r.toggle()
  r.skip()
  expect(r.paused.value).toBe(false)
  expect(r.state.value.index).toBe(1)
  expect(r.state.value.phase).toBe('work')
  const last = f.audio.schedule.mock.calls.at(-1)!
  expect(last[1]).toBe(10)
  // 경계에 정확히 떨어진 전환음은 빠진다
  expect(last[0].some((c: { at: number }) => c.at === 10)).toBe(false)
})

test('restart goes back to zero', () => {
  const f = fakeDeps()
  const r = start(f)
  f.setNow(15000)
  f.flush()
  r.restart()
  expect(r.state.value.index).toBe(0)
  expect(r.state.value.remaining).toBe(10)
  const last = f.audio.schedule.mock.calls.at(-1)!
  expect(last[1]).toBe(0)
  expect(last[0][0]).toMatchObject({ at: 7, kind: 'count3' })
})

test('resyncs after visibility change', async () => {
  const f = fakeDeps()
  const r = start(f)
  await tick()
  f.setNow(60000)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(r.state.value.totalRemaining).toBe(240 - 60)
  expect(f.audio.unlock).toHaveBeenCalledTimes(1)
  expect(f.audio.unlock.mock.invocationCallOrder[0]!).toBeLessThan(f.audio.schedule.mock.invocationCallOrder[1]!)
  expect(f.audio.schedule).toHaveBeenCalledTimes(2)
  expect(f.audio.schedule.mock.calls[1]![1]).toBe(60)
  expect(f.audio.schedule.mock.calls[1]![0].every((c: { at: number }) => c.at > 60)).toBe(true)
  expect(f.release).toHaveBeenCalledTimes(1)
  expect(f.wakeLock).toHaveBeenCalledTimes(2)
})

test('visibility change while paused does not reschedule', () => {
  const f = fakeDeps()
  const r = start(f)
  r.toggle()
  f.setNow(60000)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(f.audio.schedule).toHaveBeenCalledTimes(1)
  expect(f.wakeLock).toHaveBeenCalledTimes(1)
})

test('stops animation frames when done', () => {
  const f = fakeDeps()
  const r = start(f)
  f.setNow(300000)
  f.flush()
  expect(r.state.value.phase).toBe('done')
  expect(f.frames.size).toBe(0)
  r.toggle()
  expect(r.paused.value).toBe(false)
})

test('dispose cleans up frames, audio, wake lock, and listener', async () => {
  const f = fakeDeps()
  start(f)
  await tick()
  scope.stop()
  expect(f.frames.size).toBe(0)
  expect(f.audio.cancel).toHaveBeenCalled()
  expect(f.release).toHaveBeenCalled()
  f.setNow(60000)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(f.audio.schedule).toHaveBeenCalledTimes(1)
})

test('resume after pause unlocks audio', () => {
  const f = fakeDeps()
  const r = start(f)
  r.toggle()
  expect(f.audio.unlock).not.toHaveBeenCalled()
  r.toggle()
  expect(f.audio.unlock).toHaveBeenCalled()
  expect(f.audio.unlock.mock.invocationCallOrder[0]!).toBeLessThan(f.audio.schedule.mock.invocationCallOrder[1]!)
})

test('skip and restart unlock audio', () => {
  const f = fakeDeps()
  const r = start(f)
  r.skip()
  expect(f.audio.unlock).toHaveBeenCalledTimes(1)
  r.restart()
  expect(f.audio.unlock).toHaveBeenCalledTimes(2)
})
