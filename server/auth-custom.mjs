/**
 * 통합인증 연동 자리 — AUTH_MODE=custom 일 때만 쓰임.
 * 통합인증 규격(SAML·OAuth/OIDC·자체 토큰 등)을 받으면 아래 세 함수만 채우면 됨.
 * 보기·내려받기는 로그인 없이 되므로, 여기서는 '쓰기'를 하려는 사람을 확인하는 일만 함.
 *
 * 돌려줄 사용자 형식: { id: '고유번호', name: '홍길동', org: '○○초등학교' }
 */

/**
 * 로그인 시작 — 사용자를 통합인증 로그인 화면으로 보냄.
 * GET /auth/start?next=/돌아갈/주소
 */
export async function start(req, res, next) {
  // 예) res.writeHead(302, { Location: `${process.env.SSO_AUTHORIZE_URL}?client_id=...&redirect_uri=...&state=${encodeURIComponent(next)}` });
  res.writeHead(501, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('통합인증 연동 전입니다. server/auth-custom.mjs 의 start()를 채워 주세요.');
}

/**
 * 로그인 돌아옴 — 통합인증이 돌려준 값을 검증하고 사용자 정보를 돌려줌.
 * GET /auth/callback
 * 성공하면 { user: {id,name,org}, next: '/돌아갈/주소' }, 실패하면 null
 */
export async function callback(req) {
  return null;
}

/**
 * (선택) 요청마다 사용자를 알아내는 방식이면 여기서. 예) 통합인증 쿠키·토큰 확인
 * 쓰지 않으면 null — 로그인 뒤에는 이 서버의 세션 쿠키로 확인함
 */
export async function userFromRequest(req) {
  return null;
}
