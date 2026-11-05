<script setup lang="ts">
defineProps<{ label: string; sub?: string; value: string }>()
defineEmits<{ dec: []; inc: [] }>()
</script>

<template>
  <div class="stepper">
    <div class="lab">
      {{ label }}<small v-if="sub">{{ sub }}</small>
    </div>
    <button type="button" :aria-label="`${label} 줄이기`" @click="$emit('dec')">−</button>
    <div class="val">{{ value }}</div>
    <button type="button" :aria-label="`${label} 늘리기`" @click="$emit('inc')">+</button>
  </div>
</template>

<style scoped lang="scss" src="./Stepper.scss"></style>
