# 땡: 정리 계획 (글꼴 분리 · 스타일 분리 · 코드 정리)

사용자 승인 범위: A → B → C. 눈에 보이는 변화는 A의 Stepper 보조문구 굵기(500→400)뿐이다. 글꼴 패밀리 이름도 바뀌지만 화면에는 보이지 않는다. B와 C는 계산된 스타일과 동작이 전부 그대로여야 한다.

`$DC` = `docker compose -f docker/compose.yml run --rm app`. 호스트에서 node/npm/npx 금지.

## 공통 규칙

- 커밋하지 않는다. 각 Task 파일 목록 밖은 수정하지 않는다.
- 동작 변화 없는 리팩터라 TDD는 적용하지 않는다. Task마다 `$DC npm test`와 `$DC npm run build`를 돌리고 tail을 원문으로 붙인다. 새 테스트를 넣으면 실패 출력 마지막 3줄 원문을 붙인다(이 계획에는 새 테스트가 없다).
- 메인 에이전트가 화면별 계산된 스타일 스냅샷으로 검증한다. A가 끝난 뒤 기준을 다시 잡고, B·C는 그 기준과 차이 0이어야 한다.

## A. 한글 글꼴을 고정 굵기 400·700 두 파일로 분리

결정:
- **이름은 `TtaengKr`.** `src/assets/fonts/LICENSES/SUIT-OFL.txt`에 `Reserved Font Name SUIT`가 있다. instancer 결과는 OFL상 수정본이라 "SUIT"를 이름에 못 쓴다(TtaengNum과 같은 이유).
- 파일: `TtaengKr-Regular.woff2`(400), `TtaengKr-Bold.woff2`(700). 글리프 전부 유지(subset 없음). `font-display: swap`, `format('woff2')`.
- `SUIT-OFL.txt`와 저작권 문구(name ID 0)는 유지.
- 호스트에 fontTools가 없으므로 일회용 Python 컨테이너로 실행한다.

### A1. `scripts/make-kr-font.py`

`make-num-font.py`와 같은 형식(docstring 사용법, `main(src, outdir)`, `FAMILY = "TtaengKr"`).
- 사용법: `docker run --rm -v "$PWD":/w -w /w python:3.12-slim sh -c "pip install -q fonttools brotli && python scripts/make-kr-font.py src/assets/fonts/SUIT-Variable.woff2 src/assets/fonts"`. 원본은 삭제 후 `git show 4e74af9:src/assets/fonts/SUIT-Variable.woff2`로 꺼낼 수 있다고 적는다.
- 굵기마다 `TTFont(src)`를 새로 열고 fvar 모든 축을 고정(wght만 지정값, 나머지 default) → `instancer.instantiateVariableFont`.
- fvar/gvar 없음 확인, STAT 있으면 삭제, `set(cmap)`이 원본과 같은지 assert. 원본 아웃라인 형식(glyf/CFF2)을 출력.
- OS/2 `usWeightClass = weight`, `fsSelection`은 400이면 REGULAR(bit 6)만, 700이면 BOLD(bit 5)만. `head.macStyle` bit 0은 700만.
- name: 1=`TtaengKr`, 2=`Regular`/`Bold`, 4=`TtaengKr Regular`/`TtaengKr Bold`, 6=`TtaengKr-Regular`/`TtaengKr-Bold`, 3=`TtaengKr-<Style>-ttaeng`. 16/17/21/22/25 삭제. ID 0,7,8,9,11,13,14 외 레코드에 "SUIT"가 없음을 assert. CFF면 fontNames/FullName/FamilyName도 바꾼다.
- `flavor = "woff2"`로 `<outdir>/TtaengKr-<Style>.woff2` 저장, 크기와 cmap 수 출력. 예상 약 174KB/175KB.

### A2. CSS·토큰·Stepper

파일: `src/styles/fonts.scss`, `src/styles/_tokens.scss`, `src/components/Stepper.vue`, `docs/superpowers/specs/2026-11-04-ttaeng-design.md`, `SUIT-Variable.woff2` 삭제.
- `fonts.scss`: SUIT @font-face → `TtaengKr` 두 개(400 Regular, 700 Bold). 주석에 SUIT 파생·RFN·스크립트 명시. TtaengNum 블록 유지.
- `_tokens.scss`: `num: (TtaengNum, TtaengKr, …)`, `kr: (TtaengKr, -apple-system, …)`. 주석의 SUIT 표기도 정리.
- `Stepper.vue` `.lab small` `font-weight: 500` → `400`.
- 설계 문서의 SUIT 글꼴 언급을 "TtaengKr(SUIT를 400/700으로 고정한 파생, OFL RFN 때문에 이름 변경, `scripts/make-kr-font.py`)"로.

