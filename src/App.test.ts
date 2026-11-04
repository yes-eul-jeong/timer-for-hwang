import { test, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryRepo } from './storage/db'
import { createPrefs } from './storage/prefs'
import { useAppStore, resetAppStore } from './app/store'
import App from './App.vue'

beforeEach(async () => {
  resetAppStore()
  const m = new Map<string, string>()
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as unknown as Storage
  await useAppStore().init({ repo: createMemoryRepo(), prefs: createPrefs(storage) })
})

test('BottomNav only on list and settings', async () => {
  const store = useAppStore()
  const w = mount(App)
  expect(w.find('nav.foot').exists()).toBe(true)
  store.openReady(store.state.timers[0]!.id)
  await w.vm.$nextTick()
  expect(w.find('nav.foot').exists()).toBe(false)
  store.go('settings')
  await w.vm.$nextTick()
  expect(w.find('nav.foot').exists()).toBe(true)
})
