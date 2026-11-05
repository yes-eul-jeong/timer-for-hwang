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
    audio: { unlock: vi.fn(async () => {}), schedule: vi.fn(), cancel: vi.fn(), setVolume: vi.fn(), preview: vi.fn() },
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

test('멈춤 버튼으로 멈추고 버튼 4개', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  expect(w.text()).not.toContain('PAUSED')
  expect(w.find('.pz').text()).toBe('멈춤')
  await w.find('.pz').trigger('click')
  expect(w.text()).toContain('PAUSED')
  const labels = w.findAll('.pause button').map((b) => b.text())
  expect(labels).toEqual(['계속', '다음 단계로', '처음부터', '종료'])
})

test('화면을 눌러도 멈추지 않는다', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  await w.trigger('click')
  expect(w.text()).not.toContain('PAUSED')
  await w.find('.rnum').trigger('click')
  expect(w.text()).not.toContain('PAUSED')
})

test('계속을 누르면 이어서, 배경을 눌러도 그대로', async () => {
  const d = deps()
  const w = mount(RunView, { props: { deps: d } })
  await w.find('.pz').trigger('click')
  await w.find('.pause').trigger('click')
  expect(w.text()).toContain('PAUSED')
  await w.find('.pause .go').trigger('click')
  expect(w.text()).not.toContain('PAUSED')
  expect(d.audio!.schedule).toHaveBeenCalledTimes(2)
})

test('button tap does not also toggle pause', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  expect(w.attributes('data-index')).toBe('0')
  await w.find('.pz').trigger('click')
  const skip = w.findAll('.pause button').find((b) => b.text() === '다음 단계로')!
  await skip.trigger('click')
  expect(w.text()).not.toContain('PAUSED')
  expect(w.attributes('data-index')).toBe('1')
  expect(w.attributes('data-phase')).toBe('work')
})

test('end stops and returns to ready', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  await w.find('.pz').trigger('click')
  const end = w.findAll('.pause button').find((b) => b.text() === '종료')!
  await end.trigger('click')
  expect(useAppStore().state.view).toBe('ready')
})

test('전체 남은 시간은 통계 3번째 칸', () => {
  const w = mount(RunView, { props: { deps: deps() } })
  expect(w.findAll('.rstat span').map((x) => x.text())).toEqual(['남은 세트', '남은 라운드', '전체 남은 시간'])
  expect(w.find('.rstat.tot b').text()).toBe('4:00')
  expect(w.find('.rtotal').exists()).toBe(false)
})

test('끝: 땡, 멈춤·NEXT 없음, 돌아가기 버튼만 동작', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  t = 1_000_000
  flush()
  await w.vm.$nextTick()
  expect(w.attributes('data-phase')).toBe('done')
  expect(w.find('.rnum').text()).toBe('땡')
  expect(w.find('.rnum').classes()).toContain('ttaeng')
  expect(w.find('.pz').exists()).toBe(false)
  expect(w.find('.rnext').exists()).toBe(false)
  expect(w.text()).not.toContain('누르면 돌아가기')
  await w.trigger('click')
  expect(useAppStore().state.view).toBe('run')
  expect(w.find('.back').text()).toBe('돌아가기')
  await w.find('.back').trigger('click')
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
