# 땡: 실행 화면 플레이어 배치 계획

사용자 확정 시안: https://claude.ai/artifact/4Jp93vyjJ9Hf56o5GvTgHW (원본 scratchpad `ttaeng-player.html`, base64 글꼴이 들어 있으니 `<style>`과 `function html(` 부분만 grep/sed로 읽는다). 시안은 JS `fit()`로 크기를 줄이지만 앱은 CSS 상수만 쓰고, 상수는 이 문서 값이 최종이다.

`$DC` = `docker compose -f docker/compose.yml run --rm app`. 호스트에서 node/npm/npx 금지.

## 공통 규칙
- TDD. 테스트를 먼저 바꾸고 `$DC npm test -- src/views/RunView.test.ts`로 실패 확인, 마지막 3줄 원문 첨부.
- CSS는 jsdom에서 검사하지 않는다. 크기는 개발 서버에서 재서 숫자로 보고한다.
- 커밋하지 않는다. 파일 목록 밖은 손대지 않는다. `useRun.ts`는 바꾸지 않는다.
- 마지막에 `$DC npm test`, `$DC npm run build` 통과.

## 확인한 동작 (useRun 그대로)
- `toggle()`: 끝이면 무시, 그 밖에는 멈춤↔재생.
- `skip()`/`restart()`는 끝에서 `resume()`을 부른다. 실행 중이면 계속 달리고, 멈춘 상태면 저절로 다시 달린다(기존 동작 유지). 마지막 단계에서 skip이면 끝 화면.
- 끝 상태: remaining·totalRemaining·setsLeft·roundsLeft 모두 0.

## 설계 결정
- 끝 화면: `.tools`, `.play`는 `v-if="!done"`. `.total`(0:00)과 세트·라운드는 남긴다. 아래 띠는 "돌아가기".
- 멈춤: 루트에 `:class="{ paused }"`, `.numwrap` 안 `<span v-if="paused" class="chip">PAUSED</span>`, play 버튼 `:aria-label="paused ? '재생' : '일시정지'"`, 아이콘 v-if/v-else.
- 버튼: 보이는 글자 없음, aria-label만. 버튼 자체가 채운 정사각형. SVG는 시안 `I` 객체 그대로(`aria-hidden="true"`).
- `.flash` 유지. `--c-scrim` 토큰 유지.

## Task 1. 숫자 글꼴 폭 65%
파일: `scripts/make-num-font.py`, `src/assets/fonts/TtaengNum.woff2`, `src/styles/fonts.scss`(주석)
1. `SCALE_X = 0.65`, docstring 60%→65%, 사용법을 아래 명령으로.
2. 생성(named volume `ttaeng_node_modules` 읽기 전용 마운트):
   ```
   docker run --rm -v "$PWD":/w -v ttaeng_node_modules:/nm:ro -w /w python:3.12-slim sh -c "pip install -q fonttools brotli && python scripts/make-num-font.py /nm/pretendard/dist/public/static/Pretendard-SemiBold.otf src/assets/fonts/TtaengNum.woff2"
   ```
3. 검증: 새/옛(`git show HEAD:...`를 scratchpad에 저장) 글꼴의 `hmtx['zero']`, `hmtx['colon']` 비율 ≈ 1.083, name ID 1 = `TtaengNum`.
4. `fonts.scss` 주석 60%→65%.