확인:
- `grep -rnE "font-weight: *[0-9]+" src | grep -vE ": *(400|700)"` 출력 없음(@font-face 범위 표기 제외).
- `grep -rn "SUIT" src --include=*.scss --include=*.vue` → 주석만.
- build `precache` 약 497 KiB, `dist/assets`에 TtaengKr 두 파일.

함정: `b`/`strong` 기본 `bolder`. 지금은 모두 700 명시라 문제없다. 새로 만들지 않는다.

## B. 스타일 분리

현재 중복 조사 결과:

| 블록 | 위치 | 상태 |
|---|---|---|
| `.view`(하단 메뉴 위) | List / Settings | 동일 |
| `.view`(전체 화면) | Ready / Edit | 동일. Run은 다름(그대로 둠) |
| `.vhead` + h2 | List / Settings | 동일 |
| `.label-en` | List·Settings(`--c-accent`), Ready·Edit(`--c-muted`) | color만 다름 |
| `.scroll` | List / Settings / Edit | 앞 4줄만 같고 padding·gap 다름 |
| `.bar` + button | Ready ⊂ Edit | Edit에 `&.go`, `span` 추가 |
| `.steppers` | Ready / Edit | 동일 |
| `.seg`, `.btn-wide`, `.group`, `.toggle` | Settings에만 | 중복 아님, Settings에 둔다 |
| Run `.rphase em`, Ready `.start em` | | label-en + font-style normal + 색/크기 |

결정:
- **전역 클래스가 아니라 SCSS mixin(`src/styles/_ui.scss`).** mixin은 각 scoped 블록 안에서 같은 선택자·같은 순서로 펼쳐져 명시도와 순서가 그대로다. 전역으로 옮기면 명시도가 내려가고, `.view`가 RunView의 `class="view run"`에 새는 등 이름 충돌이 생긴다.
- `_ui.scss`는 mixin만 담는다(CSS 출력 없음, main.scss에서 @use 안 함).
- 분리 파일은 컴포넌트 옆(`src/views/ListView.scss` 등). 토큰은 CSS 변수라 `@use '../styles/ui';`만 필요(App은 `./styles/ui`).
- `<style scoped lang="scss" src="./X.scss"></style>`. `lang` 생략 금지.

### B1. `_ui.scss` mixin 만들고 SFC 안에서 적용

```scss
@mixin view($nav: false)                 // position:absolute; inset(전체 또는 하단 메뉴 위); display:flex; flex-direction:column
@mixin vhead                             // padding/display/flex-direction/gap + h2 { … }
@mixin label-en($color, $size: 2.8cqw)   // font-family, font-weight, font-size, letter-spacing, color
@mixin scroll($pad-bottom, $gap: null)   // flex, overflow-y, padding: 0 5cqw $pad-bottom, display, flex-direction, gap
@mixin bar                               // Ready의 .bar 본문 + button
@mixin steppers
```
본문은 원본 줄을 **같은 순서로** 옮긴다.
- List·Settings: `.view { @include ui.view(true) }`, `.vhead`, `.label-en(var(--c-accent))`, `.scroll`(List `4cqh, 2cqw`, Settings `4cqh`).
- Ready·Edit: `.view`, `.label-en(var(--c-muted))`, `.steppers`, `.bar`. Edit `.bar`는 `@include ui.bar;` 뒤에 `button { &.go {…} }`와 `span {…}`. Edit `.scroll`은 `ui.scroll(calc(4cqh + env(safe-area-inset-bottom, 0px)), 2cqw)`.
- Run `.rphase em { font-style: normal; @include ui.label-en(var(--psub)); }`, Ready `.start em { font-style: normal; @include ui.label-en(var(--c-on-accent-sub), 3cqw); }`. Run `.view`는 그대로.

확인: B1 전후로 build해서 `dist/assets/index-*.css`를 scratchpad에 복사, `sed -E 's/data-v-[0-9a-f]{8}/data-v-X/g; s/flash-[0-9a-f]{8}/flash-X/g'` 정규화 후 `}`마다 줄을 나눠 diff → 차이 없음.

