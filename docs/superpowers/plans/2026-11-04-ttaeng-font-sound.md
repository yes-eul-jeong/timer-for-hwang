# 땡: 글꼴 교체 · 소리 타이밍 수정 계획

`$DC` = `docker compose -f docker/compose.yml run --rm app`. 호스트에서 node/npm/npx 금지.
`docs/superpowers/plans/2026-11-04-ttaeng-v1-execution.md`의 "공통"과 "자주 틀리는 지점"을 그대로 따른다.

## 공통 규칙 (실행자 필독)

- TDD: 테스트를 먼저 쓰고 실행해서 실패를 확인한다. **보고에 실제 실패 출력의 마지막 3줄을 원문 그대로 붙인다.** 없으면 배치를 반려한다(재작업에도 적용). Task 2·3은 CSS·문서라 단위 테스트 대상이 아니다(jsdom은 글꼴을 렌더링하지 않는다). 가짜 CSS 테스트를 만들지 않는다.
- 커밋하지 않는다. 메인 에이전트가 검증 후 커밋한다.
- 각 Task의 "파일" 목록 밖은 수정하지 않는다. `useRun`, `RunView` 스크립트, `ReadyView` 로직은 건드리지 않는다(`AudioPlayer` 인터페이스 불변).
- 마지막에 `$DC npm test`와 `$DC npm run build`가 둘 다 통과해야 한다. 보고에 두 명령의 마지막 몇 줄을 붙인다.

---

## Task 1. 소리 타이밍 (`src/audio/player.ts`)

파일: `src/audio/player.ts`, `src/audio/player.test.ts`

### 원인
1. `unlock()`이 `new AudioContext()` 직후 `schedule()`이 불리면 ctx가 아직 suspended라 `currentTime`이 0에 멈춰 있다. resume까지 걸린 시간만큼 모든 cue가 늦는다.
2. `LEAD = 0.03`이 지연을 더한다.
3. 출력 지연(baseLatency/outputLatency)을 무시한다.
4. 음성 로드 후 재예약이 `ctx.currentTime` 차이로 경과 시간을 계산한다. suspended 동안엔 틀린 값이다.

### 설계
- `LEAD` 삭제. 상수 추가: `export const VOICE_EARLY = 0.05`(음성은 모음이 박자라 0.05초 먼저 시작), `const LATE_OK = 0.02`(이만큼까지 늦은 cue는 지금 재생, 그보다 늦으면 건너뜀).
- 시그니처: `export function createAudioPlayer(baseUrl: string, now: () => number = () => performance.now()): AudioPlayer`. `useRun`의 화면 시계도 `performance.now` 기준이라 cue 목표 시각을 performance 시각으로 계산한다. `getAudioPlayer()`는 그대로(`now` 기본값 사용).
- 상태: `let last: { cues: Cue[]; elapsedNow: number; mode: SoundMode; perfAt: number } | null`. `ctxTime` 삭제.
- 내부 함수:
  - `stopNodes(): void` — 기존 nodes 정지 루프를 뽑아낸다. `cancel()`과 `schedule()`이 공유.
  - `audioTimeAt(c: AudioContext, p: number): number` — performance 시각 `p`에 소리가 **들리려면** 넣어야 할 ctx 시각.
    ```ts
    const ts = typeof c.getOutputTimestamp === 'function' ? c.getOutputTimestamp() : undefined
    if (ts && ts.performanceTime && ts.performanceTime > 0 && ts.contextTime !== undefined)
      return ts.contextTime + (p - ts.performanceTime) / 1000
    return c.currentTime + (p - now()) / 1000 - ((c.baseLatency ?? 0) + (c.outputLatency ?? 0))
    ```
  - `play(c: AudioContext): void` — `last`로 노드를 만든다.
    ```ts
    stopNodes()
    if (!last || last.mode === 'off' || c.state !== 'running') return
    const t = now()
    const elapsed = last.elapsedNow + (t - last.perfAt) / 1000
    for (const cue of last.cues) {
      if (cue.at <= elapsed) continue
      const when = audioTimeAt(c, t + (cue.at - elapsed) * 1000)
      if (when < c.currentTime - LATE_OK) continue          // 늦게 울리느니 건너뛴다
      const v = last.mode === 'voice' && !cue.beepOnly ? voices.get(cue.kind) : undefined
      if (v) src.start(Math.max(c.currentTime, when - VOICE_EARLY), v.skip)
      else beep(c, cue.kind, Math.max(c.currentTime, when))
    }
    ```
- `schedule(cues, elapsedNow, mode)`: `stopNodes()` → `last = { cues, elapsedNow, mode, perfAt: now() }` → `if (ctx) play(ctx)`. ctx가 없으면 기억만 한다(unlock 뒤 running이 되면 재생).
- `cancel()`: `stopNodes(); last = null`.
- `loadVoices(c)` 끝: `if (ctx === c && last?.mode === 'voice' && voices.size > 0) play(c)`. 경과 시간 보정은 `play`가 `perfAt`으로 한다.
- `unlock()`에서 ctx를 처음 만들 때 한 번만:
  - `c.addEventListener('statechange', () => { if (ctx === c && c.state === 'running') play(c) })`
  - `void c.resume()` → `c.resume().then(() => { if (ctx === c && c.state === 'running') play(c) }, () => {})`로 바꾼다(else 분기의 `ctx.resume()`도 같은 처리). 동기 생성·resume 순서(iOS)는 유지. `play`는 먼저 `stopNodes()`를 하므로 두 번 불려도 중복 노드가 남지 않는다.
