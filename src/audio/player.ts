import type { SoundMode } from '../core/types'
import type { Cue, CueKind } from './cues'
import { leadingSilence } from './trim'

export interface AudioPlayer {
  unlock(): Promise<void>
  schedule(cues: Cue[], elapsedNow: number, mode: SoundMode): void
  cancel(): void
}

const KINDS: CueKind[] = ['count3', 'count2', 'count1', 'work', 'rest', 'end']
const LEAD = 0.03
const MAX_GAIN = 0.22

interface Voice {
  buffer: AudioBuffer
  skip: number
}

type Stoppable = { stop(when?: number): void }

export function createAudioPlayer(baseUrl: string): AudioPlayer {
  let ctx: AudioContext | null = null
  const voices = new Map<CueKind, Voice>()
  let nodes: Stoppable[] = []
  let last: { cues: Cue[]; elapsedNow: number; mode: SoundMode; ctxTime: number } | null = null

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

  function cancel() {
    for (const n of nodes) {
      try {
        n.stop()
      } catch {
        /* 이미 끝났거나 시작 전인 노드 */
      }
    }
    nodes = []
    last = null
  }

  function schedule(cues: Cue[], elapsedNow: number, mode: SoundMode) {
    const c = ctx
    // 기존 예약 취소(기억한 schedule은 새 값으로 덮어쓴다)
    for (const n of nodes) {
      try {
        n.stop()
      } catch {
        /* ignore */
      }
    }
    nodes = []
    if (!c) return
    last = { cues, elapsedNow, mode, ctxTime: c.currentTime }
    if (mode === 'off') return
    for (const cue of cues) {
      if (cue.at <= elapsedNow) continue // 이미 지난 cue는 즉시 재생되므로 건너뛴다
      const when = c.currentTime + LEAD + (cue.at - elapsedNow)
      const v = mode === 'voice' && !cue.beepOnly ? voices.get(cue.kind) : undefined
      if (v) {
        const src = c.createBufferSource()
        src.buffer = v.buffer
        src.connect(c.destination)
        src.start(when, v.skip)
        nodes.push(src)
      } else {
        beep(c, cue.kind, when)
      }
    }
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
    if (ctx === c && last && last.mode === 'voice' && voices.size > 0) {
      const { cues, elapsedNow, ctxTime } = last
      schedule(cues, elapsedNow + (c.currentTime - ctxTime), 'voice')
    }
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
        void c.resume()
        const silent = c.createBuffer(1, Math.max(1, Math.ceil(c.sampleRate * 0.001)), c.sampleRate)
        const s = c.createBufferSource()
        s.buffer = silent
        s.connect(c.destination)
        s.start()
        if (voices.size === 0) await loadVoices(c)
      } else {
        void ctx.resume()
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
