<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '../app/store'
import type { Settings } from '../core/types'
import { createBackup, parseBackup, type BackupFile } from '../storage/backup'
import { exportBackupFile, pickBackupFile } from '../storage/share'

const store = useAppStore()
const appVersion = __APP_VERSION__
const pending = ref<BackupFile | null>(null)

const sounds: { value: Settings['sound']; label: string }[] = [
  { value: 'beep', label: '삐-삐-삐' },
  { value: 'voice', label: '한국어 음성' },
  { value: 'off', label: '끔' },
]

const lastBackupText = computed(() => {
  const iso = store.state.lastBackupAt
  if (!iso) return '마지막 백업: 없음'
  const d = new Date(iso)
  return `마지막 백업: ${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
})

const stale = computed(() => {
  const iso = store.state.lastBackupAt
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() > 30 * 86_400_000
})

async function doExport(): Promise<void> {
  const now = new Date()
  const { filename, json } = createBackup(store.state.timers, store.state.settings, now)
  const result = await exportBackupFile(filename, json)
  if (result === 'cancelled') return
  store.markBackedUp(now)
  store.showToast('백업 파일을 만들었어요')
}

async function doPick(): Promise<void> {
  const text = await pickBackupFile()
  if (text === null) return
  const r = parseBackup(text)
  if (!r.ok) {
    store.showToast(r.error)
    return
  }
  pending.value = r.data
}

async function doImport(mode: 'replace' | 'merge'): Promise<void> {
  const data = pending.value
  if (!data) return
  pending.value = null
  await store.importBackup(data, mode)
  store.showToast('불러왔어요')
}
</script>

<template>
  <section class="view" data-view="settings">
    <div class="vhead"><span class="label-en">SETTINGS</span><h2>설정</h2></div>
    <div class="scroll">
      <div v-if="store.state.volatile" class="group warn" role="alert">
        <p>이 브라우저에서는 데이터가 저장되지 않아요. 홈 화면에 추가해서 쓰세요</p>
      </div>
      <div class="group">
        <h4>카운트다운 소리</h4>
        <div class="seg">
          <button
            v-for="s in sounds"
            :key="s.value"
            type="button"
            :aria-pressed="store.state.settings.sound === s.value"
            @click="store.updateSettings({ sound: s.value })"
          >
            {{ s.label }}
          </button>
        </div>
        <p>한국어 음성은 "삼, 이, 일, 시작"을 녹음 파일로 재생합니다. 3초 이하 단계는 삐 소리로 나와요.</p>
      </div>
      <div class="group">
        <div class="row2">
          <h4>단계 바뀔 때 화면 번쩍임</h4>
          <button
            class="toggle"
            type="button"
            aria-label="화면 번쩍임"
            :aria-pressed="store.state.settings.flash"
            @click="store.updateSettings({ flash: !store.state.settings.flash })"
          ></button>
        </div>
      </div>
      <div class="group">
        <h4>백업</h4>
        <p>타이머 목록을 파일로 저장하거나 불러옵니다.</p>
        <p>{{ lastBackupText }}</p>
        <p v-if="stale" class="nudge">백업한 지 30일이 지났어요</p>
        <template v-if="pending">
          <p>백업 파일에 타이머 {{ pending.timers.length }}개가 있어요. 어떻게 불러올까요?</p>
          <div class="choice">
            <button class="btn-wide" type="button" @click="doImport('replace')">덮어쓰기</button>
            <button class="btn-wide" type="button" @click="doImport('merge')">합치기</button>
            <button class="btn-wide" type="button" @click="pending = null">취소</button>
          </div>
        </template>
        <template v-else>
          <button class="btn-wide" type="button" @click="doExport">백업 내보내기</button>
          <button class="btn-wide" type="button" @click="doPick">백업 불러오기</button>
        </template>
      </div>
      <div class="group"><p>땡 v{{ appVersion }} · 데이터는 이 휴대폰에만 저장됩니다.</p></div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.view {
  position: absolute;
  inset: 0 0 calc(10cqh + env(safe-area-inset-bottom, 0px)) 0;
  display: flex;
  flex-direction: column;
}
.vhead {
  padding: calc(4.5cqh + env(safe-area-inset-top, 0px)) 5cqw 3cqh;
  display: flex;
  flex-direction: column;
  gap: 1cqh;
  h2 {
    margin: 0;
    font-size: 10cqw;
    font-weight: 900;
    letter-spacing: -.04em;
    line-height: 1;
  }
}
.label-en {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 2.8cqw;
  letter-spacing: var(--tr-widest);
  color: var(--c-accent);
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 5cqw 4cqh;
  display: flex;
  flex-direction: column;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 1.4cqh;
  padding: 2.4cqh 0;
  border-bottom: 1px solid var(--c-line-2);
  h4 {
    margin: 0;
    font-size: 4.6cqw;
    font-weight: 800;
  }
  p {
    margin: 0;
    font-size: 3.4cqw;
    color: var(--c-muted);
  }
}
.warn p,
.nudge {
  color: var(--c-accent);
  font-weight: 700;
}
.seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid var(--c-line-2);
  border-radius: 0;
  button {
    background: var(--c-surface);
    border: 0;
    border-right: 1px solid var(--c-line-2);
    border-radius: 0;
    min-height: 10cqw;
    font-size: 3.8cqw;
    font-weight: 700;
    color: var(--c-muted);
    &:last-child {
      border-right: 0;
    }
    &[aria-pressed='true'] {
      background: var(--c-accent);
      color: var(--c-on-accent);
    }
  }
}
.row2 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 3cqw;
}
.toggle {
  width: 16cqw;
  height: 8.5cqw;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line-2);
  border-radius: 0;
  position: relative;
  flex: none;
  &::after {
    content: '';
    position: absolute;
    top: .9cqw;
    left: .9cqw;
    width: 6cqw;
    height: 6cqw;
    background: var(--c-muted);
    transition: transform var(--d-base) var(--e-out);
  }
  &[aria-pressed='true'] {
    background: var(--c-accent);
    border-color: var(--c-accent);
    &::after {
      transform: translateX(7.4cqw);
      background: var(--c-on-accent);
    }
  }
}
.choice {
  display: flex;
  flex-direction: column;
  gap: 1.4cqh;
}
.btn-wide {
  min-height: 11cqw;
  background: var(--c-surface);
  border: 1px solid var(--c-line-2);
  border-radius: 0;
  font-size: 4cqw;
  font-weight: 700;
}
</style>
