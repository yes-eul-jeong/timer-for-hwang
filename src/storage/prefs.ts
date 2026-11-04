import { DEFAULT_SETTINGS, type Settings } from '../core/types'

export interface Prefs {
  getSettings(): Settings
  setSettings(s: Settings): void
  getFlag(k: 'seeded' | 'installHintSeen'): boolean
  setFlag(k: 'seeded' | 'installHintSeen', v: boolean): void
  getLastBackupAt(): string | null
  setLastBackupAt(iso: string): void
}

const P = 'ttaeng.'

function read(storage: Storage | undefined, k: string): string | null {
  try {
    return storage?.getItem(P + k) ?? null
  } catch {
    return null
  }
}
function write(storage: Storage | undefined, k: string, v: string): void {
  try {
    storage?.setItem(P + k, v)
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

export function createPrefs(storage?: Storage): Prefs {
  let st: Storage | undefined = storage
  if (!st) {
    try {
      st = globalThis.localStorage
    } catch {
      st = undefined
    }
  }
  return {
    getSettings() {
      const raw = read(st, 'settings')
      if (!raw) return { ...DEFAULT_SETTINGS }
      try {
        const o = JSON.parse(raw) as Partial<Settings>
        const sound = o.sound === 'beep' || o.sound === 'voice' || o.sound === 'off' ? o.sound : DEFAULT_SETTINGS.sound
        const flash = typeof o.flash === 'boolean' ? o.flash : DEFAULT_SETTINGS.flash
        return { sound, flash }
      } catch {
        return { ...DEFAULT_SETTINGS }
      }
    },
    setSettings(s) {
      write(st, 'settings', JSON.stringify(s))
    },
    getFlag(k) {
      return read(st, k) === '1'
    },
    setFlag(k, v) {
      write(st, k, v ? '1' : '0')
    },
    getLastBackupAt() {
      return read(st, 'lastBackupAt')
    },
    setLastBackupAt(iso) {
      write(st, 'lastBackupAt', iso)
    },
  }
}

export async function requestPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
