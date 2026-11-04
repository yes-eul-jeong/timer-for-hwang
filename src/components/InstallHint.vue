<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../app/store'

const store = useAppStore()

// iPhone, iPad(iPadOS 13+는 Macintosh로 보이지만 터치 지원으로 구분) Safari 브라우저 탭
function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return ios && !otherBrowser
}

const show = computed(
  () =>
    !store.state.installHintSeen &&
    isIosSafari() &&
    (navigator as Navigator & { standalone?: boolean }).standalone !== true,
)
</script>

<template>
  <div v-if="show" class="hint" role="region" aria-label="설치 안내">
    <p class="msg">Safari 공유 버튼 → 홈 화면에 추가를 누르면 앱처럼 쓸 수 있어요</p>
    <button type="button" class="ok" @click="store.dismissInstallHint()">확인</button>
  </div>
</template>

<style scoped lang="scss">
.hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-4) var(--gutter) calc(var(--s-4) + env(safe-area-inset-bottom, 0px));
  background: var(--c-surface-2);
  border-top: 1px solid var(--c-line-2);
  color: var(--c-fg);
}
.msg {
  flex: 1;
  margin: 0;
  font-size: var(--fs-small);
  line-height: 1.5;
}
.ok {
  flex: none;
  min-height: 44px;
  padding: 0 var(--s-5);
  border: 0;
  border-radius: 0;
  background: var(--c-accent);
  color: var(--c-on-accent);
  font-weight: 700;
}
</style>
