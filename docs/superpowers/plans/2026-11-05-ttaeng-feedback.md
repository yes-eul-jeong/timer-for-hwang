# 땡: 피드백 반영 계획 (소리 크기 · 멈춤 버튼 · 운동 화면 배치)

피드백 세 가지(볼륨 키우기, 멈춤 버튼 빼기, 숫자 키우기)를 사용자와 하나씩 확정했다. 확정 시안: https://claude.ai/artifact/UfLJwuoHE49kDpmERxv5si (숫자 +25%, 멈춤 버튼 채움). 시안 원본 CSS: 세션 scratchpad `fb-src.html` — 이 문서의 값이 최종이다.

`$DC` = `docker compose -f docker/compose.yml run --rm app`. 호스트에서 node/npm/npx 금지. `docs/superpowers/plans/2026-11-04-ttaeng-v1-execution.md`의 "공통"과 "자주 틀리는 지점"을 따른다.

## 공통 규칙

- TDD. 테스트를 먼저 쓰고 `$DC npm test -- <파일>`로 실패를 확인한다. 보고에 실패 출력 마지막 3줄 원문을 붙인다.
- CSS(cqw/cqh, 글꼴)는 jsdom에서 검증하지 않는다. CSS 검사용 가짜 테스트 금지. build와 개발 서버로 확인한다.
- `npm run build`는 `vue-tsc --noEmit`을 먼저 돌리고 테스트 파일도 검사한다. `Settings`·`AudioPlayer`를 바꾸면 테스트의 리터럴과 목도 고친다.
- 커밋하지 않는다. 각 Task의 파일 목록 밖은 수정하지 않는다.
- 마지막에 `$DC npm test`와 `$DC npm run build` 모두 통과.

## 설계 결정

- `export type Volume = 1 | 2 | 3 | 4 | 5`. `Settings = { sound; flash; volume: Volume }`, `DEFAULT_SETTINGS.volume = 5`.
- `toVolume(x: unknown): Volume`을 `src/core/limits.ts`에 둔다. 정수 1~5가 아니면 5. 백업에서 `sound`/`flash`가 깨지면 설정 전체 기본값(기존 규칙), `volume`만 깨지거나 없으면 그 필드만 5.
- 플레이어는 기존 싱글턴 `getAudioPlayer()`를 쓴다(ReadyView와 같은 방식, 테스트는 `vi.mock('../audio/player')`).
- 운동 중 음량: `useRun`이 첫 `schedule` 전에 `d.audio.setVolume(settings.volume)`. `schedule` 시그니처는 그대로.
- 끝 화면 "땡": `.rnum.ttaeng { font-family: var(--font-kr); font-size: 62cqw; letter-spacing: -.06em }`. 시안에서 본 크기이고, 전각 글자라 ×1.25를 적용하면 넘친다.
- 끝 화면 버튼 문구는 **"돌아가기"**. `store.endRun()`은 목록이 아니라 시작 전 화면(`view = 'ready'`)으로 가므로 시안의 "목록으로 돌아가기"는 실제 동작과 다르다.

## Task 1. Volume 타입·검증·저장

파일: `src/core/types.ts`, `src/core/limits.ts`(+test), `src/storage/prefs.ts`(+test), `src/storage/backup.ts`(+test), `src/app/store.test.ts`(리터럴만)

```ts
// limits.test.ts
test('toVolume: 정수 1~5만 통과, 나머지는 5', () => {
  for (const v of [1, 2, 3, 4, 5]) expect(toVolume(v)).toBe(v)
  for (const v of [0, 6, 2.5, '3', null, undefined, NaN]) expect(toVolume(v)).toBe(5)
})
// prefs.test.ts
test('volume 저장·복원')                       // setSettings({voice,false,2}) → getSettings 동일
test('volume 없는 옛 설정은 5, 나머지 유지')   // '{"sound":"voice","flash":false}' → {voice,false,5}
test('잘못된 volume은 5')                      // '{"sound":"off","flash":true,"volume":9}' → volume 5, sound off
// backup.test.ts — settings 상수에 volume: 3 as const 추가 (왕복 테스트가 3 유지 확인)
test('volume 없는 옛 백업은 5')               // { sound:'voice', flash:false } → {voice,false,5}
test('volume 깨지면 그 필드만 5')             // { sound:'off', flash:true, volume:'loud' } → {off,true,5}
```

