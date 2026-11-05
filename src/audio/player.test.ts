import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Cue } from './cues'
import { createAudioPlayer, VOICE_EARLY, BEEP_GAIN, VOICE_PEAK } from './player'

interface Rec { starts: number[][]; stops: number; immediate?: number }
let ctx: FakeCtx
let oscs: (Rec & { type?: string })[]
let sources: (Rec & { buffer?: unknown })[]
interface FakeGain { gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> } }
let gains: FakeGain[]
let t = 1000
const now = () => t
const voiceBuf = { sampleRate: 44100, numberOfChannels: 1, getChannelData: () => new Float32Array([0.5]) }

class FakeCtx {
  static initialState: AudioContextState = 'running'
  currentTime = 10
  sampleRate = 44100
  destination = {}
  state: AudioContextState
  listeners: (() => void)[] = []
  baseLatency?: number
  outputLatency?: number
  getOutputTimestamp?: () => { contextTime: number; performanceTime: number }
  constructor() { ctx = this; this.state = FakeCtx.initialState }
  addEventListener(type: string, fn: () => void) { if (type === 'statechange') this.listeners.push(fn) }
  setState(s: AudioContextState) { this.state = s; for (const l of this.listeners) l() }
  resume = vi.fn(async () => {})
  createBuffer = () => ({})
  decodeAudioData = async () => voiceBuf
  createGain = () => {
    const g = { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: (x: unknown) => x }
    gains.push(g)
    return g
  }
  createOscillator = () => {
    const o = { starts: [] as number[][], stops: 0, immediate: 0, frequency: { value: 0 }, type: '',
      connect: (x: unknown) => x,
      start(...a: number[]) { this.starts.push(a) }, stop(...a: number[]) { this.stops++; if (a.length === 0) this.immediate++ } }
    oscs.push(o)
    return o
  }
  createBufferSource = () => {
    const o = { starts: [] as number[][], stops: 0, buffer: undefined as unknown,
      connect: (x: unknown) => x,
      start(...a: number[]) { this.starts.push(a) }, stop() { this.stops++ } }
    sources.push(o)
    return o
  }
}

const cue = (at: number, kind: Cue['kind'] = 'work'): Cue => ({ at, kind, beepOnly: false })

beforeEach(() => {
  oscs = []; sources = []; gains = []
  t = 1000
  FakeCtx.initialState = 'running'
  vi.stubGlobal('AudioContext', FakeCtx)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })))
})
afterEach(() => vi.unstubAllGlobals())

test('skips past cues', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.schedule([cue(1), cue(5)], 3, 'beep')
  expect(oscs).toHaveLength(1)
  expect(oscs[0]!.starts[0]![0]).toBeCloseTo(ctx.currentTime + 2, 5)
})

test('reschedules only remaining cues after voices load', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => { release = r })
  vi.stubGlobal('fetch', vi.fn(async () => { await gate; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } }))
  const p = createAudioPlayer('/', now)
  const done = p.unlock()
  p.schedule([cue(1), cue(2), cue(3)], 0, 'voice')
  ctx.currentTime += 1.5
  t += 1500
  release()
  await done
  const voiced = sources.filter((s) => s.buffer === voiceBuf)
  expect(voiced).toHaveLength(2)
  expect(voiced[0]!.starts[0]![0]).toBeCloseTo(ctx.currentTime + 0.5 - VOICE_EARLY, 5)
  expect(voiced[1]!.starts[0]![0]).toBeCloseTo(ctx.currentTime + 1.5 - VOICE_EARLY, 5)
})

test('cancel stops all nodes', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.schedule([cue(1), cue(2)], 0, 'beep')
  p.cancel()
  expect(oscs.map((o) => o.immediate)).toEqual([1, 1])
})

test('does not create nodes while suspended', async () => {
  FakeCtx.initialState = 'suspended'
  const p = createAudioPlayer('/', now)
  await p.unlock()
  ctx.currentTime = 0
  p.schedule([cue(1), cue(2)], 0, 'beep')
  expect(oscs).toHaveLength(0)
})

test('schedules on statechange to running without delaying cues', async () => {
  FakeCtx.initialState = 'suspended'
  const p = createAudioPlayer('/', now)
  await p.unlock()
  ctx.currentTime = 0
  p.schedule([cue(1), cue(2)], 0, 'beep')
  t += 300
  ctx.currentTime = 0.05
  ctx.setState('running')
  expect(oscs).toHaveLength(2)
  expect(oscs[0]!.starts[0]![0]).toBeCloseTo(0.05 + 0.7, 5)
  expect(oscs[1]!.starts[0]![0]).toBeCloseTo(0.05 + 1.7, 5)
})

test('cancel prevents replay on statechange', async () => {
  FakeCtx.initialState = 'suspended'
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.schedule([cue(1), cue(2)], 0, 'beep')
  p.cancel()
  ctx.setState('running')
  expect(oscs).toHaveLength(0)
})

test('maps cue time through getOutputTimestamp', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  ctx.getOutputTimestamp = () => ({ contextTime: 9.9, performanceTime: 990 })
  p.schedule([cue(2)], 0, 'beep')
  expect(oscs[0]!.starts[0]![0]).toBeCloseTo(9.9 + (3000 - 990) / 1000, 5)
})

