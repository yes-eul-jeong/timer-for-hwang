import { reactive, toRaw } from 'vue'
import { stepValue } from '../core/limits'
import type { Settings, Timer, TimerConfig } from '../core/types'
import { DEFAULT_SETTINGS, toConfig } from '../core/types'
import { createMemoryRepo, loadTimersWithSeed, newId, openTimerRepo, type TimerRepo } from '../storage/db'
import { createPrefs, type Prefs } from '../storage/prefs'
import { mergeTimers, type BackupFile } from '../storage/backup'

export type View = 'list' | 'ready' | 'edit' | 'settings' | 'run'

export interface AppStore {
  state: {
    view: View
    timers: Timer[]
    settings: Settings
    currentId: string | null
    today: TimerConfig | null
    editingId: string | null
    toast: string | null
    volatile: boolean
    lastBackupAt: string | null
    installHintSeen: boolean
  }
  init(deps?: { repo?: TimerRepo; prefs?: Prefs; now?: () => Date }): Promise<void>
  go(view: 'list' | 'settings'): void
  openReady(id: string): void
  adjustToday(field: 'sets' | 'rounds', dir: 1 | -1): void
  openEdit(id: string | null): void
  saveTimer(config: TimerConfig): Promise<void>
  deleteTimer(id: string): Promise<void>
  startRun(): void
  endRun(): void
  updateSettings(patch: Partial<Settings>): void
  importBackup(data: BackupFile, mode: 'replace' | 'merge'): Promise<void>
  markBackedUp(now: Date): void
  showToast(msg: string): void
  dismissInstallHint(): void
}

function initialState(): AppStore['state'] {
  return {
    view: 'list',
    timers: [],
    settings: { ...DEFAULT_SETTINGS },
    currentId: null,
    today: null,
    editingId: null,
    toast: null,
    volatile: false,
    lastBackupAt: null,
    installHintSeen: false,
  }
}

const state = reactive(initialState())
let repo: TimerRepo = createMemoryRepo()
let prefs: Prefs | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

function plain(t: Timer): Timer {
  return { ...toRaw(t) }
}

function showToast(msg: string): void {
  if (toastTimer) clearTimeout(toastTimer)
  state.toast = msg
  toastTimer = setTimeout(() => {
    state.toast = null
    toastTimer = null
  }, 2200)
}

function openReady(id: string): void {
  const t = state.timers.find((x) => x.id === id)
  if (!t) return
  state.currentId = id
  state.today = toConfig(t)
  state.view = 'ready'
}

const store: AppStore = {
  state,
  async init(deps = {}) {
    repo = deps.repo ?? (await openTimerRepo())
    prefs = deps.prefs ?? createPrefs()
    const now = deps.now ?? (() => new Date())
    state.timers = await loadTimersWithSeed(repo, prefs, now)
    state.settings = prefs.getSettings()
    state.lastBackupAt = prefs.getLastBackupAt()
    state.installHintSeen = prefs.getFlag('installHintSeen')
    state.volatile = repo.volatile === true
    state.view = 'list'
  },
  go(view) {
    state.view = view
  },
  openReady,
  adjustToday(field, dir) {
    if (!state.today) return
    state.today[field] = stepValue(field, state.today[field], dir)
  },
  openEdit(id) {
    state.editingId = id
    state.view = 'edit'
  },
  async saveTimer(config) {
    const editingId = state.editingId
    const existing = editingId ? state.timers.find((x) => x.id === editingId) : undefined
    if (existing) {
      const next: Timer = { ...toRaw(config), id: existing.id, createdAt: existing.createdAt }
      await repo.put({ ...next })
      state.timers = state.timers.map((x) => (x.id === next.id ? next : x))
      openReady(next.id)
      showToast('저장했어요')
    } else {
      const next: Timer = { ...toRaw(config), id: newId(), createdAt: new Date().toISOString() }
      await repo.put({ ...next })
      state.timers = [...state.timers, next]
      state.editingId = null
      state.view = 'list'
      showToast('타이머를 추가했어요')
    }
  },
  async deleteTimer(id) {
    await repo.remove(id)
    state.timers = state.timers.filter((x) => x.id !== id)
    if (state.currentId === id) {
      state.currentId = null
      state.today = null
    }
    state.editingId = null
    state.view = 'list'
    showToast('삭제했어요')
  },
  startRun() {
    state.view = 'run'
  },
  endRun() {
    state.view = 'ready'
  },
  updateSettings(patch) {
    state.settings = { ...state.settings, ...patch }
    prefs?.setSettings({ ...state.settings })
  },
  async importBackup(data, mode) {
    const merged = mergeTimers(state.timers.map(plain), data.timers.map(plain), mode)
    await repo.replaceAll(merged.map(plain))
    state.timers = merged
    state.settings = { ...data.settings }
    prefs?.setSettings({ ...state.settings })
    if (state.currentId && !merged.some((t) => t.id === state.currentId)) {
      state.currentId = null
      state.today = null
    }
  },
  markBackedUp(now) {
    const iso = now.toISOString()
    state.lastBackupAt = iso
    prefs?.setLastBackupAt(iso)
  },
  showToast,
  dismissInstallHint() {
    state.installHintSeen = true
    prefs?.setFlag('installHintSeen', true)
  },
}

export function useAppStore(): AppStore {
  return store
}

export function resetAppStore(): void {
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = null
  Object.assign(state, initialState())
  repo = createMemoryRepo()
  prefs = null
}
