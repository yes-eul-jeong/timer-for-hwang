import { test, expect, describe } from 'vitest'
import { createBackup, parseBackup, mergeTimers } from './backup'
import { DEFAULT_SETTINGS, type Timer } from '../core/types'

const t = (id: string, extra: Partial<Timer> = {}): Timer => ({
  id, name: id, prepare: 10, work: 20, rest: 10, sets: 8, rounds: 1, roundRest: 0, createdAt: '2026-11-04T00:00:00.000Z', ...extra,
})
const settings = { sound: 'voice' as const, flash: false }
const raw = (over: Record<string, unknown>) =>
  JSON.stringify({ app: 'ttaeng', version: 1, exportedAt: 'x', timers: [t('a')], settings, ...over })

describe('createBackup', () => {
  test('내용과 파일명', () => {
    const { filename, json } = createBackup([t('a')], settings, new Date(2026, 10, 4, 23, 30))
    expect(JSON.parse(json)).toMatchObject({ app: 'ttaeng', version: 1 })
    expect(filename).toBe('timer-backup-2026-11-04.json')
  })
})

describe('parseBackup', () => {
  test('왕복', () => {
    const { json } = createBackup([t('a')], settings, new Date(2026, 10, 4))
    const r = parseBackup(json)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.timers).toEqual([t('a')])
      expect(r.data.settings).toEqual(settings)
    }
  })
  test('rejects non-JSON', () => {
    expect(parseBackup('nope')).toEqual({ ok: false, error: '백업 파일을 읽을 수 없어요' })
  })
  test('rejects other app', () => {
    expect(parseBackup(raw({ app: 'x' }))).toEqual({ ok: false, error: '땡 백업 파일이 아니에요' })
  })
  test('rejects newer version', () => {
    expect(parseBackup(raw({ version: 2 }))).toEqual({ ok: false, error: '더 새 버전 앱에서 만든 백업이에요' })
  })
  test.each([
    ['누락', undefined],
    ['문자열', '1'],
    ['0', 0],
    ['소수', 1.5],
  ])('version %s → 읽을 수 없음', (_n, version) => {
    expect(parseBackup(raw({ version }))).toEqual({ ok: false, error: '백업 파일을 읽을 수 없어요' })
  })
  test('rejects duplicate timer ids', () => {
    expect(parseBackup(raw({ timers: [t('a'), t('a')] }))).toEqual({ ok: false, error: '타이머 정보가 잘못된 백업이에요' })
  })
  test.each([
    ['work -5', t('a', { work: -5 })],
    ['sets 0', t('a', { sets: 0 })],
    ['name 없음', { ...t('a'), name: undefined }],
    ['sets 1000', t('a', { sets: 1000 })],
  ])('rejects invalid timer: %s', (_n, bad) => {
    expect(parseBackup(raw({ timers: [bad] }))).toEqual({ ok: false, error: '타이머 정보가 잘못된 백업이에요' })
  })
  test('timers가 배열이 아니면 거부', () => {
    expect(parseBackup(raw({ timers: 'x' }))).toEqual({ ok: false, error: '타이머 정보가 잘못된 백업이에요' })
  })
  test('settings 없으면 기본값', () => {
    const r = parseBackup(raw({ settings: undefined }))
    expect(r.ok && r.data.settings).toEqual(DEFAULT_SETTINGS)
  })
  test('settings 깨지면 기본값', () => {
    const r = parseBackup(raw({ settings: { sound: 'loud', flash: 1 } }))
    expect(r.ok && r.data.settings).toEqual(DEFAULT_SETTINGS)
  })
})

describe('mergeTimers', () => {
  const cur = [t('a'), t('b')]
  test('replace', () => {
    expect(mergeTimers(cur, [t('c')], 'replace')).toEqual([t('c')])
  })
  test('merge: 같은 id 교체, 새 항목은 뒤에', () => {
    const out = mergeTimers(cur, [t('c'), t('a', { name: 'A2' })], 'merge')
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(out[0]?.name).toBe('A2')
  })
})
