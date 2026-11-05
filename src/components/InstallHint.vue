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

<style scoped lang="scss" src="./InstallHint.scss"></style>
