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

<style scoped lang="scss">
.stepper {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: 2cqw;
  padding: 1.6cqh 0;
  border-bottom: 1px solid var(--c-line-2);
}
.lab {
  font-size: 4.4cqw;
  font-weight: 700;
  small {
    display: block;
    font-size: 3cqw;
    color: var(--c-muted);
    font-weight: 500;
  }
}
.val {
  min-width: 14cqw;
  text-align: center;
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 8cqw;
  letter-spacing: var(--tr-tight);
  font-variant-numeric: tabular-nums;
}
button {
  width: 13cqw;
  height: 13cqw;
  background: var(--c-surface-2);
  border: 1px solid var(--c-line-2);
  border-radius: 0;
  font-size: 7cqw;
  font-weight: 700;
  line-height: 1;
  display: grid;
  place-items: center;
  &:active {
    background: var(--c-accent);
    color: var(--c-on-accent);
  }
}
</style>