예상 실패: `toVolume is not exported`, `toEqual` 불일치.

구현: `prefs.getSettings`는 `volume: toVolume(o.volume)`을 더한다. `backup.fixSettings`는 `{ sound: o.sound, flash: o.flash, volume: toVolume(o.volume) }`(기본값 분기는 그대로). `store.test.ts` settings 리터럴 2곳에 `volume: 5`.

## Task 2. 플레이어: 음량 · 정규화 · 미리듣기

파일: `src/audio/player.ts`(+test), `src/audio/trim.ts`(+test)

```ts
export interface AudioPlayer {
  unlock(): Promise<void>
  schedule(cues: Cue[], elapsedNow: number, mode: SoundMode): void
  cancel(): void
  setVolume(level: Volume): void
  /** 사용자 제스처 안에서 부른다. count3을 지금 한 번 낸다. 음성이 아직 없으면 신호음. */
  preview(mode: SoundMode): void
}
export const BEEP_GAIN = [0.22, 0.294, 0.392, 0.524, 0.70] as const   // MAX_GAIN 삭제
export const VOICE_PEAK = [0.45, 0.542, 0.654, 0.788, 0.95] as const
// trim.ts
export function peakOf(channels: Float32Array[]): number   // 모든 채널 |x| 최댓값
```

FakeCtx: `voiceBuf.numberOfChannels = 1`(getChannelData `[0.5]` → peak 0.5), `createGain` 결과를 `gains`에 기록(`gain: { value: 1, setValueAtTime, linearRampToValueAtTime }`), beforeEach에서 비운다. 신호음 최고점은 `linearRampToValueAtTime.mock.calls[0][0]`.

테스트:
- `peakOf는 모든 채널의 절댓값 최대` — `[[0.1,-0.8],[0.5]]` → 0.8
- `beep 기본 음량은 5단계` — 최고점 0.70
- `beep 최고점이 단계를 따른다` — setVolume(1) → 0.22, setVolume(3) → 0.392, 주파수 불변
- `음성은 GainNode로 peak 정규화` — level 5 → 0.95/0.5, level 1 → 0.45/0.5
- `peak 0인 음성은 gain 1`
- `preview: unlock 없이 바로 count3 신호음 한 번` — resume 호출, osc 1개, 880Hz, start ≈ currentTime
- `preview voice: 불러오기 전이면 신호음` / `불러온 뒤면 음성`
- `preview off는 아무것도 안 낸다`
- `preview: suspended면 resume 뒤에 낸다`

구현:
- `let level: Volume = 5`. `Voice`에 `peak` 추가, `loadVoices`에서 `peakOf(모든 채널)`.
- `beep(c, kind, when): Stoppable`은 `BEEP_GAIN[level-1]`을 쓰고 노드를 돌려준다. `voice(c, v, when): Stoppable`은 `GainNode`(gain = `v.peak > 0 ? VOICE_PEAK[level-1] / v.peak : 1`)를 거친다. `play()`가 `nodes.push`.
- `preview(mode)`: `off`면 반환. `void unlock()`(첫 await 전까지 동기 → ctx 생성·resume이 제스처 안). `fire`는 ctx가 같고 running일 때 이전 `previewNode`를 멈추고(try/catch) 새로 낸다. running이면 바로 `fire()`, 아니면 `c.resume().then(fire, () => {})`.
- 미리듣기 노드는 `nodes`가 아닌 별도 `previewNode`에 둔다(`play()`의 `stopNodes()`가 끄지 않게).

## Task 3. useRun에 음량 전달

파일: `src/run/useRun.ts`(+test), `src/views/RunView.test.ts`, `src/views/ReadyView.test.ts`(목만)

- 목 3곳에 `setVolume: vi.fn(), preview: vi.fn()`. useRun.test의 Settings 리터럴 2곳에 `volume: 5`.
- 테스트 `첫 예약 전에 설정 음량을 적용한다` — `setVolume(2)` 호출, invocationCallOrder가 첫 schedule보다 앞.
- 구현: 첫 `d.audio.schedule(...)` 바로 앞에 `d.audio.setVolume(settings.volume)`.

