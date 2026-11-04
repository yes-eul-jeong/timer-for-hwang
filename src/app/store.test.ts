import { test, expect, describe, beforeEach, vi } from 'vitest'
import { createMemoryRepo } from '../storage/db'
import { createPrefs } from '../storage/prefs'
import { PRESET_TIMERS } from '../core/presets'
import { useAppStore, resetAppStore } from './store'

function memStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

async function setup() {
  const store = useAppStore()
  const repo = createMemoryRepo()
  await store.init({ repo, prefs: createPrefs(memStorage()) })
  return { store, repo }
}

beforeEach(() => resetAppStore())

describe('app store', () => {
  test('init seeds presets and shows list', async () => {
    const { store } = await setup()
    expect(store.state.timers).toHaveLength(PRESET_TIMERS.length)
    expect(store.state.view).toBe('list')
  })

  test('adjustToday stops at 1 and does not touch the saved timer', async () => {
    const { store } = await setup()
    const first = store.state.timers[0]!
    store.openReady(first.id)
    for (let i = 0; i < 8; i++) store.adjustToday('sets', -1)
    expect(store.state.today!.sets).toBe(1)
    expect(store.state.timers[0]!.sets).toBe(8)
  })

  test('saveTimer creates a new timer and returns to list', async () => {
    const { store, repo } = await setup()
    store.openEdit(null)
    await store.saveTimer({ ...PRESET_TIMERS[0]!, name: '새것' })
    expect(store.state.timers).toHaveLength(PRESET_TIMERS.length + 1)
    expect(store.state.view).toBe('list')
    expect(store.state.toast).toBe('타이머를 추가했어요')
    expect(await repo.list()).toHaveLength(PRESET_TIMERS.length + 1)
  })

  test('saveTimer on edit updates and opens ready with fresh today', async () => {
    const { store } = await setup()
    const t = store.state.timers[0]!
    store.openReady(t.id)
    store.adjustToday('sets', -1)
    store.openEdit(t.id)
    const { id: _i, createdAt: _c, ...config } = t
    await store.saveTimer({ ...config, name: '바뀜', sets: 5 })
    expect(store.state.view).toBe('ready')
    expect(store.state.toast).toBe('저장했어요')
    expect(store.state.timers.find((x) => x.id === t.id)!.name).toBe('바뀜')
    expect(store.state.today!.sets).toBe(5)
  })

  test('deleteTimer clears currentId and goes to list', async () => {
    const { store } = await setup()
    const t = store.state.timers[0]!
    store.openReady(t.id)
    await store.deleteTimer(t.id)
    expect(store.state.currentId).toBeNull()
    expect(store.state.view).toBe('list')
    expect(store.state.toast).toBe('삭제했어요')
    expect(store.state.timers.some((x) => x.id === t.id)).toBe(false)
  })

  test('startRun and endRun switch views', async () => {
    const { store } = await setup()
    store.openReady(store.state.timers[0]!.id)
    store.startRun()
    expect(store.state.view).toBe('run')
    store.endRun()
    expect(store.state.view).toBe('ready')
  })

  test('updateSettings persists', async () => {
    const { store } = await setup()
    store.updateSettings({ sound: 'voice' })
    expect(store.state.settings.sound).toBe('voice')
  })

  test('importBackup replace and merge', async () => {
    const { store, repo } = await setup()
    const [a, b] = store.state.timers
    await store.importBackup(
      { app: 'ttaeng', version: 1, exportedAt: '', timers: [a!], settings: { sound: 'off', flash: false } },
      'replace',
    )
    expect(store.state.timers).toHaveLength(1)
    expect(await repo.list()).toHaveLength(1)
    expect(store.state.settings.sound).toBe('off')
    await store.importBackup(
      { app: 'ttaeng', version: 1, exportedAt: '', timers: [b!], settings: { sound: 'off', flash: false } },
      'merge',
    )
    expect(store.state.timers).toHaveLength(2)
  })

  test('showToast clears after 2.2s', async () => {
    const { store } = await setup()
    vi.useFakeTimers()
    store.showToast('hi')
    expect(store.state.toast).toBe('hi')
    vi.advanceTimersByTime(2200)
    expect(store.state.toast).toBeNull()
    vi.useRealTimers()
  })

  test('markBackedUp stores time', async () => {
    const { store } = await setup()
    store.markBackedUp(new Date('2026-01-01T00:00:00Z'))
    expect(store.state.lastBackupAt).toBe('2026-01-01T00:00:00.000Z')
  })
})
