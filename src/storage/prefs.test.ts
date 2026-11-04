import { test, expect, describe } from 'vitest'
import { createPrefs } from './prefs'
import { DEFAULT_SETTINGS } from '../core/types'

function memStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init))
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k) },
    setItem: (k, v) => { m.set(k, String(v)) },
  }
}

describe('createPrefs', () => {
  test('저장소가 비면 기본 설정', () => {
    expect(createPrefs(memStorage()).getSettings()).toEqual(DEFAULT_SETTINGS)
  })
  test('설정 왕복', () => {
    const p = createPrefs(memStorage())
    p.setSettings({ sound: 'voice', flash: false })
    expect(p.getSettings()).toEqual({ sound: 'voice', flash: false })
  })
  test('깨진 JSON이면 기본 설정', () => {
    const p = createPrefs(memStorage({ 'ttaeng.settings': '{oops' }))
    expect(p.getSettings()).toEqual(DEFAULT_SETTINGS)
  })
  test('getItem이 throw해도 기본 설정', () => {
    const bad = { ...memStorage(), getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } } as Storage
    const p = createPrefs(bad)
    expect(p.getSettings()).toEqual(DEFAULT_SETTINGS)
    expect(p.getFlag('seeded')).toBe(false)
    expect(p.getLastBackupAt()).toBeNull()
    expect(() => p.setFlag('seeded', true)).not.toThrow()
  })
  test('플래그와 마지막 백업 시각', () => {
    const p = createPrefs(memStorage())
    expect(p.getFlag('seeded')).toBe(false)
    p.setFlag('seeded', true)
    expect(p.getFlag('seeded')).toBe(true)
    p.setLastBackupAt('2026-11-04T00:00:00.000Z')
    expect(p.getLastBackupAt()).toBe('2026-11-04T00:00:00.000Z')
  })
})
