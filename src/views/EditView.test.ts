import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryRepo } from '../storage/db'
import { createPrefs } from '../storage/prefs'
import { useAppStore, resetAppStore } from '../app/store'
import EditView from './EditView.vue'

beforeEach(async () => {
  resetAppStore()
  const m = new Map<string, string>()
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as unknown as Storage
  await useAppStore().init({ repo: createMemoryRepo(), prefs: createPrefs(storage) })
})

afterEach(() => {
  vi.useRealTimers()
})

const val = (w: ReturnType<typeof mount>, label: string) =>
  w.findAll('.stepper').find((s) => s.find('.lab').text().startsWith(label))!.find('.val').text()
const click = (w: ReturnType<typeof mount>, label: string) =>
  w.find(`[aria-label="${label}"]`).trigger('click')

test('new timer has defaults, title and no delete button', () => {
  useAppStore().openEdit(null)
  const w = mount(EditView)
  expect(w.find('.bar span').text()).toBe('새 타이머')
  expect(val(w, '준비')).toBe('10')
  expect(val(w, '운동')).toBe('20')
  expect(val(w, '휴식')).toBe('10')
  expect(val(w, '세트')).toBe('8')
  expect(val(w, '라운드')).toBe('1')
  expect(val(w, '라운드 간 휴식')).toBe('0')
  expect(w.find('.danger').exists()).toBe(false)
})

test('time field steps and formats', async () => {
  useAppStore().openEdit(null)
  const w = mount(EditView)
  for (let i = 0; i < 8; i++) await click(w, '운동 늘리기')
  expect(val(w, '운동')).toBe('1:00')
  await click(w, '운동 늘리기')
  expect(val(w, '운동')).toBe('1:15')
})

test('empty name falls back to default name on save', async () => {
  const store = useAppStore()
  store.openEdit(null)
  const w = mount(EditView)
  await w.find('.go').trigger('click')
  await vi.waitFor(() => expect(store.state.view).toBe('list'))
  expect(store.state.timers.at(-1)!.name).toBe('20/10 인터벌')
})

test('name input has maxlength 20', () => {
  useAppStore().openEdit(null)
  expect(mount(EditView).find('input').attributes('maxlength')).toBe('20')
})

test('edit mode: two-step delete', async () => {
  const store = useAppStore()
  store.openEdit(store.state.timers[0]!.id)
  const count = store.state.timers.length
  const w = mount(EditView)
  expect(w.find('.bar span').text()).toBe('타이머 편집')
  await w.find('.danger').trigger('click')
  expect(w.find('.danger').text()).toBe('한 번 더 누르면 삭제')
  expect(store.state.timers.length).toBe(count)
  await w.find('.danger').trigger('click')
  await vi.waitFor(() => expect(store.state.view).toBe('list'))
  expect(store.state.timers.length).toBe(count - 1)
})

test('delete confirmation resets after 2.5s', async () => {
  vi.useFakeTimers()
  const store = useAppStore()
  store.openEdit(store.state.timers[0]!.id)
  const w = mount(EditView)
  const label = w.find('.danger').text()
  await w.find('.danger').trigger('click')
  expect(w.find('.danger').text()).toBe('한 번 더 누르면 삭제')
  await vi.advanceTimersByTimeAsync(2600)
  expect(w.find('.danger').text()).toBe(label)
})

test('cancel: new goes to list, edit goes to ready', async () => {
  const store = useAppStore()
  store.openEdit(null)
  await mount(EditView).find('[data-cancel]').trigger('click')
  expect(store.state.view).toBe('list')
  const id = store.state.timers[0]!.id
  store.openEdit(id)
  await mount(EditView).find('[data-cancel]').trigger('click')
  expect(store.state.view).toBe('ready')
  expect(store.state.currentId).toBe(id)
})
