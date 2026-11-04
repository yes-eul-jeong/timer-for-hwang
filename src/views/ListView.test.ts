import { test, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryRepo } from '../storage/db'
import { createPrefs } from '../storage/prefs'
import { useAppStore, resetAppStore } from '../app/store'
import ListView from './ListView.vue'

beforeEach(async () => {
  resetAppStore()
  const m = new Map<string, string>()
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as unknown as Storage
  await useAppStore().init({ repo: createMemoryRepo(), prefs: createPrefs(storage) })
})

test('renders preset cards', () => {
  const w = mount(ListView)
  const cards = w.findAll('.tcard')
  expect(cards).toHaveLength(4)
  const t = cards[0]!.text()
  expect(t).toContain('타바타')
  expect(t).toContain('4:00')
  expect(t).toContain('운동 20 · 휴식 10 · 8세트')
})

test('card click opens ready', async () => {
  const w = mount(ListView)
  await w.findAll('.tcard')[0]!.trigger('click')
  await flushPromises()
  expect(useAppStore().state.view).toBe('ready')
})
