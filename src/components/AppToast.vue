<script setup lang="ts">
import { useAppStore } from '../app/store'
const store = useAppStore()
</script>

<template>
  <div class="toast" :class="{ on: store.state.toast }" role="status" aria-live="polite">{{ store.state.toast }}</div>
</template>

<style scoped lang="scss" src="./AppToast.scss"></style>
