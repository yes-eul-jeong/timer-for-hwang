import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Cue } from './cues'
import { createAudioPlayer } from './player'

interface Rec { starts: number[][]; stops: number; immediate?: number }
let ctx: FakeCtx
let oscs: (Rec & { type?: string })[]
let sources: (Rec & { buffer?: unknown })[]
const voiceBuf = { sampleRate: 44100, getChannelData: () => new Float32Array([0.5]) }

class FakeCtx {
  currentTime = 10
  sampleRate = 44100
  destination = {}
  constructor() { ctx = this }
  resume = vi.fn(async () => {})
  createBuffer = () => ({})
  decodeAudioData = async () => voiceBuf
  createGain = () => {
    const p = { setValueAtTime() {}, linearRampToValueAtTime() {} }
    const g = { gain: p, connect: (x: unknown) => x }
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
  oscs = []; sources = []
  vi.stubGlobal('AudioContext', FakeCtx)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })))
})
afterEach(() => vi.unstubAllGlobals())

test('skips past cues', async () => {
  const p = createAudioPlayer('/')
  await p.unlock()
  p.schedule([cue(1), cue(5)], 3, 'beep')
  expect(oscs).toHaveLength(1)
  expect(oscs[0]!.starts[0]![0]).toBeCloseTo(ctx.currentTime + 0.03 + 2, 5)
})

test('reschedules only remaining cues after voices load', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => { release = r })
  vi.stubGlobal('fetch', vi.fn(async () => { await gate; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } }))
  const p = createAudioPlayer('/')
  const done = p.unlock()
  p.schedule([cue(1), cue(2), cue(3)], 0, 'voice')
  ctx.currentTime += 1.5
  release()
  await done
  const voiced = sources.filter((s) => s.buffer === voiceBuf)
  expect(voiced).toHaveLength(2)
  expect(voiced[0]!.starts[0]![0]).toBeCloseTo(ctx.currentTime + 0.03 + 0.5, 5)
  expect(voiced[1]!.starts[0]![0]).toBeCloseTo(ctx.currentTime + 0.03 + 1.5, 5)
})

test('cancel stops all nodes', async () => {
  const p = createAudioPlayer('/')
  await p.unlock()
  p.schedule([cue(1), cue(2)], 0, 'beep')
  p.cancel()
  expect(oscs.map((o) => o.immediate)).toEqual([1, 1])
})
