/** 앞쪽 무음 길이(초). 전부 무음이면 0. */
export function leadingSilence(samples: Float32Array, sampleRate: number, threshold = 0.01): number {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]!) >= threshold) return i / sampleRate
  }
  return 0
}