### B2. 스타일 블록을 `.scss` 파일로

App, List, Ready, Edit, Run, Settings, AppToast, BottomNav, InstallHint, Stepper의 `<style scoped lang="scss">` 내용을 옆 `.scss`로 그대로 옮기고(주석 포함), 태그를 `src` 참조로 바꾼다. mixin을 쓰는 파일만 맨 위에 `@use`. 확인: B1과 같은 CSS diff 차이 없음, 개발 서버 HMR 동작.

### B3. 버튼 중복 선언 삭제(선택)

`main.scss`가 이미 `button { border-radius: 0; cursor: pointer; … }`를 준다. `<button>`에 걸린 규칙에서 `border-radius: 0`과 `cursor: pointer`만 삭제: List `.tcard`, Ready `.bar button`·`.start`, Edit `.danger`(+bar mixin), Run `.pz`·`.back`·`.pause button`, Settings `.seg button`·`.toggle`·`.btn-wide`, BottomNav `button`, InstallHint `.ok`, Stepper `button`. 지우지 않는 것: div인 `.seg`, `.field input`, `.seg button:disabled { cursor: default }`, `.run`의 `user-select`. CSS diff에는 삭제분만 보이고 스냅샷 차이는 0.

위험: mixin 안 선언 순서(단축 속성 겹침), Sass `mixed-decls` 경고(중첩 뒤 선언 금지), scoped 부모 규칙이 자식 루트에 걸리는 경우를 새로 만들지 않기, `@keyframes flash`는 RunView 블록 안에 유지.

## C. 코드 정리 (동작 변화 없음)

공개 API 유지(`AudioPlayer`, `createAudioPlayer`, `getAudioPlayer`, `VOICE_EARLY`, `BEEP_GAIN`, `VOICE_PEAK`). `player.test.ts`는 수정하지 않는다.

### C1. `src/audio/player.ts`
1. `safeStop(n: Stoppable)` 도입, `stopNodes`와 preview의 이전 노드 정지에 사용.
2. `unlock` 분기 정리:
   ```ts
   function createContext(): AudioContext | null   // Ctor 찾기 → ctx 설정 → audioSession → statechange 리스너 (순서 그대로)
   function primeSilent(c: AudioContext): void      // 1ms 무음 버퍼
   async function unlock() {
     try {
       const fresh = ctx === null
       const c = ctx ?? createContext()
       if (!c) return
       resumeAndPlay(c)
       if (fresh) primeSilent(c)
       if (voices.size === 0) await loadVoices(c)
     } catch { /* reject하지 않는다 */ }
   }
   ```
   첫 await 전까지 동기로 생성·resume해야 한다는 iOS 제약을 주석으로 남긴다(preview가 기댄다).
3. `schedule`의 `stopNodes()` 삭제(ctx 없으면 nodes가 비어 있고, 있으면 play가 먼저 부른다) → `last = {…}; if (ctx) play(ctx)`.
4. `beep`의 `kind.startsWith('count')`를 `const count` 하나로.

손대지 않음: statechange와 resume().then의 중복 play(무해), unlock 동시 호출 시 음성 이중 로드(동작 변화라 별도 과제).

### C2. `src/views/RunView.vue`
`const st = computed(() => state.value)` 별칭 삭제. script는 `state.value.…`, 템플릿은 `state.…`.

### C3. `toConfig` 공유
`src/core/types.ts`에 `export function toConfig(t: TimerConfig): TimerConfig`(일곱 필드 명시 복사, spread 금지). `src/app/store.ts`의 로컬 `toConfig` 삭제 후 import. `src/views/EditView.vue`는 `reactive<TimerConfig>(existing ? toConfig(existing) : { …기본값 그대로 })`.

### C4. `isSoundMode`
`src/core/limits.ts`에 `export function isSoundMode(x: unknown): x is SoundMode`. `src/storage/prefs.ts`, `src/storage/backup.ts`의 세 갈래 비교를 교체. 기본값 처리는 각자 그대로.

하지 않는 것: useRun, clock.ts, db.ts newId 대체 경로, share.ts, InstallHint, 번들 최적화(대부분 Vue, 성능 문제 없음).

## 마지막 확인
- `$DC npm test`, `$DC npm run build` 통과.
- 메인 에이전트의 스냅샷 비교 차이 0.
- precache 약 497 KiB.