- 타입: `getOutputTimestamp`, `baseLatency`, `outputLatency`는 lib.dom에 있다. 구형 브라우저 대비로 `typeof` 확인과 `?? 0`을 쓴다.

### 테스트 (`src/audio/player.test.ts`)

FakeCtx 확장:
- `static initialState: AudioContextState = 'running'`, 생성자에서 `this.state = FakeCtx.initialState`.
- `listeners: (() => void)[]`, `addEventListener(type, fn)`(statechange만 저장), 헬퍼 `setState(s)` = state 변경 후 listeners 호출.
- `resume = vi.fn(async () => {})` — state를 바꾸지 않는다(테스트가 `setState`로 제어).
- `baseLatency?: number`, `outputLatency?: number`, `getOutputTimestamp?: () => { contextTime: number; performanceTime: number }` — 기본 미정의.
- `currentTime = 10` 유지.
- 파일 상단 `let t = 1000; const now = () => t`. `beforeEach`에서 `t = 1000`, `FakeCtx.initialState = 'running'`. 모든 테스트가 `createAudioPlayer('/', now)` 사용.

기존 테스트 변경 (LEAD 제거 때문):
- `skips past cues`: `schedule([cue(1), cue(5)], 3, 'beep')` → osc 1개, start ≈ `10 + 2` (기존 `+ 0.03` 삭제).
- `reschedules only remaining cues after voices load`: `ctx.currentTime += 1.5`와 함께 `t += 1500`. 기대값: voiced 2개, start ≈ `ctx.currentTime + 0.5 - VOICE_EARLY`, `ctx.currentTime + 1.5 - VOICE_EARLY` (기존 `+ 0.03` → `- 0.05`).
- `cancel stops all nodes`: 변경 없음.

새 테스트 (이름 그대로):
1. `does not create nodes while suspended` — `initialState = 'suspended'`, `ctx.currentTime = 0`, `await unlock()`, `schedule([cue(1), cue(2)], 0, 'beep')` → `oscs.length === 0`.
2. `schedules on statechange to running without delaying cues` — 1번 상태에서 `t += 300`, `ctx.currentTime = 0.05`, `ctx.setState('running')` → osc 2개, start ≈ `0.05 + 0.7`, `0.05 + 1.7` (기다린 0.3초가 빠져 cue가 늦지 않음).
3. `cancel prevents replay on statechange` — suspended에서 schedule → `cancel()` → `setState('running')` → osc 0개.
4. `maps cue time through getOutputTimestamp` — `ctx.getOutputTimestamp = () => ({ contextTime: 9.9, performanceTime: 990 })`, `schedule([cue(2)], 0, 'beep')` → start ≈ `9.9 + (3000 - 990) / 1000` = `11.91`.
5. `falls back to currentTime minus base and output latency` — `getOutputTimestamp`가 `{ contextTime: 0, performanceTime: 0 }`을 반환(무효값), `baseLatency = 0.01`, `outputLatency = 0.04`, `schedule([cue(2)], 0, 'beep')` → start ≈ `11.95`.
6. `starts voice VOICE_EARLY before the beat` — `await unlock()`(음성 로드 완료), `schedule([cue(2)], 0, 'voice')` → voiced source 1개, `starts[0][0]` ≈ `12 - VOICE_EARLY`. 같은 조건 `'beep'`이면 osc start ≈ `12`(비교용, 같은 테스트 안에서).
7. `skips cues already past in audio time and clamps slightly late ones` — `outputLatency = 0.1`, `schedule([cue(0.05), cue(0.09), cue(1)], 0, 'beep')` → osc 2개, start ≈ `[10, 10.9]` (0.05는 9.95라 건너뜀, 0.09는 9.99라 `currentTime`으로 당김).
8. `does nothing in off mode` — `schedule([cue(1)], 0, 'off')` → osc·source 0개(무음 버퍼 source 1개는 unlock에서 생기므로 `sources.filter(s => s.buffer === voiceBuf)`로 센다).

`VOICE_EARLY`는 `import { createAudioPlayer, VOICE_EARLY } from './player'`. 비교는 전부 `toBeCloseTo(x, 5)`.

검증: `$DC npx vitest run src/audio` (실패 확인 → 구현 → 통과), `$DC npm run typecheck`.

---

## Task 2. 글꼴 교체와 굵기·크기

