import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createMemoryRepo } from '../storage/db'
import { createPrefs } from '../storage/prefs'
import { useAppStore, resetAppStore } from '../app/store'
import type { RunDeps } from '../run/useRun'
import RunView from './RunView.vue'

enableAutoUnmount(afterEach)

let t = 0
let frames = new Map<number, () => void>()
let nextId = 1
function deps(): Partial<RunDeps> {
  return {
    now: () => t,
    raf: (cb) => {
      const id = nextId++
      frames.set(id, cb)
      return id
    },
    caf: (id) => void frames.delete(id),
    audio: { unlock: vi.fn(async () => {}), schedule: vi.fn(), cancel: vi.fn() },
    wakeLock: vi.fn(async () => ({ release: vi.fn(async () => {}) })),
    doc: document,
  }
}
function flush() {
  const cbs = [...frames.values()]
  frames.clear()
  cbs.forEach((cb) => cb())
}

beforeEach(async () => {
  resetAppStore()
  t = 0
  frames = new Map()
  const m = new Map<string, string>()
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as unknown as Storage
  const store = useAppStore()
  await store.init({ repo: createMemoryRepo(), prefs: createPrefs(storage) })
  store.openReady(store.state.timers[0]!.id) // 타바타
  store.startRun()
})

test('tap pauses and shows three buttons', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  expect(w.text()).not.toContain('PAUSED')
  await w.trigger('click')
  expect(w.text()).toContain('PAUSED')
  const labels = w.findAll('.pause button').map((b) => b.text())
  expect(labels).toEqual(['다음 단계로', '처음부터', '종료'])
})

test('button tap does not also toggle pause', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  expect(w.attributes('data-index')).toBe('0')
  await w.trigger('click')
  const skip = w.findAll('.pause button').find((b) => b.text() === '다음 단계로')!
  await skip.trigger('click')
  expect(w.text()).not.toContain('PAUSED')
  expect(w.attributes('data-index')).toBe('1')
  expect(w.attributes('data-phase')).toBe('work')
})

test('end stops and returns to ready', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  await w.trigger('click')
  const end = w.findAll('.pause button').find((b) => b.text() === '종료')!
  await end.trigger('click')
  expect(useAppStore().state.view).toBe('ready')
})

test('done shows 땡 and tap returns to ready', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  t = 1_000_000
  flush()
  await w.vm.$nextTick()
  expect(w.attributes('data-phase')).toBe('done')
  expect(w.find('.rnum').text()).toBe('땡')
  expect(w.find('.rnext').text()).toBe('누르면 돌아가기')
  await w.trigger('click')
  expect(useAppStore().state.view).toBe('ready')
})

test('work phase is marked on root', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  t = 10500
  flush()
  await w.vm.$nextTick()
  expect(w.attributes('data-phase')).toBe('work')
  expect(w.find('.rnum').text()).toBe('20')
  expect(w.find('.rnum').classes()).not.toContain('long')
  await flushPromises()
})

test('round rest uses its own name and long number', async () => {
  const store = useAppStore()
  store.state.today = { name: 'x', prepare: 0, work: 5, rest: 0, sets: 1, rounds: 2, roundRest: 180 }
  const w = mount(RunView, { props: { deps: deps() } })
  expect(w.find('.rnext .lab').text()).toBe('라운드 휴식')
  t = 5000
  flush()
  await w.vm.$nextTick()
  expect(w.attributes('data-phase')).toBe('rest')
  expect(w.find('.rphase strong').text()).toBe('라운드 휴식')
  expect(w.find('.rphase em').text()).toBe('ROUND REST')
  expect(w.find('.rnum').text()).toBe('3:00')
  expect(w.find('.rnum').classes()).toContain('long')
  expect(w.find('.rnum').classes()).not.toContain('xlong')
})

test('ten minutes or more uses xlong', () => {
  const store = useAppStore()
  store.state.today = { name: 'x', prepare: 0, work: 600, rest: 0, sets: 1, rounds: 1, roundRest: 0 }
  const w = mount(RunView, { props: { deps: deps() } })
  expect(w.find('.rnum').text()).toBe('10:00')
  expect(w.find('.rnum').classes()).toEqual(expect.arrayContaining(['long', 'xlong']))
})