## Task 2. 테스트 먼저 (RunView.test.ts)
헬퍼 `btn = (w, l) => w.find(`[aria-label="${l}"]`)`. 기존 '멈춤 버튼으로…', '계속을 누르면…', 'button tap…', 'end stops…', '전체 남은 시간은 통계 3번째 칸'을 아래로 바꾼다. 'work phase…', 'round rest…', 'ten minutes…'는 유지. 타바타: 준비10·운동20·휴식10·8세트, 전체 4:00.
- `재생 버튼으로 멈추고 다시 재생: 라벨·PAUSED 칩, 덮개 없음` — 처음 `btn('일시정지')` 있음·`.chip` 없음 / 클릭 후 루트 class `paused`, `.numwrap .chip` 'PAUSED', `btn('재생')` 있음, `btn('일시정지')` 없음, `.pause` 없음, 처음부터·다음 단계·종료 모두 있음 / `btn('재생')` 클릭 후 칩·paused 없음, `audio.schedule` 2회
- `화면을 눌러도 아무 일 없음` — 루트·`.rnum`·`.total` 클릭 후 칩 없음, data-index '0', `btn('일시정지')` 유지
- `실행 중 다음 단계: 계속 달린다` — data-index '1', phase 'work', `.rnum` '20', `btn('일시정지')` 있음
- `실행 중 처음부터: 계속 달린다` — t=15000 flush → index '1' → `btn('처음부터')` → index '0', `.rnum` '10', paused 없음
- `멈춘 상태에서 다음 단계를 누르면 다시 달린다(기존 동작)`
- `실행 중 종료하면 시작 전 화면` — view 'ready'
- `전체 남은 시간은 숫자 아래 한 줄` — `.total span` '전체 남은 시간', `.total b` '4:00', `.rstat span` ['남은 세트','남은 라운드'], `.rstat.tot` 없음, `.srow .play` 있음
- 끝 테스트: `.tools`·`.play`·`btn('처음부터')` 없음, `.total b` '0:00', 나머지(`.rnext` 없음, 루트 클릭 무시, `.back`) 그대로

## Task 3. RunView.vue 템플릿
```html
<section class="view run" :class="{ paused }" data-view="run" :data-phase :data-index>
  <div class="rbody">
    <div class="rtop">
      <div class="rphase"><em>{{ phaseEn }}</em><strong>{{ phaseName }}</strong></div>
      <div v-if="!done" class="tools">
        <button type="button" class="tb" aria-label="처음부터" @click="restart"><svg restart/></button>
        <button type="button" class="tb" aria-label="다음 단계" @click="skip"><svg next/></button>
        <button type="button" class="tb" aria-label="종료" @click="onEnd"><svg stop/></button>
      </div>
    </div>
    <div class="numwrap">
      <div class="rnum" :class="numClass">{{ num }}</div>
      <span v-if="paused" class="chip">PAUSED</span>
    </div>
    <div class="total"><span>전체 남은 시간</span><b>{{ formatClock(state.totalRemaining) }}</b></div>
    <div class="srow">
      <div class="rstat">남은 세트 …</div>
      <button v-if="!done" type="button" class="play" :aria-label="paused ? '재생' : '일시정지'" @click="toggle"><svg play v-if paused/><svg pause v-else/></button>
      <div class="rstat rt">남은 라운드 …</div>
    </div>
  </div>
  rnext / back / flash 그대로. .pause 블록 삭제
</section>
```
SVG: pause `rect 5,4,5×16`+`rect 14,4,5×16` / play `M6 3.5 21 12 6 20.5Z` / restart 시안 path 2개(stroke 2.6, linecap square) / next `M4 4 15.5 12 4 20Z`+`rect 17,4,3.4×16` / stop `rect 5,5,14×14`.

