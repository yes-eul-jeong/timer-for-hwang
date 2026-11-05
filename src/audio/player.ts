import type { SoundMode, Volume } from '../core/types'
import type { Cue, CueKind } from './cues'
import { leadingSilence, peakOf } from './trim'

export interface AudioPlayer {
  unlock(): Promise<void>
  schedule(cues: Cue[], elapsedNow: number, mode: SoundMode): void
  cancel(): void
  setVolume(level: Volume): void
  /** 사용자 제스처 안에서 부른다. count3을 지금 한 번 낸다. 음성이 아직 없으면 신호음. */
  preview(mode: SoundMode): void
}

const KINDS: CueKind[] = ['count3', 'count2', 'count1', 'work', 'rest', 'end']
/** 음성은 모음이 박자로 들리므로 이만큼 먼저 시작한다(초). */
export const VOICE_EARLY = 0.05
/** 이만큼까지 늦은 cue는 지금 재생하고, 더 늦으면 건너뛴다(초). */
const LATE_OK = 0.02
/** 신호음 단계별 최고 음량 */
export const BEEP_GAIN = [0.22, 0.294, 0.392, 0.524, 0.7] as const
/** 음성 단계별 목표 peak */
export const VOICE_PEAK = [0.45, 0.542, 0.654, 0.788, 0.95] as const

interface Voice {
  buffer: AudioBuffer
  skip: number
  peak: number
}

type Stoppable = { stop(when?: number): void }

export function createAudioPlayer(baseUrl: string, now: () => number = () => performance.now()): AudioPlayer {
  let ctx: AudioContext | null = null
  const voices = new Map<CueKind, Voice>()
  let nodes: Stoppable[] = []
  let last: { cues: Cue[]; elapsedNow: number; mode: SoundMode; perfAt: number } | null = null
  let level: Volume = 5
  let previewNode: Stoppable | null = null

  function beep(c: AudioContext, kind: CueKind, when: number): Stoppable {
    const peak = BEEP_GAIN[level - 1]!
    const freq = kind.startsWith('count') ? 880 : 1320
    const dur = kind.startsWith('count') ? 0.12 : kind === 'end' ? 0.9 : 0.45
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    const ramp = Math.min(0.01, dur / 4)
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(peak, when + ramp)
    gain.gain.setValueAtTime(peak, when + dur - ramp)
    gain.gain.linearRampToValueAtTime(0, when + dur)
    osc.connect(gain).connect(c.destination)
    osc.start(when)
    osc.stop(when + dur)
    return osc
  }

  function voice(c: AudioContext, v: Voice, when: number): Stoppable {
    const src = c.createBufferSource()
    const gain = c.createGain()
    gain.gain.value = v.peak > 0 ? VOICE_PEAK[level - 1]! / v.peak : 1
    src.buffer = v.buffer
    src.connect(gain).connect(c.destination)
    src.start(when, v.skip)
    return src
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
      nodes.push(
        v
          ? voice(c, v, Math.max(c.currentTime, when - VOICE_EARLY))
          : beep(c, cue.kind, Math.max(c.currentTime, when)),
      )
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
          const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
          voices.set(kind, {
            buffer,
            skip: leadingSilence(buffer.getChannelData(0), buffer.sampleRate),
            peak: peakOf(channels),
          })
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

  function setVolume(l: Volume) {
    level = l
  }

  function preview(mode: SoundMode) {
    if (mode === 'off') return
    // unlock은 첫 await 전까지 동기로 돈다. ctx 생성·resume이 제스처 안에서 끝난다.
    void unlock()
    const c = ctx
    if (!c) return
    const fire = () => {
      if (ctx !== c || c.state !== 'running') return
      if (previewNode) {
        try {
          previewNode.stop()
        } catch {
          /* 이미 끝난 노드 */
        }
      }
      const v = mode === 'voice' ? voices.get('count3') : undefined
      previewNode = v ? voice(c, v, c.currentTime) : beep(c, 'count3', c.currentTime)
    }
    if (c.state === 'running') fire()
    else c.resume().then(fire, () => {})
  }

  return { unlock, schedule, cancel, setVolume, preview }
}

let singleton: AudioPlayer | null = null
export function getAudioPlayer(): AudioPlayer {
  return (singleton ??= createAudioPlayer(import.meta.env.BASE_URL))
}
