import { isValidTimer } from '../core/limits'
import { DEFAULT_SETTINGS, type Settings, type Timer } from '../core/types'

export interface BackupFile {
  app: 'ttaeng'
  version: 1
  exportedAt: string
  timers: Timer[]
  settings: Settings
}

export type ParseResult = { ok: true; data: BackupFile } | { ok: false; error: string }

const pad = (n: number) => String(n).padStart(2, '0')

export function createBackup(timers: Timer[], settings: Settings, now: Date): { filename: string; json: string } {
  const file: BackupFile = { app: 'ttaeng', version: 1, exportedAt: now.toISOString(), timers, settings }
  return {
    filename: `timer-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`,
    json: JSON.stringify(file, null, 2),
  }
}

function fixSettings(x: unknown): Settings {
  if (typeof x !== 'object' || x === null) return { ...DEFAULT_SETTINGS }
  const o = x as Record<string, unknown>
  if ((o.sound !== 'beep' && o.sound !== 'voice' && o.sound !== 'off') || typeof o.flash !== 'boolean') {
    return { ...DEFAULT_SETTINGS }
  }
  return { sound: o.sound, flash: o.flash }
}

export function parseBackup(text: string): ParseResult {
  let o: unknown
  try {
    o = JSON.parse(text)
  } catch {
    return { ok: false, error: '백업 파일을 읽을 수 없어요' }
  }
  if (typeof o !== 'object' || o === null) return { ok: false, error: '백업 파일을 읽을 수 없어요' }
  const r = o as Record<string, unknown>
  if (r.app !== 'ttaeng') return { ok: false, error: '땡 백업 파일이 아니에요' }
  if (typeof r.version !== 'number' || !Number.isInteger(r.version) || r.version < 1) {
    return { ok: false, error: '백업 파일을 읽을 수 없어요' }
  }
  if (r.version > 1) return { ok: false, error: '더 새 버전 앱에서 만든 백업이에요' }
  if (
    !Array.isArray(r.timers) ||
    !r.timers.every(isValidTimer) ||
    new Set(r.timers.map((x: Timer) => x.id)).size !== r.timers.length
  ) {
    return { ok: false, error: '타이머 정보가 잘못된 백업이에요' }
  }
  return {
    ok: true,
    data: {
      app: 'ttaeng',
      version: 1,
      exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : '',
      timers: r.timers,
      settings: fixSettings(r.settings),
    },
  }
}

export function mergeTimers(current: Timer[], incoming: Timer[], mode: 'replace' | 'merge'): Timer[] {
  if (mode === 'replace') return incoming
  const inc = new Map(incoming.map((t) => [t.id, t]))
  const kept = current.map((t) => inc.get(t.id) ?? t)
  const have = new Set(current.map((t) => t.id))
  return [...kept, ...incoming.filter((t) => !have.has(t.id))]
}