## Task 4. SettingsView "소리 크기"

파일: `src/views/SettingsView.vue`(+test)

- 목: `vi.hoisted`로 audio 객체, `vi.mock('../audio/player', () => ({ getAudioPlayer: () => audio }))`. 기존 소리 세그먼트 선택자는 `.seg:not(.five) button`.
- 테스트:
  - `소리 크기는 카운트다운 소리 바로 아래` — h4 순서 `['카운트다운 소리', '소리 크기', '단계 바뀔 때 화면 번쩍임']`
  - `소리 크기: 기본 5, 누르면 저장하고 한 번 들려준다` — 버튼 텍스트 1~5, 5가 pressed, '누르면 한 번 들려줘요', 2 클릭 → volume 2·pressed, `setVolume(2)`가 `preview('beep')`보다 먼저
  - `음성 모드면 음성으로 미리듣기` — preview('voice')
  - `끔이면 비활성 + 안내` — 전부 disabled, '소리를 끄면 쓸 수 없어요', 클릭해도 volume 5·preview 없음
- 구현: `pickVolume(n)`은 `updateSettings({ volume: n })` → `getAudioPlayer()` → `setVolume(n)` → `preview(sound)`. 핸들러 안에서 await 금지.
- 템플릿: 카운트다운 소리 그룹 다음에 `.group` > `.h4row`(h4 + 안내 span) + `.seg.five` 버튼 5개(`:disabled="soundOff"`, `aria-pressed`).
- CSS: `.seg.five { grid-template-columns: repeat(5, 1fr) }`, `.seg.five button { font-family: var(--font-num); font-size: 4.6cqw }`, `.seg button:disabled { color: var(--c-dim); cursor: default }`, `.seg button:disabled[aria-pressed='true'] { background: var(--c-surface-2); color: var(--c-muted) }`, `.h4row { display: flex; justify-content: space-between; align-items: baseline }`, `.h4row span { font-size: 3.2cqw; color: var(--c-muted) }`.

## Task 5. RunView: 멈춤 버튼 · 끝 화면 · 배치

파일: `src/views/RunView.vue`(+test)

테스트(기존 화면 탭 일시정지는 `.pz` 클릭으로 바꾼다):
- `멈춤 버튼으로 멈추고 버튼 4개` — `.pz` 텍스트 '멈춤', 클릭 → PAUSED, 버튼 `['계속', '다음 단계로', '처음부터', '종료']`
- `화면을 눌러도 멈추지 않는다` — section·`.rnum` 클릭 → PAUSED 없음
- `계속을 누르면 이어서, 배경을 눌러도 그대로` — `.pause` 클릭은 PAUSED 유지, `.pause .go` 클릭 → 재개, schedule 2회
- `전체 남은 시간은 통계 3번째 칸` — span `['남은 세트', '남은 라운드', '전체 남은 시간']`, `.rstat.tot b` '4:00', `.rtotal` 없음
- `끝: 땡, 멈춤·NEXT 없음, 돌아가기 버튼만 동작` — `.rnum` '땡' + class `ttaeng`, `.pz`·`.rnext` 없음, '누르면 돌아가기' 없음, 화면 탭은 view 'run' 유지, `.back` 텍스트 '돌아가기', 클릭 → view 'ready'

