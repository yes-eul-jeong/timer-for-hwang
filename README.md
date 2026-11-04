# 땡

인터벌 트레이닝을 위한 타이머. 홈 화면에 추가해서 쓰는 웹앱(PWA)이다.

## 개발

Node는 Docker 컨테이너 안에서만 실행한다.

```
docker compose -f docker/compose.yml build
docker compose -f docker/compose.yml run --rm app npm ci
docker compose -f docker/compose.yml up -d dev
```

http://localhost:5180/timer-for-hwang/

테스트와 빌드:

```
docker compose -f docker/compose.yml run --rm app npm test
docker compose -f docker/compose.yml run --rm app npm run build
```

## 배포

`main`에 푸시하면 GitHub Actions가 빌드해서 GitHub Pages에 올린다.
저장소 Settings → Pages → Source를 "GitHub Actions"로 설정해야 한다.
