import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryRepo } from '../storage/db'
import { createPrefs } from '../storage/prefs'
import { useAppStore, resetAppStore } from '../app/store'
import InstallHint from './InstallHint.vue'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

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

function setEnv(ua: string, standalone?: boolean) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true })
}

async function initStore() {
  const store = useAppStore()
  await store.init({ repo: createMemoryRepo(), prefs: createPrefs(memStorage()) })
  return store
}

beforeEach(() => resetAppStore())
afterEach(() => setEnv('', undefined))

describe('InstallHint', () => {
  test('iPhone Safari 브라우저 탭에서 안내를 보여준다', async () => {
    setEnv(IPHONE, false)
    await initStore()
    const w = mount(InstallHint)
    expect(w.text()).toContain('홈 화면에 추가')
  })

  test('확인을 누르면 플래그가 저장되고 다시 보이지 않는다', async () => {
    setEnv(IPHONE, false)
    const store = await initStore()
    const w = mount(InstallHint)
    await w.get('button').trigger('click')
    expect(store.state.installHintSeen).toBe(true)
    expect(w.text()).not.toContain('홈 화면에 추가')
  })

  test('이미 확인했으면 init 후 보이지 않는다', async () => {
    setEnv(IPHONE, false)
    const prefs = createPrefs(memStorage())
    prefs.setFlag('installHintSeen', true)
    const store = useAppStore()
    await store.init({ repo: createMemoryRepo(), prefs })
    expect(store.state.installHintSeen).toBe(true)
    expect(mount(InstallHint).text()).toBe('')
  })

  test('standalone이면 보이지 않는다', async () => {
    setEnv(IPHONE, true)
    await initStore()
    expect(mount(InstallHint).text()).toBe('')
  })

  test('Android면 보이지 않는다', async () => {
    setEnv(ANDROID, undefined)
    await initStore()
    expect(mount(InstallHint).text()).toBe('')
  })
})
