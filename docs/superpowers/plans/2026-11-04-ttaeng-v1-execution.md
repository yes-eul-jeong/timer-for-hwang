# 땡 v1 실행 보충 지침

`2026-11-04-ttaeng-v1.md`를 실행할 때 함께 따른다. 이 문서와 계획 문서가 다르면 이 문서를 따른다.
`$DC` = `docker compose -f docker/compose.yml run --rm app`. 호스트에서 node/npm/npx 금지.

## 공통

- 서브에이전트는 커밋하지 않는다. 메인이 검증 후 커밋한다.
- 테스트를 먼저 쓰고 실행해서 실패를 확인한다. **보고에 실패 출력의 마지막 3줄을 원문 그대로 붙인다.** 없으면 메인은 그 배치를 통과시키지 않는다(수정 요청 재작업에도 적용).
- 맡은 배치의 허용 파일 밖은 수정하지 않는다.
- 모든 테스트 파일 맨 위에 `import { test, expect, vi, describe, beforeEach } from 'vitest'`처럼 쓰는 것만 import한다(전역 없음).
- `verbatimModuleSyntax`: 타입은 `import type`, 섞을 때는 `import { buildSequence, type Step }`.
- `noUncheckedIndexedAccess`: 배열 인덱스·`find` 결과는 undefined 가드 또는 `!`.
- 배치 끝에 `$DC npm run typecheck`와 해당 테스트가 통과해야 한다.

## 계획 수정사항

1. 프리셋 정렬: `loadTimersWithSeed`는 i번째 프리셋 `createdAt`을 `now + i ms`로 만든다. `list()`는 `createdAt` 오름차순, 같으면 `id`로 보조 정렬.
2. Vue reactive 객체를 IndexedDB에 넣으면 DataCloneError. `store.saveTimer`, `importBackup` 등 저장 전에 `{ ...toRaw(t) }`로 평범한 객체로 만든다.
3. `summarize` 예시 "운동 3:00 · 휴식 1:00 · 3세트"의 입력은 `{ ...base, work: 180, rest: 60, sets: 3 }`.
4. `createRunClock().skip`은 일시정지를 유지한다. `useRun.skip()`은 clock skip 후 재개하고 상태를 즉시 다시 계산한다. `toggle`, `restart`도 즉시 재계산(rAF 기다리지 않음).
5. 음성 버퍼 로드: `unlock()`에서 fetch·decode가 끝나기 전에 `schedule`이 불릴 수 있다. 플레이어는 마지막 `schedule(cues, elapsedNow, mode)` 인자와 그때 `ctx.currentTime`을 기억하고, 로드가 끝나면 지난 시간을 보정해 다시 예약한다.
6. `types.ts`에 `export const DEFAULT_SETTINGS: Settings = { sound: 'beep', flash: true }`. prefs·backup이 이걸 쓴다.
7. `db.ts`에 `export function createMemoryRepo(): TimerRepo` (volatile: true)와 `export function newId(): string` (`crypto.randomUUID`가 없으면 `crypto.getRandomValues`로 UUID v4 생성. http LAN 주소에서는 randomUUID가 없다).
8. Task 6에 `src/App.test.ts` 추가(ready일 때 BottomNav 없음, list일 때 있음).
9. `main.ts`의 `store.init()` + `requestPersist()`는 Task 6에서 한다: `useAppStore().init().finally(() => { createApp(App).mount('#app'); void requestPersist() })`.
10. ReadyView 시작 핸들러는 Task 6에서 처음부터 `void getAudioPlayer().unlock(); store.startRun()`. 테스트는 `vi.mock('../audio/player', () => ({ getAudioPlayer: () => ({ unlock: vi.fn(async () => {}), schedule: vi.fn(), cancel: vi.fn() }) }))`처럼 팩토리를 준다.
11. `RunView`는 `defineProps<{ deps?: Partial<RunDeps> }>()`로 의존성 주입. 루트에 `data-phase`, `data-index` 속성.
12. 숫자 크기 3단계: 두 자리 이하 86cqw, `m:ss`(4글자) 54cqw, `mm:ss`(600초 이상) 43cqw (2026-11-04 글꼴 교체 때 변경, 처음 값은 72/52/40). 클래스 `long`(≥60), `xlong`(≥600).
13. 프로토타입의 `--font-sans`는 이 프로젝트에서 `--font-num`. 프로토타입 숫자 크기 대신 12번 값.
14. AppStore에 `state.installHintSeen: boolean`, `dismissInstallHint(): void` (Task 10).
15. 아이콘은 `public/`에 생성해도 된다(`public/icons/` 고집하지 않음).
16. (변경됨) 글꼴은 `2026-11-04-ttaeng-font-sound.md`를 따른다. 숫자 TtaengNum, 영문·한글 SUIT. Barlow Condensed와 Pretendard 가변 글꼴은 뺐다.
17. (해당 없음) Pretendard 가변 글꼴을 뺐으므로 workbox 크기 한도 조정은 필요 없다.
18. `_tokens.scss` `$color`에 `scrim: rgba(10,10,10,.93)`, `on-accent-sub: rgba(0,0,0,.62)` 추가(Task 6). 직접 색 기입 금지.

## 자주 틀리는 지점

- iOS 오디오 unlock: 클릭 핸들러에서 동기로 `new AudioContext()`와 `resume()`을 먼저 부르고, 그 뒤에 await. `unlock`은 reject하지 않는다(jsdom에는 AudioContext 없음).
- `useRun`은 `performance.now`, `requestAnimationFrame`을 직접 부르지 않고 deps만 쓴다. 테스트는 `effectScope().run(() => useRun(...))`.
- 시작 시 `cuesFrom(seq, -1e-6)`. skip으로 경계에 정확히 떨어진 전환음은 제외(의도된 동작).
- visibility 테스트: `Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })` 후 이벤트. 일시정지 중이면 재예약 안 함. 기존 wakeLock release 후 재요청.
- fake-indexeddb: `beforeEach`에서 `globalThis.indexedDB = new IDBFactory()` (`import { IDBFactory } from 'fake-indexeddb'`).
- jsdom은 SFC CSS·cqw를 계산하지 않는다. 크기는 클래스·속성으로 테스트하고 넘침은 개발 서버에서 눈으로 본다.
- `state`는 `shallowRef<RunState>`, 매 프레임 새 객체. 번쩍임은 `flashKey`를 `:key`로 쓰는 오버레이, 애니메이션 `--d-base`.
- 편집 저장 후 ready로 갈 때 `openReady`로 `today` 갱신. 열린 타이머를 삭제하면 `currentId = null`.
- 모서리 0, 글로우·그라데이션 금지, `alert`/`confirm`/`prompt` 금지.