## Task 4. RunView.scss
- `.run`: `--band: 8cqh; --bandpad: calc(var(--safe-b) * .5)`.
- `.rbody`: `bottom: calc(var(--band) + var(--bandpad)); padding: calc(2cqh + var(--safe-t)) 6cqw 2.4cqh; grid-template-rows: auto minmax(0, 1fr) auto auto; gap: 1.6cqh`.
- `.rtop`: `align-items: flex-start; min-height: 11.5cqw`.
- `.tools { display: flex; gap: 2.6cqw; flex: none }`. `.tb`, `.play` 공통: `display: grid; place-items: center; padding: 0; border: 0; border-radius: 0; background: var(--pink); color: var(--pbg)`, `:active { transform: translateY(1px) }`. `.tb` 11cqw(svg 5cqw), `.play` 18cqw(svg 8cqw).
- `.numwrap { position: relative; display: grid; place-items: center; min-height: 0 }`. `.chip { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); @include ui.label-en(var(--pbg), 4.4cqw); padding: 1.8cqw 3cqw 1.8cqw 4cqw; background: var(--pink) }`. `.paused .rnum { opacity: .32 }`(+선택 `transition: opacity var(--d-fast)`).
- `.total { display: flex; flex-direction: column; align-items: center; gap: .6cqh }`, span 700 3.2cqw `--psub`, b: num 글꼴 700 10cqw line-height 1, `--ls: var(--tr-tight); letter-spacing: var(--ls); padding-right: calc(var(--ls) * -1)`, tabular-nums, nowrap.
- `.rstats` → `.srow { grid-template-columns: 1fr auto 1fr; align-items: center; gap: 3cqw }`(border-top, padding-top 그대로). `.rstat.rt { text-align: right; grid-column: 3 }`(끝 화면에서 .play가 빠져도 정렬 유지). `.rstat.tot` 삭제.
- `.rnext`, `.back`: `height: calc(var(--band) + var(--bandpad))`, 아래 padding `var(--bandpad)`.
- `.pz`, `.pause` 블록 삭제.
- 숫자 크기(×1.25 유지):
  ```scss
  font-size: calc(min(86cqw, 39cqh) * var(--k));
  &.long  { font-size: calc(min(51cqw, 30cqh) * var(--k)); }
  &.xlong { font-size: calc(min(39cqw, 24cqh) * var(--k)); }
  ```
  65% 폭 추정: 2자리 ≈0.77em, m:ss ≈1.30em, mm:ss ≈1.68em, 쓸 수 있는 폭 88cqw. 375×667이 가장 빡빡해 2자리 cqh 상한 42→39. 측정해서 폭 96% 초과나 높이 넘침이면 계수를 1씩 내린다.

## Task 5. 개발 서버 측정 (필수)
`http://localhost:5180/timer-for-hwang/` 같은 origin 탭에 iframe 360×740, 390×844, 375×667. safe-area는 `.run` 인라인 변수로 흉내(390×844: `--safe-t: 47px; --safe-b: 34px`, 375×667: `--safe-t: 20px`). 2자리, m:ss, mm:ss 각각 `.rnum` width/height, `.numwrap` height, `.rbody` 쓸 수 있는 폭을 재서 `width ≤ 폭`, `height ≤ numwrap`을 표로 보고. 멈춤 칩 위치와 끝 화면 땡도 확인.

## Task 6. 설계 문서
`docs/superpowers/specs/2026-11-04-ttaeng-design.md`: §3.6 그림(WORK/운동 + [↺][⏭][■] / 큰 숫자 / 전체 남은 시간 / 남은 세트·[▶/Ⅱ]·남은 라운드 / NEXT), 숫자 크기 식, NEXT 띠(화면 8%, 아래 여백 safe-area 절반), 끝 화면(버튼 사라짐, 전체·세트·라운드 0), 일시정지 단락(재생 버튼으로만, 덮개 없음, 숫자 32% + PAUSED 칩, 위 작은 버튼 언제든, 멈춘 상태에서 처음부터·다음 단계면 다시 달림, aria-label만, 채움·모서리 0), §4 글꼴 폭 65%.

## 자주 틀리는 지점
- 클릭 뒤 `await trigger` 후 `find`를 다시 부른다(aria-label이 바뀐다).
- `.chip`은 v-if.
- `.srow .rt { grid-column: 3 }` 필수.
- `--bandpad`, `--safe-t/b`는 `.run`에 정의하고 측정할 때도 거기서 덮어쓴다.
- 버튼을 `text()`로 찾지 않는다.
- 글꼴 원본은 호스트 node_modules에 없다. named volume을 마운트한다.
