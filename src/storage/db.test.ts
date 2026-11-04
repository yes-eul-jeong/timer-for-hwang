import { test, expect, describe, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { openTimerRepo, loadTimersWithSeed, createMemoryRepo, newId } from './db'
import { createPrefs } from './prefs'
import { PRESET_TIMERS } from '../core/presets'
import type { Timer } from '../core/types'

function mk(id: string, createdAt: string): Timer {
  return { id, name: id, prepare: 10, work: 20, rest: 10, sets: 8, rounds: 1, roundRest: 0, createdAt }
}
function memStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k) },
    setItem: (k, v) => { m.set(k, String(v)) },
  }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('TimerRepo', () => {
  test('put → list 왕복, remove', async () => {
    const repo = await openTimerRepo()
    await repo.put(mk('a', '2026-01-01T00:00:00.000Z'))
    await repo.put(mk('b', '2026-01-02T00:00:00.000Z'))
    expect((await repo.list()).map((t) => t.id)).toEqual(['a', 'b'])
    await repo.remove('a')
    expect((await repo.list()).map((t) => t.id)).toEqual(['b'])
  })
  test('replaceAll', async () => {
    const repo = await openTimerRepo()
    await repo.put(mk('a', '2026-01-01T00:00:00.000Z'))
    await repo.replaceAll([mk('x', '2026-01-01T00:00:00.000Z'), mk('y', '2026-01-02T00:00:00.000Z')])
    expect((await repo.list()).map((t) => t.id)).toEqual(['x', 'y'])
  })
  test('createdAt 오름차순, 같으면 id', async () => {
    const repo = await openTimerRepo()
    await repo.put(mk('late', '2026-02-01T00:00:00.000Z'))
    await repo.put(mk('b', '2026-01-01T00:00:00.000Z'))
    await repo.put(mk('a', '2026-01-01T00:00:00.000Z'))
    expect((await repo.list()).map((t) => t.id)).toEqual(['a', 'b', 'late'])
  })
  test('Proxy 같은 비평범 객체도 저장', async () => {
    const repo = await openTimerRepo()
    const proxied = new Proxy(mk('p', '2026-01-01T00:00:00.000Z'), {})
    await repo.put(proxied)
    expect((await repo.list())[0]?.id).toBe('p')
  })
  test('IndexedDB를 못 열면 메모리 저장소(volatile)', async () => {
    // @ts-expect-error 테스트용으로 제거
    globalThis.indexedDB = undefined
    const repo = await openTimerRepo()
    expect(repo.volatile).toBe(true)
    await repo.put(mk('a', '2026-01-01T00:00:00.000Z'))
    expect((await repo.list()).length).toBe(1)
  })
  test('createMemoryRepo 정렬', async () => {
    const repo = createMemoryRepo()
    await repo.put(mk('b', '2026-01-02T00:00:00.000Z'))
    await repo.put(mk('a', '2026-01-01T00:00:00.000Z'))
    expect((await repo.list()).map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('loadTimersWithSeed', () => {
  test('첫 호출 4개, 이후 비워도 다시 채우지 않음', async () => {
    const repo = await openTimerRepo()
    const prefs = createPrefs(memStorage())
    const now = () => new Date('2026-11-04T00:00:00.000Z')
    const first = await loadTimersWithSeed(repo, prefs, now)
    expect(first.length).toBe(4)
    expect(first[0]?.name).toBe('타바타')
    expect(first.map((t) => t.createdAt)).toEqual([...first.map((t) => t.createdAt)].sort())
    expect(prefs.getFlag('seeded')).toBe(true)
    await repo.replaceAll([])
    expect(await loadTimersWithSeed(repo, prefs, now)).toHaveLength(0)
  })
  test('seeded presets keep PRESET_TIMERS order', async () => {
    // 첫 호출이 가장 큰 id를 받도록 역순 UUID를 돌려준다. createdAt이 같으면 id 정렬로 순서가 뒤집힌다.
    const n = PRESET_TIMERS.length
    let call = 0
    const spy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      const prefix = String.fromCharCode('a'.charCodeAt(0) + (n - 1 - call++))
      return `${prefix}0000000-0000-4000-8000-000000000000` as `${string}-${string}-${string}-${string}-${string}`
    })
    try {
      const repo = await openTimerRepo()
      const prefs = createPrefs(memStorage())
      const list = await loadTimersWithSeed(repo, prefs, () => new Date('2026-11-04T00:00:00.000Z'))
      expect(list.map((t) => t.name)).toEqual(PRESET_TIMERS.map((p) => p.name))
      const times = list.map((t) => Date.parse(t.createdAt))
      for (let i = 1; i < times.length; i++) expect(times[i]!).toBeGreaterThan(times[i - 1]!)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('newId', () => {
  test('UUID v4 형식', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  test('randomUUID 없어도 생성', () => {
    const orig = crypto.randomUUID
    // @ts-expect-error 테스트용
    crypto.randomUUID = undefined
    try {
      const a = newId()
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(newId()).not.toBe(a)
    } finally {
      crypto.randomUUID = orig
    }
  })
})
