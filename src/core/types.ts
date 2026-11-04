export type Phase = 'prepare' | 'work' | 'rest'

export interface Timer {
  id: string
  name: string
  prepare: number
  work: number
  rest: number
  sets: number
  rounds: number
  roundRest: number
  createdAt: string
}

export type TimerConfig = Omit<Timer, 'id' | 'createdAt'>

/** set/round = 이 단계 기준 "다음(또는 현재) 운동 세트" */
export interface Step {
  phase: Phase
  duration: number
  start: number
  roundRest: boolean
  set: number
  round: number
}

export interface Sequence {
  steps: Step[]
  total: number
}

export type SoundMode = 'beep' | 'voice' | 'off'

export interface Settings {
  sound: SoundMode
  flash: boolean
}

export const DEFAULT_SETTINGS: Settings = { sound: 'beep', flash: true }

export interface RunState {
  phase: Phase | 'done'
  index: number
  step: Step | null
  next: Step | null
  /** 현재 단계 남은 초, Math.ceil */
  remaining: number
  /** Math.ceil */
  totalRemaining: number
  /** 지금(또는 다음) 세트 포함 */
  setsLeft: number
  roundsLeft: number
}