파일: `src/styles/fonts.scss`, `src/styles/_tokens.scss`, `src/main.ts`, `package.json`, `package-lock.json`, `src/assets/fonts/PretendardVariable.woff2`(삭제), `src/assets/fonts/LICENSES/BarlowCondensed-OFL.txt`(삭제), 굵기 변경 대상 .vue 7개(아래).
`vite.config.ts`는 수정하지 않는다: `globPatterns`에 이미 `woff2`가 있고, `maximumFileSizeToCacheInBytes`는 설정된 적이 없으며(Pretendard 2,057,688B가 기본 2MiB 아래였음) SUIT 624KB도 기본 한도 안이다.

1. `fonts.scss` 전체 교체:
   - `@font-face { font-family: TtaengNum; font-weight: 100 900; font-style: normal; font-display: swap; src: url('../assets/fonts/TtaengNum.woff2') format('woff2'); }` — 주석: Pretendard SemiBold 숫자를 60% 폭으로 만든 글꼴(scripts/make-num-font.py), Pretendard는 RFN이 있어 이름을 바꿨다, 굵기 범위를 넓게 잡아 브라우저가 가짜 볼드를 만들지 않게 한다.
   - `@font-face { font-family: SUIT; font-weight: 100 900; font-style: normal; font-display: swap; src: url('../assets/fonts/SUIT-Variable.woff2') format('woff2-variations'), url('../assets/fonts/SUIT-Variable.woff2') format('woff2'); }`
   - Pretendard `@font-face` 삭제.
2. `git rm src/assets/fonts/PretendardVariable.woff2 src/assets/fonts/LICENSES/BarlowCondensed-OFL.txt`(스테이징만, 커밋 금지. 또는 `rm`). `Pretendard-OFL.txt`, `SUIT-OFL.txt`는 유지.
3. `main.ts`: `@fontsource/barlow-condensed` import 두 줄 삭제.
4. 패키지: `$DC npm uninstall @fontsource/barlow-condensed`, `$DC npm i -D pretendard@^1.3.9`. 결과 `package.json`의 `dependencies`는 `vue`만, `pretendard`는 `devDependencies`.
5. `_tokens.scss`:
   - `num: (TtaengNum, SUIT, -apple-system, system-ui, sans-serif)`
   - `kr: (SUIT, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif)`
   - `$tracking` `tight: -.03em` (주석: 글자가 이미 좁아서 덜 좁힌다)
   - 타이포 주석: 숫자는 TtaengNum, 그 글꼴에 없는 영문 라벨·한글은 SUIT로 넘어간다.
6. 굵기: 아래 줄의 `font-weight: 900`·`800`을 전부 `700`으로. 500/600/700은 그대로.
   `Stepper.vue:40`, `SettingsView.vue:132,160`, `ReadyView.vue:70,92,117`, `EditView.vue:108`, `RunView.vue:148,156,165,193,235,242,278,292`, `ListView.vue:37,73,86`.
7. `RunView.vue` `.rnum`: `font-size: 72cqw` → `86cqw`, `&.long` `52cqw` → `54cqw`, `&.xlong` `40cqw` → `43cqw`. 스크립트·템플릿 변경 없음(`numClass` 기준값 60/600 그대로, 기존 테스트가 다룬다).

검증:
- `grep -rnE "font-weight: *(800|900)" src` → 출력 없음
- `grep -rn "Barlow\|PretendardVariable\|fontsource" src package.json` → 출력 없음
- `$DC npm run build` 통과, `ls dist/assets | grep -E "TtaengNum|SUIT"`에 두 woff2, `grep -o "TtaengNum[^\"]*woff2\|SUIT[^\"]*woff2" dist/sw.js`로 precache 포함 확인
- `$DC npm test` 통과
- 눈 확인은 메인이 개발 서버(`http://localhost:5180/timer-for-hwang/`)에서 한다.

---

## Task 3. 설계 문서 갱신

파일: `docs/superpowers/specs/2026-11-04-ttaeng-design.md`

- 4장 글꼴 줄(현재 "숫자·영문 Barlow Condensed ... 한글 Pretendard")을 바꾼다: 숫자는 TtaengNum(Pretendard SemiBold 숫자·`:/.-`·공백만 남겨 폭 60%로 줄인 파생 글꼴, OFL RFN 때문에 이름 변경, `scripts/make-num-font.py`로 생성), 영문 라벨·한글은 SUIT 가변(OFL). 굵기는 최대 700. 영문 라벨 자간 0.24em, 큰 숫자 자간 -0.03em. Satoshi·SF Pro Condensed 불가 사유 문장은 유지.
- 6.1에 항목 추가:
  - 화면 시계(`performance.now`) 기준 목표 시각을 오디오 시각으로 바꿔 예약한다. `getOutputTimestamp()`가 있으면 그것으로, 없으면 `currentTime`에서 `baseLatency + outputLatency`를 빼서 출력 지연을 보정한다.
  - `AudioContext`가 running이 되기 전에는 예약하지 않고, running이 되는 순간 그때까지 흐른 시간을 반영해 예약한다.
  - 신호음은 숫자가 바뀌는 순간에 울린다. 음성은 모음이 박자로 들리므로 0.05초 먼저 시작한다.
  - 0.02초 넘게 지난 소리는 늦게 틀지 않고 건너뛴다.

검증: 문서만 바뀌었는지 `git status`로 확인.
