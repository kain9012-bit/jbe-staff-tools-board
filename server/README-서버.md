# 데이터 도구실 서버판 — 설치·운영 안내

교육데이터 허브 「데이터 도구실」(업무경감 도구 모음)을 내부 서버에서 돌리는 도커 이미지.

- 화면 + API + 파일 저장 + DB(SQLite)가 컨테이너 하나에 모두 들어 있음
- 실행 중에는 바깥 인터넷에 접속하지 않음. 화면의 JS·CSS·서체도 이 서버에서 제공
- 조회수·조회 추이·등록·검수·댓글·후기·도구 요청을 모두 이 서버가 직접 처리. 따로 도는 수집기는 없음
- 이 이미지에는 Node.js 22 기본 기능만 들어 있음. 외부 npm 패키지 없음

---

## 1. 받는 파일

| 파일 | 내용 |
|---|---|
| `jbe-data-tools-1.0.tar` | 도커 이미지 |
| `README-서버.md` | 이 문서 |

## 2. 설치·실행

```bash
# 이미지 불러오기
docker load -i jbe-data-tools-1.0.tar

# 실행 (8080 포트, 자료는 /srv/data-tools 에 저장)
docker run -d --name data-tools --restart unless-stopped \
  -p 8080:8080 \
  -v /srv/data-tools:/data \
  -e SESSION_SECRET='임의의 긴 문자열' \
  jbe-data-tools:1.0
```

- `/srv/data-tools` 폴더는 미리 만들고 컨테이너 사용자(uid 1000)가 쓸 수 있게 함: `sudo mkdir -p /srv/data-tools && sudo chown 1000:1000 /srv/data-tools`
- 확인: `curl http://localhost:8080/healthz` → `{"ok":true}`
- 기록 보기: `docker logs data-tools`
- 처음 실행할 때 기존 게시판 자료(도구 글·조회 이력·댓글·요약)를 한 번만 DB로 옮김. 그 뒤로는 다시 옮기지 않음

## 3. 설정값(환경 변수)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8080 | 컨테이너 안 포트 |
| `DATA_DIR` | /data | DB·올린 파일 저장 위치. 반드시 볼륨으로 연결 |
| `SESSION_SECRET` | (없음) | 로그인 쿠키 서명용 비밀값. **꼭 지정**. 없으면 재시작할 때마다 로그인이 풀림 |
| `AUTH_MODE` | dev | 로그인 방식. 아래 4절 참고 |
| `OPS_PASSWORD` | test1234 | dev 방식에서 운영자(정책기획과 빅데이터담당) 로그인 암호. 바꾸려면 `-e OPS_PASSWORD='새 암호'` |
| `OPS_USERS` | (없음) | 운영자 사용자 id 목록. 쉼표로 구분. header·custom 방식에서 사용 |
| `MAX_UPLOAD_MB` | 100 | 올릴 수 있는 파일 하나의 최대 크기 |
| `COOKIE_SECURE` | 0 | HTTPS로만 서비스할 때 1 |

## 4. 로그인(통합인증 연동)

보기·검색·내려받기는 로그인 없이 됨. 도구 등록·댓글·후기·요청처럼 글을 남길 때만 로그인.

| AUTH_MODE | 방식 |
|---|---|
| `dev` | 통합인증 연동 전 방식. 소속·이름을 입력해 들어감. 운영자는 `OPS_PASSWORD` 입력 |
| `header` | 통합인증 게이트웨이(리버스 프록시)가 확인한 사용자 정보를 요청 머리글로 넘기는 방식 |
| `custom` | `server/auth-custom.mjs` 에 통합인증 규격(SAML·OAuth 등)대로 함수를 채워 연동 |

### header 방식 설정

| 이름 | 기본값 | 설명 |
|---|---|---|
| `AUTH_HEADER_ID` | x-auth-user-id | 사용자 고유 id 머리글 |
| `AUTH_HEADER_NAME` | x-auth-user-name | 이름 (URL 인코딩 가능) |
| `AUTH_HEADER_ORG` | x-auth-user-org | 소속 (URL 인코딩 가능) |
| `LOGIN_URL` | (없음) | 통합인증 로그인 주소. 로그인 단추가 이 주소로 감(`?next=` 붙음) |
| `LOGOUT_URL` | (없음) | 통합인증 로그아웃 주소 |

> **주의:** header 방식은 반드시 게이트웨이 뒤에서만 운영. 사용자가 이 머리글을 직접 보내지 못하도록 게이트웨이가 들어오는 같은 이름 머리글을 지우고 다시 넣어야 함. 컨테이너 포트를 게이트웨이 외에는 열지 않음.

## 5. 백업·복구

- 백업 대상: 볼륨 폴더 전체(`/srv/data-tools`) — `tools.db`(+ `tools.db-wal`, `tools.db-shm`)와 `files/`
- 안전한 백업: `docker stop data-tools` → 폴더 복사 → `docker start data-tools`
- 멈추지 않고 DB만: `docker exec data-tools node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/tools.db').exec(\"VACUUM INTO '/data/backup.db'\")"` 후 `backup.db`와 `files/` 복사
- 복구: 컨테이너를 멈추고 폴더를 되돌린 뒤 다시 시작

## 6. 업데이트(새 버전 이미지)

```bash
docker load -i jbe-data-tools-1.1.tar
docker stop data-tools && docker rm data-tools
docker run -d --name data-tools ... jbe-data-tools:1.1   # 2절과 같은 옵션
```

- 자료는 볼륨에 있어 그대로 이어짐. DB 구조 변경은 시작할 때 자동 반영

## 7. 보안 참고

- 올린 파일은 항상 '내려받기'로만 제공(브라우저 안에서 실행되지 않음)
- 검수 중인 파일은 올린 사람·글 수정 권한자·운영자만 받을 수 있음
- 화면은 이 서버의 파일만 불러오도록 제한(Content-Security-Policy)
- 다른 사이트에서 보낸 쓰기 요청은 거절
- 운영 기록(등록·게시·반려·전환·권한 변경 등)은 DB `audit` 표에 남음
- 검색 엔진 수집 차단(`robots.txt`)

## 8. 문의

정책기획과 빅데이터담당

---

## (만드는 사람용) 이미지 만들기

저장소 폴더에서, 인터넷이 되는 PC(도커 설치)에서:

```powershell
npm ci
npm run build:server
docker build -t jbe-data-tools:1.0 .
docker save jbe-data-tools:1.0 -o jbe-data-tools-1.0.tar
```

- 기존 게시판 자료 이관 파일: `server/seed/payload.json`(기존 화면의 `/api/data` 응답), `src/data/summaries.json`, `src/data/external-tools.json`, `src/data/official-meta.json`
- 이관 자료를 최신으로 바꾸려면 이미지를 만들기 전에 `payload.json`을 새로 받아 둠. 단, 이미 운영 중인 서버에는 다시 이관되지 않음(처음 한 번만)
- 개발: `npm run start:server`(8090 등 `PORT` 지정) + `npm run dev:server`
