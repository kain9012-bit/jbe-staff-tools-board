# 데이터 도구실 서버판 — 화면 + API + 파일 + DB(SQLite)를 한 컨테이너로
#
# 만들기(저장소 폴더에서)
#   1) npm run build:server                      ← 화면을 dist-server 로 빌드
#   2) docker build -t jbe-data-tools:1.0 .
#   3) docker save jbe-data-tools:1.0 -o jbe-data-tools-1.0.tar   ← 담당자에게 줄 파일
# 실행 방법은 server/README-서버.md
#
# 실행 이미지에는 외부 패키지가 없고(Node 내장 기능만), 바깥 인터넷에 접속하지 않음
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app/dist-server \
    SEED_DIR=/app/seed \
    AUTH_MODE=dev \
    OPS_PASSWORD=test1234
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY --chown=node:node server ./server
COPY --chown=node:node dist-server ./dist-server
COPY --chown=node:node server/seed/payload.json ./seed/payload.json
COPY --chown=node:node src/data/summaries.json src/data/external-tools.json src/data/official-meta.json ./seed/
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.mjs"]
