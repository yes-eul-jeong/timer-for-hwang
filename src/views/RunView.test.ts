import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
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

const btn = (w: VueWrapper, l: string) => w.find(`[aria-label="${l}"]`)

test('재생 버튼으로 멈추고 다시 재생: 라벨·PAUSED 칩, 덮개 없음', async () => {
  const d = deps()
  const w = mount(RunView, { props: { deps: d } })
  expect(btn(w, '일시정지').exists()).toBe(true)
  expect(w.find('.chip').exists()).toBe(false)
  await btn(w, '일시정지').trigger('click')
  expect(w.classes()).toContain('paused')
  expect(w.find('.numwrap .chip').text()).toBe('PAUSED')
  expect(btn(w, '재생').exists()).toBe(true)
  expect(btn(w, '일시정지').exists()).toBe(false)
  expect(w.find('.pause').exists()).toBe(false)
  expect(btn(w, '처음부터').exists()).toBe(true)
  expect(btn(w, '다음 단계').exists()).toBe(true)
  expect(btn(w, '종료').exists()).toBe(true)
  await btn(w, '재생').trigger('click')
  expect(w.find('.chip').exists()).toBe(false)
  expect(w.classes()).not.toContain('paused')
  expect(d.audio!.schedule).toHaveBeenCalledTimes(2)
})

test('화면을 눌러도 아무 일 없음', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  await w.trigger('click')
  await w.find('.rnum').trigger('click')
  await w.find('.total').trigger('click')
  expect(w.find('.chip').exists()).toBe(false)
  expect(w.attributes('data-index')).toBe('0')
  expect(btn(w, '일시정지').exists()).toBe(true)
})

test('실행 중 다음 단계: 계속 달린다', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  await btn(w, '다음 단계').trigger('click')
  expect(w.attributes('data-index')).toBe('1')
  expect(w.attributes('data-phase')).toBe('work')
  expect(w.find('.rnum').text()).toBe('20')
  expect(btn(w, '일시정지').exists()).toBe(true)
})

test('실행 중 처음부터: 계속 달린다', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  t = 15000
  flush()
  await w.vm.$nextTick()
  expect(w.attributes('data-index')).toBe('1')
  await btn(w, '처음부터').trigger('click')
  expect(w.attributes('data-index')).toBe('0')
  expect(w.find('.rnum').text()).toBe('10')
  expect(w.classes()).not.toContain('paused')
  expect(btn(w, '일시정지').exists()).toBe(true)
})

test('멈춘 상태에서 다음 단계를 누르면 다시 달린다(기존 동작)', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  await btn(w, '일시정지').trigger('click')
  expect(w.classes()).toContain('paused')
  await btn(w, '다음 단계').trigger('click')
  expect(w.attributes('data-index')).toBe('1')
  expect(w.classes()).not.toContain('paused')
  expect(w.find('.chip').exists()).toBe(false)
  expect(btn(w, '일시정지').exists()).toBe(true)
})

test('실행 중 종료하면 시작 전 화면', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  await btn(w, '종료').trigger('click')
  expect(useAppStore().state.view).toBe('ready')
})

test('전체 남은 시간은 숫자 아래 한 줄', () => {
  const w = mount(RunView, { props: { deps: deps() } })
  expect(w.find('.total span').text()).toBe('전체 남은 시간')
  expect(w.find('.total b').text()).toBe('4:00')
  expect(w.findAll('.rstat span').map((x) => x.text())).toEqual(['남은 세트', '남은 라운드'])
  expect(w.find('.rstat.tot').exists()).toBe(false)
  expect(w.find('.srow .play').exists()).toBe(true)
})

test('끝: 땡, 버튼·NEXT 없음, 돌아가기 버튼만 동작', async () => {
  const w = mount(RunView, { props: { deps: deps() } })
  t = 1_000_000
  flush()
  await w.vm.$nextTick()
  expect(w.attributes('data-phase')).toBe('done')
  expect(w.find('.rnum').text()).toBe('땡')
  expect(w.find('.rnum').classes()).toContain('ttaeng')
  expect(w.find('.tools').exists()).toBe(false)
  expect(w.find('.play').exists()).toBe(false)
  expect(btn(w, '처음부터').exists()).toBe(false)
  expect(w.find('.total b').text()).toBe('0:00')
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
