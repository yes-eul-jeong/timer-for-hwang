import type { TimerConfig } from './types'

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatSeconds(sec: number): string {
  return sec < 60 ? String(sec) : formatClock(sec)
}

export function summarize(t: TimerConfig): string {
  const base = `운동 ${formatSeconds(t.work)} · 휴식 ${formatSeconds(t.rest)} · ${t.sets}세트`
  return t.rounds > 1 ? `${base} × ${t.rounds}라운드` : base
}

export function defaultName(t: TimerConfig): string {
  return `${formatSeconds(t.work)}/${formatSeconds(t.rest)} 인터벌`
}
