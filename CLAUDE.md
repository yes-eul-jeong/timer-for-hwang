# 땡 (timer-for-hwang)

황승하 선수용 인터벌 타이머 PWA. Vue 3 + Vite + TypeScript, GitHub Pages 배포.

- 확정 설계: `docs/superpowers/specs/2026-11-04-ttaeng-design.md` (기획 초안보다 우선)
- 화면 프로토타입: https://claude.ai/artifact/EzdtfWv3x5sZgiaNVg2i1s
- 디자인 토큰 원본: `/Users/apple/yes-eul/09. gallery/site/src/styles/_tokens.scss`

## Node 명령은 전부 Docker 안에서

로컬에 Node가 없다. 호스트에서 `node`, `npm`, `npx`를 실행하지 않는다.

```
docker compose -f docker/compose.yml up -d dev          # 개발 서버 http://localhost:5180/timer-for-hwang/
docker compose -f docker/compose.yml run --rm app <명령>  # npm test, npm run build, npm i <패키지>
docker compose -f docker/compose.yml down               # 정지
```

- 호스트 5173은 다른 프로젝트가 쓰고 있어서 호스트 5180 → 컨테이너 5173으로 연결한다.
- `node_modules`는 named volume에 있다. 호스트에는 없다.
