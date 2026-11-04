import { test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryRepo } from '../storage/db'
import { createPrefs } from '../storage/prefs'
import { useAppStore, resetAppStore } from '../app/store'
import ReadyView from './ReadyView.vue'

const unlock = vi.fn(async () => {})
vi.mock('../audio/player', () => ({
  getAudioPlayer: () => ({ unlock, schedule: vi.fn(), cancel: vi.fn() }),
}))

beforeEach(async () => {
  resetAppStore()
  unlock.mockClear()
  const m = new Map<string, string>()
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as unknown as Storage
  const store = useAppStore()
  await store.init({ repo: createMemoryRepo(), prefs: createPrefs(storage) })
  store.openReady(store.state.timers[0]!.id)
})

test('shows total and updates when sets increase', async () => {
  const w = mount(ReadyView)
  expect(w.find('.ready-total b').text()).toBe('4:00')
  await w.find('[aria-label="세트 늘리기"]').trigger('click')
  expect(w.text()).toContain('9')
  expect(w.find('.ready-total b').text()).toBe('4:30')
})

test('start unlocks audio and runs', async () => {
  const w = mount(ReadyView)
  await w.find('.start').trigger('click')
  expect(unlock).toHaveBeenCalled()
  expect(useAppStore().state.view).toBe('run')
})

test('back goes to list', async () => {
  const w = mount(ReadyView)
  await w.find('[data-back]').trigger('click')
  expect(useAppStore().state.view).toBe('list')
})
