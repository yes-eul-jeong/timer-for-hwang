import type { SoundMode } from '../core/types'
import type { Cue, CueKind } from './cues'
import { leadingSilence } from './trim'

export interface AudioPlayer {
  unlock(): Promise<void>
  schedule(cues: Cue[], elapsedNow: number, mode: SoundMode): void
  cancel(): void
}

const KINDS: CueKind[] = ['count3', 'count2', 'count1', 'work', 'rest', 'end']
/** 음성은 모음이 박자로 들리므로 이만큼 먼저 시작한다(초). */
export const VOICE_EARLY = 0.05
/** 이만큼까지 늦은 cue는 지금 재생하고, 더 늦으면 건너뛴다(초). */
const LATE_OK = 0.02
const MAX_GAIN = 0.22

interface Voice {
  buffer: AudioBuffer
  skip: number
}

type Stoppable = { stop(when?: number): void }

export function createAudioPlayer(baseUrl: string, now: () => number = () => performance.now()): AudioPlayer {
  let ctx: AudioContext | null = null
  const voices = new Map<CueKind, Voice>()
  let nodes: Stoppable[] = []
  let last: { cues: Cue[]; elapsedNow: number; mode: SoundMode; perfAt: number } | null = null

  function beep(c: AudioContext, kind: CueKind, when: number) {
    const freq = kind.startsWith('count') ? 880 : 1320
    const dur = kind.startsWith('count') ? 0.12 : kind === 'end' ? 0.9 : 0.45
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    const ramp = Math.min(0.01, dur / 4)
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(MAX_GAIN, when + ramp)
    gain.gain.setValueAtTime(MAX_GAIN, when + dur - ramp)
    gain.gain.linearRampToValueAtTime(0, when + dur)
    osc.connect(gain).connect(c.destination)
    osc.start(when)
    osc.stop(when + dur)
    nodes.push(osc)
  }

  function stopNodes() {
    for (const n of nodes) {
      try {
        n.stop()
      } catch {
        /* 이미 끝났거나 시작 전인 노드 */
      }
    }
    nodes = []
  }

  function cancel() {
    stopNodes()
    last = null
  }

  /** performance 시각 p에 소리가 들리려면 넣어야 할 ctx 시각 */
  function audioTimeAt(c: AudioContext, p: number): number {
    const ts = typeof c.getOutputTimestamp === 'function' ? c.getOutputTimestamp() : undefined
    if (ts && ts.performanceTime && ts.performanceTime > 0 && ts.contextTime !== undefined)
      return ts.contextTime + (p - ts.performanceTime) / 1000
    return c.currentTime + (p - now()) / 1000 - ((c.baseLatency ?? 0) + (c.outputLatency ?? 0))
  }

  function play(c: AudioContext) {
    stopNodes()
    if (!last || last.mode === 'off' || c.state !== 'running') return
    const t = now()
    const elapsed = last.elapsedNow + (t - last.perfAt) / 1000
    for (const cue of last.cues) {
      if (cue.at <= elapsed) continue
      const when = audioTimeAt(c, t + (cue.at - elapsed) * 1000)
      if (when < c.currentTime - LATE_OK) continue // 늦게 울리느니 건너뛴다
      const v = last.mode === 'voice' && !cue.beepOnly ? voices.get(cue.kind) : undefined
      if (v) {
        const src = c.createBufferSource()
        src.buffer = v.buffer
        src.connect(c.destination)
        src.start(Math.max(c.currentTime, when - VOICE_EARLY), v.skip)
        nodes.push(src)
      } else {
        beep(c, cue.kind, Math.max(c.currentTime, when))
      }
    }
  }

  function schedule(cues: Cue[], elapsedNow: number, mode: SoundMode) {
    stopNodes()
    last = { cues, elapsedNow, mode, perfAt: now() }
    if (ctx) play(ctx)
  }

  async function loadVoices(c: AudioContext) {
    await Promise.all(
      KINDS.map(async (kind) => {
        try {
          const res = await fetch(`${baseUrl}voice/${kind}.m4a`)
          if (!res.ok) return
          const buffer = await c.decodeAudioData(await res.arrayBuffer())
          voices.set(kind, { buffer, skip: leadingSilence(buffer.getChannelData(0), buffer.sampleRate) })
        } catch {
          /* 실패한 cue는 신호음으로 대체 */
        }
      }),
    )
    if (ctx === c && last?.mode === 'voice' && voices.size > 0) play(c)
  }

  function resumeAndPlay(c: AudioContext) {
    c.resume().then(
      () => {
        if (ctx === c && c.state === 'running') play(c)
      },
      () => {},
    )
  }

  async function unlock() {
    try {
      // iOS: 사용자 제스처 안에서 동기로 생성·resume 해야 한다. await는 그 뒤에.
      if (!ctx) {
        const Ctor =
          typeof AudioContext !== 'undefined'
            ? AudioContext
            : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        ctx = new Ctor()
        if (typeof navigator !== 'undefined' && navigator.audioSession) {
          navigator.audioSession.type = 'playback'
        }
        const c = ctx
        c.addEventListener('statechange', () => {
          if (ctx === c && c.state === 'running') play(c)
        })
        resumeAndPlay(c)
        const silent = c.createBuffer(1, Math.max(1, Math.ceil(c.sampleRate * 0.001)), c.sampleRate)
        const s = c.createBufferSource()
        s.buffer = silent
        s.connect(c.destination)
        s.start()
        if (voices.size === 0) await loadVoices(c)
      } else {
        resumeAndPlay(ctx)
        if (voices.size === 0) await loadVoices(ctx)
      }
    } catch {
      /* unlock은 reject하지 않는다 */
    }
  }

  return { unlock, schedule, cancel }
}

let singleton: AudioPlayer | null = null
export function getAudioPlayer(): AudioPlayer {
  return (singleton ??= createAudioPlayer(import.meta.env.BASE_URL))
}
