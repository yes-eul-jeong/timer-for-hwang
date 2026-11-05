<script setup lang="ts">
import { reactive, ref, computed, onUnmounted } from 'vue'
import { useAppStore } from '../app/store'
import { TIMER_FIELDS, stepValue } from '../core/limits'
import { formatSeconds, defaultName } from '../core/format'
import { toConfig, type TimerConfig } from '../core/types'
import Stepper from '../components/Stepper.vue'

const store = useAppStore()
const editingId = store.state.editingId
const existing = editingId ? store.state.timers.find((x) => x.id === editingId) : undefined

const draft = reactive<TimerConfig>(
  existing
    ? toConfig(existing)
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

<style scoped lang="scss" src="./EditView.scss"></style>
