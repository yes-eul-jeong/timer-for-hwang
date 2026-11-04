FROM node:22-bookworm-slim

# git: 일부 패키지 설치와 버전 정보 조회에 필요
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# node_modules 는 named volume 에 둔다.
# 볼륨이 처음 만들어질 때 이 디렉터리의 소유권(node)을 이어받는다.
RUN mkdir -p /app/node_modules && chown -R node:node /app

USER node