test('falls back to currentTime minus base and output latency', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  ctx.getOutputTimestamp = () => ({ contextTime: 0, performanceTime: 0 })
  ctx.baseLatency = 0.01
  ctx.outputLatency = 0.04
  p.schedule([cue(2)], 0, 'beep')
  expect(oscs[0]!.starts[0]![0]).toBeCloseTo(11.95, 5)
})

test('starts voice VOICE_EARLY before the beat', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.schedule([cue(2)], 0, 'voice')
  const voiced = sources.filter((s) => s.buffer === voiceBuf)
  expect(voiced).toHaveLength(1)
  expect(voiced[0]!.starts[0]![0]).toBeCloseTo(12 - VOICE_EARLY, 5)
  p.schedule([cue(2)], 0, 'beep')
  expect(oscs[0]!.starts[0]![0]).toBeCloseTo(12, 5)
})

test('skips cues already past in audio time and clamps slightly late ones', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  ctx.outputLatency = 0.1
  p.schedule([cue(0.05), cue(0.09), cue(1)], 0, 'beep')
  expect(oscs).toHaveLength(2)
  expect(oscs[0]!.starts[0]![0]).toBeCloseTo(10, 5)
  expect(oscs[1]!.starts[0]![0]).toBeCloseTo(10.9, 5)
})

test('does nothing in off mode', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.schedule([cue(1)], 0, 'off')
  expect(oscs).toHaveLength(0)
  expect(sources.filter((s) => s.buffer === voiceBuf)).toHaveLength(0)
})

const peakOfGain = (g: FakeGain) => g.gain.linearRampToValueAtTime.mock.calls[0]![0] as number
type Osc = Rec & { frequency: { value: number } }

test('beep 기본 음량은 5단계', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.schedule([cue(1)], 0, 'beep')
  expect(gains).toHaveLength(1)
  expect(peakOfGain(gains[0]!)).toBeCloseTo(0.70, 5)
  expect(BEEP_GAIN[4]).toBe(0.70)
})

test('beep 최고점이 단계를 따른다', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.setVolume(1)
  p.schedule([cue(1)], 0, 'beep')
  expect(peakOfGain(gains[0]!)).toBeCloseTo(0.22, 5)
  p.setVolume(3)
  p.schedule([cue(1)], 0, 'beep')
  expect(peakOfGain(gains[1]!)).toBeCloseTo(0.392, 5)
  expect((oscs as Osc[]).map((o) => o.frequency.value)).toEqual([1320, 1320])
})

test('음성은 GainNode로 peak 정규화', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.schedule([cue(2)], 0, 'voice')
  expect(gains).toHaveLength(1)
  expect(gains[0]!.gain.value).toBeCloseTo(0.95 / 0.5, 5)
  p.setVolume(1)
  p.schedule([cue(2)], 0, 'voice')
  expect(gains[1]!.gain.value).toBeCloseTo(0.45 / 0.5, 5)
  expect(VOICE_PEAK[0]).toBe(0.45)
})

test('peak 0인 음성은 gain 1', async () => {
  const silent = { sampleRate: 44100, numberOfChannels: 1, getChannelData: () => new Float32Array([0, 0]) }
  const p = createAudioPlayer('/', now)
  const done = p.unlock()
  ctx.decodeAudioData = async () => silent as unknown as typeof voiceBuf
  await done
  p.schedule([cue(2)], 0, 'voice')
  expect(sources.filter((s) => s.buffer === silent)).toHaveLength(1)
  expect(gains[0]!.gain.value).toBe(1)
})

test('preview: unlock 없이 바로 count3 신호음 한 번', () => {
  const p = createAudioPlayer('/', now)
  p.preview('beep')
  expect(ctx.resume).toHaveBeenCalled()
  expect(oscs).toHaveLength(1)
  expect((oscs[0] as Osc).frequency.value).toBe(880)
  expect(oscs[0]!.starts[0]![0]).toBeCloseTo(ctx.currentTime, 5)
})

test('preview voice: 불러오기 전이면 신호음', () => {
  const p = createAudioPlayer('/', now)
  p.preview('voice')
  expect(oscs).toHaveLength(1)
  expect(sources.filter((s) => s.buffer === voiceBuf)).toHaveLength(0)
})

test('preview voice: 불러온 뒤면 음성', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.preview('voice')
  expect(oscs).toHaveLength(0)
  expect(sources.filter((s) => s.buffer === voiceBuf)).toHaveLength(1)
})

test('preview off는 아무것도 안 낸다', () => {
  const p = createAudioPlayer('/', now)
  p.preview('off')
  expect(oscs).toHaveLength(0)
  expect(sources.filter((s) => s.buffer === voiceBuf)).toHaveLength(0)
})

test('preview: suspended면 resume 뒤에 낸다', async () => {
  FakeCtx.initialState = 'suspended'
  const p = createAudioPlayer('/', now)
  p.preview('beep')
  expect(oscs).toHaveLength(0)
  ctx.state = 'running'
  await Promise.resolve()
  await Promise.resolve()
  expect(oscs).toHaveLength(1)
})

test('preview 노드는 schedule이 끄지 않는다', async () => {
  const p = createAudioPlayer('/', now)
  await p.unlock()
  p.preview('beep')
  p.schedule([cue(1)], 0, 'beep')
  expect(oscs[0]!.immediate).toBe(0)
})
