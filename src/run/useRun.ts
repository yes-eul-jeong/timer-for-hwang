import { onScopeDispose, ref, shallowRef, type Ref } from 'vue'
import { buildSequence } from '../core/sequence'
import { createRunClock, stateAt } from '../core/clock'
import type { RunState, Settings, TimerConfig } from '../core/types'
import { cuesFrom } from '../audio/cues'
import { getAudioPlayer, type AudioPlayer } from '../audio/player'

type WakeLockHandle = { release(): Promise<void> }

export interface RunDeps {
  now: () => number
  raf: (cb: () => void) => number
  caf: (id: number) => void
  audio: AudioPlayer
  wakeLock: () => Promise<WakeLockHandle | null>
  doc: Document
}

export interface Run {
  state: Readonly<Ref<RunState>>
  paused: Readonly<Ref<boolean>>
  flashKey: Readonly<Ref<number>>
  toggle(): void
  skip(): void
  restart(): void
  stop(): void
}

async function requestScreenLock(): Promise<WakeLockHandle | null> {
  try {
    return (await navigator.wakeLock?.request('screen')) ?? null
  } catch {
    return null
  }
}

function resolveDeps(deps: Partial<RunDeps>): RunDeps {
  return {
    now: deps.now ?? (() => performance.now()),
    raf: deps.raf ?? ((cb) => requestAnimationFrame(() => cb())),
    caf: deps.caf ?? ((id) => cancelAnimationFrame(id)),
    audio: deps.audio ?? getAudioPlayer(),
    wakeLock: deps.wakeLock ?? requestScreenLock,
    doc: deps.doc ?? document,
  }
}

export function useRun(config: TimerConfig, settings: Settings, deps: Partial<RunDeps> = {}): Run {
  const d = resolveDeps(deps)
  const seq = buildSequence(config)
  const clock = createRunClock(d.now)
  const calc = () => stateAt(seq, config.sets, config.rounds, clock.elapsed())

  const state = shallowRef<RunState>(calc())
  const paused = ref(false)
  const flashKey = ref(0)
  let frame: number | null = null
  let lock: WakeLockHandle | null = null
  let stopped = false

  function update() {
    const next = calc()
    if (next.index !== state.value.index && settings.flash) flashKey.value++
    state.value = next
    if (next.phase === 'done') stopLoop()
  }

  function loop() {
    frame = null
    update()
    if (!stopped && !paused.value && state.value.phase !== 'done') frame = d.raf(loop)
  }

  function startLoop() {
    if (frame === null && !stopped && state.value.phase !== 'done') frame = d.raf(loop)
  }

  function stopLoop() {
    if (frame !== null) d.caf(frame)
    frame = null
  }

  /** 지금 경과 기준으로 남은 소리만 다시 예약한다. 0초에서는 0초 cue도 포함한다. */
  function scheduleNow() {
    const e = clock.elapsed()
    d.audio.schedule(cuesFrom(seq, e === 0 ? -1e-6 : e), e, settings.sound)
  }

  function releaseLock() {
    const old = lock
    lock = null
    if (old) old.release().catch(() => {})
  }

  async function acquireLock() {
    const handle = await d.wakeLock().catch(() => null)
    if (stopped) {
      if (handle) handle.release().catch(() => {})
      return
    }
    releaseLock()
    lock = handle
  }

  /** iOS는 화면 잠금·백그라운드 후 AudioContext를 멈춘다. 예약 전에 깨운다(reject하지 않음). */
  function wakeAudio() {
    void d.audio.unlock()
  }

  function resume() {
    wakeAudio()
    clock.resume()
    paused.value = false
    update()
    scheduleNow()
    startLoop()
  }

  function toggle() {
    if (stopped || state.value.phase === 'done') return
    if (paused.value) {
      resume()
    } else {
      clock.pause()
      paused.value = true
      d.audio.cancel()
      stopLoop()
      update()
    }
  }

  function skip() {
    if (stopped || state.value.phase === 'done') return
    clock.skip(seq)
    resume()
  }

  function restart() {
    if (stopped) return
    clock.restart()
    resume()
  }

  function onVisibility() {
    if (stopped || paused.value || state.value.phase === 'done') return
    if (d.doc.visibilityState !== 'visible') return
    update()
    wakeAudio()
    scheduleNow()
    startLoop()
    releaseLock()
    void acquireLock()
  }

  function stop() {
    if (stopped) return
    stopped = true
    stopLoop()
    d.audio.cancel()
    releaseLock()
    d.doc.removeEventListener('visibilitychange', onVisibility)
  }

  d.doc.addEventListener('visibilitychange', onVisibility)
  d.audio.setVolume(settings.volume)
  d.audio.schedule(cuesFrom(seq, -1e-6), 0, settings.sound)
  void acquireLock()
  startLoop()
  onScopeDispose(stop)

  return {
    state,
    paused,
    flashKey,
    toggle,
    skip,
    restart,
    stop,
  }
}
