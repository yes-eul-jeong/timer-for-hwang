<script setup lang="ts">
// 프로젝트 세팅 확인용 화면. 실제 화면은 구현 계획에 따라 교체한다.
</script>

<template>
  <main class="boot">
    <span class="boot__label">TTAENG · INTERVAL TIMER</span>
    <h1 class="boot__title">땡</h1>
    <p class="boot__note">프로젝트 세팅 완료</p>
  </main>
</template>

<style scoped lang="scss">
.boot {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--s-3);
  padding: var(--s-6) var(--gutter);
}
.boot__label {
  font-family: var(--font-sans);
  font-size: var(--fs-label);
  font-weight: 700;
  letter-spacing: var(--tr-widest);
  color: var(--c-accent);
}
.boot__title {
  margin: 0;
  font-size: 40vw;
  font-weight: 900;
  line-height: 1;
  letter-spacing: var(--tr-tight);
}
.boot__note {
  margin: 0;
  color: var(--c-muted);
}
</style>
