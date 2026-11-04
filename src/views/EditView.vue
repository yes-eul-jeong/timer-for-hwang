<script setup lang="ts">
import { reactive, ref, computed, onUnmounted } from 'vue'
import { useAppStore } from '../app/store'
import { TIMER_FIELDS, stepValue } from '../core/limits'
import { formatSeconds, defaultName } from '../core/format'
import type { TimerConfig } from '../core/types'
import Stepper from '../components/Stepper.vue'

const store = useAppStore()
const editingId = store.state.editingId
const existing = editingId ? store.state.timers.find((x) => x.id === editingId) : undefined

const draft = reactive<TimerConfig>(
  existing
    ? {
        name: existing.name,
        prepare: existing.prepare,
        work: existing.work,
        rest: existing.rest,
        sets: existing.sets,
        rounds: existing.rounds,
        roundRest: existing.roundRest,
      }
    : { name: '', prepare: 10, work: 20, rest: 10, sets: 8, rounds: 1, roundRest: 0 },
)
const isEdit = computed(() => !!existing)

const confirming = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => clearTimeout(timer))

function cancel() {
  if (editingId) store.openReady(editingId)
  else store.go('list')
}
function save() {
  const name = draft.name.trim() || defaultName(draft)
  void store.saveTimer({ ...draft, name })
}
function remove() {
  if (!existing) return
  if (!confirming.value) {
    confirming.value = true
    timer = setTimeout(() => (confirming.value = false), 2500)
    return
  }
  clearTimeout(timer)
  void store.deleteTimer(existing.id)
}
</script>

<template>
  <section class="view" data-view="edit">
    <div class="bar">
      <button type="button" data-cancel @click="cancel">취소</button>
      <span>{{ isEdit ? '타이머 편집' : '새 타이머' }}</span>
      <button type="button" class="go" @click="save">저장</button>
    </div>
    <div class="scroll">
      <label class="field">
        <span class="label-en">NAME</span>
        <input v-model="draft.name" type="text" maxlength="20" placeholder="타이머 이름" />
      </label>
      <div class="steppers">
        <Stepper
          v-for="f in TIMER_FIELDS"
          :key="f.key"
          :label="f.label"
          :sub="f.sub"
          :value="f.time ? formatSeconds(draft[f.key]) : String(draft[f.key])"
          @dec="draft[f.key] = stepValue(f.key, draft[f.key], -1)"
          @inc="draft[f.key] = stepValue(f.key, draft[f.key], 1)"
        />
      </div>
      <button v-if="isEdit" class="danger" type="button" @click="remove">
        {{ confirming ? '한 번 더 누르면 삭제' : '이 타이머 삭제' }}
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}
.bar {
  padding: calc(3.5cqh + env(safe-area-inset-top, 0px)) 3cqw 1cqh;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2cqw;
  button {
    background: none;
    border: 0;
    border-radius: 0;
    font-size: 4.2cqw;
    font-weight: 700;
    padding: 2cqw 2.5cqw;
    color: var(--c-muted);
    &.go {
      color: var(--c-accent);
    }
  }
  span {
    font-weight: 700;
    font-size: 4.4cqw;
  }
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 5cqw calc(4cqh + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 2cqw;
}
.label-en {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 2.8cqw;
  letter-spacing: var(--tr-widest);
  color: var(--c-muted);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 1cqh;
  padding-bottom: 2cqh;
  input {
    font: inherit;
    font-size: 5.4cqw;
    font-weight: 700;
    color: var(--c-fg);
    background: var(--c-surface);
    border: 1px solid var(--c-line-2);
    border-radius: 0;
    padding: 3cqw;
    width: 100%;
    box-sizing: border-box;
  }
}
.steppers {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--c-line-2);
}
.danger {
  margin-top: 3cqh;
  min-height: 10cqh;
  background: none;
  border: 1px solid var(--c-line-2);
  border-radius: 0;
  color: var(--c-muted);
  font-size: 4.4cqw;
  font-weight: 700;
}
</style>
