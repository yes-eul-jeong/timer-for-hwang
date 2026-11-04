import { PRESET_TIMERS } from '../core/presets'
import type { Timer } from '../core/types'
import type { Prefs } from './prefs'

export interface TimerRepo {
  list(): Promise<Timer[]>
  put(t: Timer): Promise<void>
  remove(id: string): Promise<void>
  replaceAll(ts: Timer[]): Promise<void>
  volatile?: boolean
}

const DB_NAME = 'ttaeng'
const STORE = 'timers'

function byCreated(a: Timer, b: Timer): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function createMemoryRepo(): TimerRepo {
  const m = new Map<string, Timer>()
  return {
    volatile: true,
    async list() {
      return [...m.values()].map((t) => ({ ...t })).sort(byCreated)
    },
    async put(t) {
      m.set(t.id, { ...t })
    },
    async remove(id) {
      m.delete(id)
    },
    async replaceAll(ts) {
      m.clear()
      for (const t of ts) m.set(t.id, { ...t })
    },
  }
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => {
      r.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.onblocked = () => reject(new Error('blocked'))
  })
}

export async function openTimerRepo(): Promise<TimerRepo> {
  try {
    const db = await openDb()
    return {
      async list() {
        const all = await req(db.transaction(STORE).objectStore(STORE).getAll() as IDBRequest<Timer[]>)
        return all.sort(byCreated)
      },
      async put(t) {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put({ ...t })
        await done(tx)
      },
      async remove(id) {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(id)
        await done(tx)
      },
      async replaceAll(ts) {
        const tx = db.transaction(STORE, 'readwrite')
        const s = tx.objectStore(STORE)
        s.clear()
        for (const t of ts) s.put({ ...t })
        await done(tx)
      },
    }
  } catch {
    return createMemoryRepo()
  }
}

export function newId(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`
}

export async function loadTimersWithSeed(repo: TimerRepo, prefs: Prefs, now: () => Date): Promise<Timer[]> {
  if (!prefs.getFlag('seeded')) {
    const base = now().getTime()
    for (const [i, p] of PRESET_TIMERS.entries()) {
      await repo.put({ ...p, id: newId(), createdAt: new Date(base + i).toISOString() })
    }
    prefs.setFlag('seeded', true)
  }
  return repo.list()
}