구현:
- 스크립트: `onTap` 삭제, `numClass`에 `ttaeng: done.value`.
- 템플릿: section `@click` 삭제. `.rtotal` 대신 `<button v-if="!done" type="button" class="pz" @click="toggle"><span class="ico" aria-hidden="true"></span>멈춤</button>`. `.rstats` 끝에 `<div class="rstat tot"><span>전체 남은 시간</span><b>{{ formatClock(st.totalRemaining) }}</b></div>`. `.rnext`에 `v-if="!done"`, 그 안의 "누르면 돌아가기" 분기 삭제. `<button v-else type="button" class="back" @click="store.endRun()">돌아가기</button>`. `.pause .row` 맨 앞에 `<button type="button" class="go" @click="toggle">계속</button>`. 버튼의 `.stop` 삭제.
- CSS:
  - `.run`: `cursor: pointer` 삭제, `--band: 12cqh; --k: 1.25`.
  - `.rbody`: bottom 그대로, `padding: calc(2cqh + var(--safe-t)) 6cqw 2.6cqh; gap: 1.6cqh`.
  - `.rtop { align-items: center }`. `.rphase` gap .5cqh, em 2.8cqw, strong 7.6cqw. `.rtotal` 블록 삭제.
  - `.rnum`: `font-size: calc(min(86cqw, 42cqh) * var(--k))`, `.long` `calc(min(54cqw, 26cqh) * var(--k))`, `.xlong` `calc(min(43cqw, 21cqh) * var(--k))`, `.ttaeng { font-family: var(--font-kr); font-size: 62cqw; letter-spacing: -.06em }`(뒤에 둔다).
  - `.rstats { grid-template-columns: 1fr 1fr 1.15fr; padding-top: 1.8cqh }`. `.rstat { min-width: 0; gap: .7cqh }`, span 3.2cqw nowrap, b 8.6cqw nowrap, small 4cqw margin-left 1cqw, `.rstat.tot { text-align: right }`.
  - `.rnext`: small 2.6cqw, `.lab` 5.6cqw, b 7cqw. 높이·safe-b는 그대로.
  - `.pz { flex: none; height: 12.5cqw; padding: 0 4.2cqw 0 3.6cqw; display: inline-flex; align-items: center; gap: 2.2cqw; background: var(--pink); color: var(--pbg); border: 2px solid var(--pink); border-radius: 0; font-weight: 700; font-size: 4.4cqw; letter-spacing: -.02em; cursor: pointer }`, `.pz .ico { display: inline-flex; gap: 1cqw; height: 3.8cqw }`, `.pz .ico::before, .pz .ico::after { content: ''; width: 1.1cqw; background: currentColor }`, `.pz:active { transform: translateY(1px) }`.
  - `.pause .go { background: var(--c-accent); color: var(--c-on-accent); border-color: var(--c-accent); min-height: 14cqh; font-size: 7.4cqw }`.
  - `.back { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--band) + var(--safe-b)); padding-bottom: var(--safe-b); display: flex; align-items: center; justify-content: center; gap: 2.4cqw; background: var(--c-bg); color: var(--c-fg); border: 0; border-top: 1px solid var(--c-line-2); border-radius: 0; font-weight: 700; font-size: 5.6cqw; letter-spacing: -.02em; cursor: pointer }`, `.back::before { content: ''; width: 2.6cqw; height: 2.6cqw; border-left: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg) }`.

## Task 6. 문서

파일: `docs/superpowers/specs/2026-11-04-ttaeng-design.md`

- 설정: 소리 크기 1~5(기본 5), 카운트다운 소리 바로 아래, 누르면 저장 후 count3 한 번, 끔이면 비활성 + 안내.
- 운동 중: 그림 갱신(위 오른쪽 [멈춤], 통계 3칸), 숫자 `min(86cqw, 42cqh) × 1.25`, 끝 화면 "땡" SUIT 62cqw, 아래 띠가 "돌아가기" 버튼(시작 전 화면으로), 멈춤 버튼·NEXT 띠 없음.
- 일시정지: 멈춤 버튼으로만 멈춘다. 화면 탭은 아무 일도 하지 않는다. 버튼 4개(계속 / 다음 단계로 / 처음부터 / 종료), 배경 탭 무반응.
- 신호음: 단계별 최고 음량 [0.22, 0.294, 0.392, 0.524, 0.70], 기본 5.
- 음성: 불러올 때 peak를 재고 GainNode로 단계별 목표 peak [0.45, 0.542, 0.654, 0.788, 0.95].
- 백업: settings 예시에 `"volume": 5`, 없거나 1~5 정수가 아니면 5.

## 자주 틀리는 지점

1. 테스트 파일도 vue-tsc가 검사한다. Settings 리터럴 6곳, AudioPlayer 목 3곳.
2. jsdom에 AudioContext가 없다. 기존 FakeCtx를 넓힌다.
3. `preview`·`pickVolume`에서 await 금지(iOS 제스처).
4. 미리듣기 노드는 `previewNode`에 따로.
5. SettingsView 기존 `.seg button` 선택자는 `.seg:not(.five)`로 좁힌다.
6. `.rnext`를 v-if로 빼도 `.rbody` bottom은 그대로, 그 자리를 `.back`이 차지한다.
