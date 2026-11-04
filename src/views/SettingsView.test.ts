import { test, expect, vi, describe, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryRepo } from '../storage/db'
import { createPrefs } from '../storage/prefs'
import { useAppStore, resetAppStore } from '../app/store'
import { createBackup } from '../storage/backup'

const share = vi.hoisted(() => ({
  exportBackupFile: vi.fn(),
  pickBackupFile: vi.fn(),
}))
vi.mock('../storage/share', () => share)

import SettingsView from './SettingsView.vue'

const DAY = 86_400_000

beforeEach(async () => {
  share.exportBackupFile.mockReset()
  share.pickBackupFile.mockReset()
  resetAppStore()
  const m = new Map<string, string>()
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as unknown as Storage
  await useAppStore().init({ repo: createMemoryRepo(), prefs: createPrefs(storage) })
  useAppStore().state.volatile = false
})

const btn = (w: ReturnType<typeof mount>, text: string) => w.findAll('button').find((b) => b.text() === text)!

describe('설정', () => {
  test('소리 세그먼트', async () => {
    const w = mount(SettingsView)
    const seg = w.findAll('.seg button')
    expect(seg.map((b) => b.text())).toEqual(['삐-삐-삐', '한국어 음성', '끔'])
    expect(seg[0]!.attributes('aria-pressed')).toBe('true')
    await seg[2]!.trigger('click')
    expect(useAppStore().state.settings.sound).toBe('off')
    expect(seg[2]!.attributes('aria-pressed')).toBe('true')
    expect(seg[0]!.attributes('aria-pressed')).toBe('false')
  })

  test('번쩍임 토글', async () => {
    const w = mount(SettingsView)
    await w.find('.toggle').trigger('click')
    expect(useAppStore().state.settings.flash).toBe(false)
    expect(w.find('.toggle').attributes('aria-pressed')).toBe('false')
  })

  test('마지막 백업 표시', async () => {
    const store = useAppStore()
    let w = mount(SettingsView)
    expect(w.text()).toContain('마지막 백업: 없음')
    expect(w.text()).not.toContain('백업한 지 30일이 지났어요')
    store.markBackedUp(new Date(Date.now() - 31 * DAY))
    w = mount(SettingsView)
    expect(w.text()).toContain('백업한 지 30일이 지났어요')
    expect(w.text()).toMatch(/마지막 백업: \d{4}\. \d{1,2}\. \d{1,2}\./)
    store.markBackedUp(new Date(Date.now() - 10 * DAY))
    w = mount(SettingsView)
    expect(w.text()).not.toContain('백업한 지 30일이 지났어요')
  })

  test.each(['shared', 'downloaded'])('내보내기 %s -> markBackedUp', async (r) => {
    share.exportBackupFile.mockResolvedValue(r)
    const w = mount(SettingsView)
    await btn(w, '백업 내보내기').trigger('click')
    await flushPromises()
    expect(share.exportBackupFile).toHaveBeenCalledOnce()
    expect(useAppStore().state.lastBackupAt).not.toBeNull()
    expect(useAppStore().state.toast).toBe('백업 파일을 만들었어요')
  })

  test('내보내기 취소 -> markBackedUp 안 함', async () => {
    share.exportBackupFile.mockResolvedValue('cancelled')
    const w = mount(SettingsView)
    await btn(w, '백업 내보내기').trigger('click')
    await flushPromises()
    expect(useAppStore().state.lastBackupAt).toBeNull()
    expect(useAppStore().state.toast).toBeNull()
  })

  test('깨진 파일은 토스트로 알리고 데이터 유지', async () => {
    share.pickBackupFile.mockResolvedValue('not json')
    const store = useAppStore()
    const before = store.state.timers.length
    const w = mount(SettingsView)
    await btn(w, '백업 불러오기').trigger('click')
    await flushPromises()
    expect(store.state.toast).toBe('백업 파일을 읽을 수 없어요')
    expect(store.state.timers).toHaveLength(before)
    expect(w.text()).not.toContain('덮어쓰기')
  })

  test('파일 선택 취소는 아무 일도 없다', async () => {
    share.pickBackupFile.mockResolvedValue(null)
    const w = mount(SettingsView)
    await btn(w, '백업 불러오기').trigger('click')
    await flushPromises()
    expect(useAppStore().state.toast).toBeNull()
    expect(w.text()).not.toContain('덮어쓰기')
  })

  test('정상 파일: 합치기', async () => {
    const store = useAppStore()
    const extra = { ...store.state.timers[0]!, id: 'extra-1', name: '추가' }
    share.pickBackupFile.mockResolvedValue(createBackup([extra], store.state.settings, new Date()).json)
    const before = store.state.timers.length
    const w = mount(SettingsView)
    await btn(w, '백업 불러오기').trigger('click')
    await flushPromises()
    expect(btn(w, '덮어쓰기')).toBeTruthy()
    expect(btn(w, '취소')).toBeTruthy()
    await btn(w, '합치기').trigger('click')
    await flushPromises()
    expect(store.state.timers).toHaveLength(before + 1)
    expect(store.state.toast).toBe('불러왔어요')
    expect(w.text()).not.toContain('덮어쓰기')
  })

  test('정상 파일: 덮어쓰기와 취소', async () => {
    const store = useAppStore()
    const extra = { ...store.state.timers[0]!, id: 'extra-1', name: '추가' }
    share.pickBackupFile.mockResolvedValue(createBackup([extra], store.state.settings, new Date()).json)
    const w = mount(SettingsView)
    await btn(w, '백업 불러오기').trigger('click')
    await flushPromises()
    await btn(w, '취소').trigger('click')
    expect(store.state.timers.length).toBeGreaterThan(1)
    expect(w.text()).not.toContain('덮어쓰기')
    await btn(w, '백업 불러오기').trigger('click')
    await flushPromises()
    await btn(w, '덮어쓰기').trigger('click')
    await flushPromises()
    expect(store.state.timers.map((t) => t.id)).toEqual(['extra-1'])
    expect(store.state.toast).toBe('불러왔어요')
  })

  test('volatile 경고', () => {
    const w = mount(SettingsView)
    expect(w.text()).not.toContain('데이터가 저장되지 않아요')
    useAppStore().state.volatile = true
    return w.vm.$nextTick().then(() => {
      expect(w.text()).toContain('이 브라우저에서는 데이터가 저장되지 않아요. 홈 화면에 추가해서 쓰세요')
    })
  })

  test('버전 푸터', () => {
    const w = mount(SettingsView)
    expect(w.text()).toContain(`땡 v${__APP_VERSION__} · 데이터는 이 휴대폰에만 저장됩니다.`)
  })
})
