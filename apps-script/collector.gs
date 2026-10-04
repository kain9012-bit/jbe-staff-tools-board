/**
 * 전북교육청 「교직원 제작 도구」 일별 조회수 수집기
 *
 * 역할
 * - 매시간 게시판 전체 페이지 수집
 * - 새 게시글 자동 발견
 * - 새 도구 발견 시 작성자만 상세페이지에서 1회 수집
 * - 일별 누적조회수 스냅샷 저장
 * - 같은 날 다시 실행하면 그날 조회수 기록 갱신
 * - 댓글 수: 목록 제목의 "(댓글 : N)"에서 추출 (상세페이지 접속 없음)
 * - 댓글 내용: 목록의 댓글 수가 직전 수집 때와 달라진 글만 상세페이지에서 최신 10개 수집해 「댓글목록」에 누적
 *   (2쪽 이후 댓글은 로그인해야 보이므로, 매시간 누적하는 방식으로 대신함)
 *
 * 이 스크립트는 "순위"를 계산하지 않습니다.
 * 순위는 나중에 조회이력을 이용해 게시글에서 별도로 계산합니다.
 */

const CONFIG = {
  BASE_URL: 'https://www.jbe.go.kr',
  BOARD_ID: 'BBS_0000683',
  MENU_CD: 'DOM_000000106011002002',

  PAGE_SIZE: 10,
  TIMEZONE: 'Asia/Seoul',

  SHEET_TOOLS: '도구목록',
  SHEET_HISTORY: '조회이력',
  SHEET_LOG: '수집로그',
  SHEET_COMMENTS: '댓글목록',

  // 상세페이지에서 로그인 없이 보이는 댓글 수 (최신순 1쪽)
  COMMENTS_FIRST_PAGE: 10,

  TRIGGER_FUNCTION: 'collectDailyViews'
};


/* =========================================================
 * 1. 최초 설정
 * ========================================================= */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);

  ensureSheets_();
  createHourlyTrigger_();

  // 최초 1회 즉시 수집
  collectDailyViews();
}


/**
 * 매시간 1회 실행
 *
 * - 기존 collectDailyViews 트리거가 있으면 모두 삭제
 * - everyHours(1) 트리거 1개만 생성
 * - 시간대는 기존대로 Asia/Seoul 유지
 *
 * Apps Script 시간 기반 트리거는 매시 정각에 정확히 실행되는 방식이 아니라
 * 트리거가 생성된 분 단위를 기준으로 대략 1시간 간격으로 실행됩니다.
 */
function createHourlyTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === CONFIG.TRIGGER_FUNCTION) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(CONFIG.TRIGGER_FUNCTION)
    .timeBased()
    .everyHours(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
}


/* =========================================================
 * 2. 메인 수집
 * ========================================================= */

function collectDailyViews() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    throw new Error('다른 수집 작업이 실행 중입니다.');
  }

  const startedAt = new Date();
  const dateKey = formatDateKey_(startedAt);

  let totalCount = 0;
  let totalPages = 0;
  let normalPostCount = 0;
  let newToolCount = 0;
  let authorFetchedCount = 0;
  let commentPostFetchedCount = 0;
  let newCommentCount = 0;

  try {
    ensureSheets_();

    const result = fetchAllBoardPosts_();

    totalCount = result.totalCount;
    totalPages = result.totalPages;
    normalPostCount = result.posts.length;

    const masterResult = upsertToolMaster_(result.posts, dateKey);

    newToolCount = masterResult.newToolCount;
    authorFetchedCount = masterResult.authorFetchedCount;

    upsertDailyHistory_(result.posts, dateKey, startedAt);

    // 댓글 수집 실패가 조회수 수집을 망치지 않도록 분리
    try {
      const commentResult = syncComments_(
        result.posts,
        masterResult.prevCommentCountBySid,
        masterResult.authorBySid,
        dateKey
      );
      commentPostFetchedCount = commentResult.fetchedPostCount;
      newCommentCount = commentResult.newCommentCount;
    } catch (commentError) {
      console.log('댓글 수집 실패: ' + commentError);
    }

    appendLog_({
      runAt: startedAt,
      dateKey: dateKey,
      status: '성공',
      totalCount: totalCount,
      normalPostCount: normalPostCount,
      totalPages: totalPages,
      newToolCount: newToolCount,
      authorFetchedCount: authorFetchedCount,
      commentPostFetchedCount: commentPostFetchedCount,
      newCommentCount: newCommentCount,
      message: ''
    });

    SpreadsheetApp.flush();

  } catch (error) {
    appendLog_({
      runAt: startedAt,
      dateKey: dateKey,
      status: '실패',
      totalCount: totalCount,
      normalPostCount: normalPostCount,
      totalPages: totalPages,
      newToolCount: newToolCount,
      authorFetchedCount: authorFetchedCount,
      commentPostFetchedCount: commentPostFetchedCount,
      newCommentCount: newCommentCount,
      message: String(error && error.stack ? error.stack : error)
    });

    throw error;

  } finally {
    lock.releaseLock();
  }
}


/* =========================================================
 * 3. 게시판 전체 수집
 * ========================================================= */

function buildListUrl_(page) {
  return CONFIG.BASE_URL + '/board/list.jbe'
    + '?boardId=' + encodeURIComponent(CONFIG.BOARD_ID)
    + '&listRow=' + CONFIG.PAGE_SIZE
    + '&listCel=1'
    + '&menuCd=' + encodeURIComponent(CONFIG.MENU_CD)
    + '&paging=ok'
    + '&searchType=DATA_TITLE'
    + '&searchOperation=AND'
    + '&startPage=' + page;
}


function fetchAllBoardPosts_() {
  const firstHtml = fetchHtml_(buildListUrl_(1));
  const paging = parsePagingInfo_(firstHtml);

  if (!paging.totalPages || paging.totalPages < 1) {
    throw new Error('게시판 전체 페이지 수를 확인하지 못했습니다.');
  }

  const posts = [];
  const seen = {};

  parseListPosts_(firstHtml).forEach(function(post) {
    if (!seen[post.dataSid]) {
      seen[post.dataSid] = true;
      posts.push(post);
    }
  });

  for (let page = 2; page <= paging.totalPages; page++) {
    const html = fetchHtml_(buildListUrl_(page));

    parseListPosts_(html).forEach(function(post) {
      if (!seen[post.dataSid]) {
        seen[post.dataSid] = true;
        posts.push(post);
      }
    });

    Utilities.sleep(120);
  }

  return {
    totalCount: paging.totalCount,
    totalPages: paging.totalPages,
    posts: posts
  };
}


/**
 * 예: 총 13건 (2/2 페이지)
 */
function parsePagingInfo_(html) {
  const match = html.match(
    /<p\b[^>]*class=["'][^"']*\bbbs_total\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
  );

  if (!match) {
    throw new Error('bbs_total 영역을 찾지 못했습니다.');
  }

  const text = cleanText_(match[1]);

  const info = text.match(
    /총\s*([0-9,]+)\s*건\s*\(\s*([0-9]+)\s*\/\s*([0-9]+)\s*페이지\s*\)/
  );

  if (!info) {
    throw new Error('게시판 총건수/페이지수 형식을 해석하지 못했습니다: ' + text);
  }

  return {
    totalCount: parseInt(info[1].replace(/,/g, ''), 10) || 0,
    currentPage: parseInt(info[2], 10) || 1,
    totalPages: parseInt(info[3], 10) || 1
  };
}


/**
 * 목록에서 공지를 제외한 일반 도구 게시글만 추출
 */
function parseListPosts_(html) {
  const posts = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1];

    // 공지 제외
    if (/<td\b[^>]*class=["'][^"']*\bnotice\b[^"']*["']/i.test(row)) {
      continue;
    }

    const titleCell = row.match(
      /<td\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i
    );

    if (!titleCell) continue;

    const anchor = titleCell[1].match(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
    );

    if (!anchor) continue;

    const href = decodeHtml_(anchor[1]);
    // 목록 제목 끝에 "(댓글 : N)"이 붙어 나옴 → 도구명과 댓글 수로 분리
    const rawTitle = cleanText_(anchor[2]);
    const commentMatch = rawTitle.match(/\(\s*댓글\s*:\s*([0-9,]+)\s*\)\s*$/);
    const commentCount = commentMatch
      ? (parseInt(commentMatch[1].replace(/,/g, ''), 10) || 0)
      : 0;
    const title = rawTitle
      .replace(/\s*\(\s*댓글\s*:\s*[0-9,]+\s*\)\s*$/, '')
      .trim();

    const sidMatch = href.match(/[?&]dataSid=([0-9]+)/i);

    if (!sidMatch) continue;

    const viewsText = extractCellByHeader_(row, '조회수');
    const createdText = extractCellByHeader_(row, '작성일');
    const usePurposeText = extractCellByHeader_(row, '사용목적');
    const targetInstitutionText = extractCellByHeader_(row, '적용기관');

    posts.push({
      dataSid: sidMatch[1],
      title: title,
      url: absoluteUrl_(href),
      createdDate: normalizeBoardDate_(createdText),
      views: parseInt(
        String(viewsText || '').replace(/[^0-9]/g, ''),
        10
      ) || 0,
      commentCount: commentCount,
      usePurpose: cleanText_(usePurposeText),
      targetInstitution: cleanText_(targetInstitutionText)
    });
  }

  return posts;
}


/* =========================================================
 * 4. 도구목록
 * ========================================================= */

/**
 * 도구목록
 *
 * dataSid
 * 도구명
 * 게시글URL
 * 작성일
 * 작성자
 * 현재누적조회수
 * 최초수집일
 * 최종수집일
 * 게시상태
 * 사용목적
 * 적용기관
 * 댓글수
 *
 * 작성자는 신규 도구 발견 시 1회만 상세페이지에서 가져옵니다.
 * 사용목적/적용기관은 목록 페이지에서 매 수집 시 갱신합니다.
 */
function upsertToolMaster_(posts, dateKey) {
  const sheet = getSheet_(CONFIG.SHEET_TOOLS);
  const headers = getToolHeaders_();
  const lastRow = sheet.getLastRow();

  let values = [];

  if (lastRow >= 2) {
    values = sheet
      .getRange(2, 1, lastRow - 1, headers.length)
      .getValues();
  }

  const rowBySid = {};

  values.forEach(function(row, index) {
    const sid = String(row[0] || '').trim();

    if (sid) {
      rowBySid[sid] = index + 2;
    }
  });

  let newToolCount = 0;
  let authorFetchedCount = 0;
  const seenNow = {};
  const prevCommentCountBySid = {};
  const authorBySid = {};

  posts.forEach(function(post) {
    seenNow[post.dataSid] = true;

    const existingRow = rowBySid[post.dataSid];

    if (!existingRow) {
      // 신규 글일 때만 상세페이지 접속
      const author = fetchAuthorSafely_(post.url);

      if (author) {
        authorFetchedCount++;
      }

      sheet.appendRow([
        post.dataSid,
        post.title,
        post.url,
        post.createdDate,
        author,
        post.views,
        dateKey,
        dateKey,
        '게시중',
        post.usePurpose || '',
        post.targetInstitution || '',
        post.commentCount
      ]);

      rowBySid[post.dataSid] = sheet.getLastRow();
      authorBySid[post.dataSid] = author;
      newToolCount++;

    } else {
      const existing = sheet
        .getRange(existingRow, 1, 1, headers.length)
        .getValues()[0];

      let author = String(existing[4] || '').trim();

      // 직전 수집 때의 댓글 수 (빈칸이면 이번이 첫 댓글 수집)
      prevCommentCountBySid[post.dataSid] = existing[11];

      // 최초 작성자 수집이 실패한 경우에만 다음날 재시도
      if (!author) {
        author = fetchAuthorSafely_(post.url);

        if (author) {
          authorFetchedCount++;
        }
      }

      sheet
        .getRange(existingRow, 1, 1, headers.length)
        .setValues([[
          post.dataSid,
          post.title,
          post.url,
          post.createdDate,
          author,
          post.views,
          existing[6] || dateKey,
          dateKey,
          '게시중',
          post.usePurpose || '',
          post.targetInstitution || '',
          post.commentCount
        ]]);

      authorBySid[post.dataSid] = author;
    }
  });

  // 이전에 있던 게시글이 현재 전체 게시판에서 사라진 경우
  // 데이터는 삭제하지 않고 상태만 미확인으로 변경
  Object.keys(rowBySid).forEach(function(sid) {
    if (!seenNow[sid]) {
      sheet.getRange(rowBySid[sid], 9).setValue('미확인');
    }
  });

  return {
    newToolCount: newToolCount,
    authorFetchedCount: authorFetchedCount,
    prevCommentCountBySid: prevCommentCountBySid,
    authorBySid: authorBySid
  };
}


/* =========================================================
 * 5. 작성자 수집
 * ========================================================= */

function fetchAuthorSafely_(url) {
  try {
    const html = fetchHtml_(url);
    return parseAuthor_(html);

  } catch (error) {
    console.log('작성자 수집 실패: ' + url + ' / ' + error);
    return '';
  }
}


function parseAuthor_(html) {
  const patterns = [
    /<(?:td|dd|div|span)\b[^>]*data-cell-header=["'][^"']*(?:작성자|등록자)[^"']*["'][^>]*>([\s\S]*?)<\/(?:td|dd|div|span)>/i,

    /<th\b[^>]*>\s*(?:작성자|등록자)\s*<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i,

    /<dt\b[^>]*>\s*(?:작성자|등록자)\s*<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = html.match(patterns[i]);

    if (match) {
      const author = cleanAuthorText_(match[1]);

      if (author) return author;
    }
  }

  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:td|th|dd|dt|li|div|p|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const plain = decodeHtml_(text)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n');

  const fallback = plain.match(
    /(?:작성자|등록자)\s*[:：]?\s*([^\n\r|]{1,60}?)(?=\s*(?:작성일|등록일|조회수|첨부파일|파일|$))/
  );

  if (fallback) {
    return cleanAuthorText_(fallback[1]);
  }

  return '';
}


function cleanAuthorText_(value) {
  let text = cleanText_(value);

  text = text
    .replace(/^(작성자|등록자)\s*[:：]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || text.length > 60) {
    return '';
  }

  return text;
}


/* =========================================================
 * 6. 조회이력
 * ========================================================= */

/**
 * 조회이력
 *
 * 기준일 | 수집시각 | dataSid | 누적조회수 | 댓글수
 *
 * 같은 날짜 + 같은 dataSid가 이미 존재하면 새 행을 만들지 않고 갱신
 */
function upsertDailyHistory_(posts, dateKey, collectedAt) {
  const sheet = getSheet_(CONFIG.SHEET_HISTORY);
  const headers = getHistoryHeaders_();

  const lastRow = sheet.getLastRow();
  const rowByKey = {};

  if (lastRow >= 2) {
    const values = sheet
      .getRange(2, 1, lastRow - 1, headers.length)
      .getValues();

    values.forEach(function(row, index) {
      const rowDate = normalizeDateCellToKey_(row[0]);
      const sid = String(row[2] || '').trim();

      if (rowDate && sid) {
        rowByKey[rowDate + '|' + sid] = index + 2;
      }
    });
  }

  const appendRows = [];

  posts.forEach(function(post) {
    const key = dateKey + '|' + post.dataSid;
    const existingRow = rowByKey[key];

    const row = [
      dateKey,
      collectedAt,
      post.dataSid,
      post.views,
      post.commentCount
    ];

    if (existingRow) {
      sheet
        .getRange(existingRow, 1, 1, headers.length)
        .setValues([row]);
    } else {
      appendRows.push(row);
    }
  });

  if (appendRows.length) {
    sheet
      .getRange(
        sheet.getLastRow() + 1,
        1,
        appendRows.length,
        headers.length
      )
      .setValues(appendRows);
  }
}


/* =========================================================
 * 6-1. 댓글
 * ========================================================= */

/**
 * 댓글 수가 바뀐 글만 상세페이지를 열어 최신 댓글(1쪽)을 「댓글목록」에 반영
 *
 * 상세페이지를 여는 조건 (이것 하나뿐)
 * - 목록 제목의 댓글 수가 직전 수집 때와 다를 때
 *   (업그레이드 후 첫 실행은 직전 값이 빈칸 → 댓글 있는 글만 1회 수집)
 *
 * 상세페이지 접속이 실패하면 도구목록의 댓글수 칸을 비워 두어
 * 다음 실행 때 그 글만 다시 시도함
 *
 * 삭제 판정
 * - 댓글이 모두 1쪽에 보이는 글(10개 이하)만, 1쪽에 없어진 댓글을 '삭제됨'으로 표시
 */
function syncComments_(posts, prevCommentCountBySid, authorBySid, dateKey) {
  const sheet = getSheet_(CONFIG.SHEET_COMMENTS);
  const headers = getCommentHeaders_();
  const lastRow = sheet.getLastRow();

  const values = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
    : [];

  const rowByCid = {};

  values.forEach(function(row, index) {
    const sid = String(row[0] || '').trim();
    const cid = String(row[1] || '').trim();

    if (!sid || !cid) return;

    rowByCid[cid] = index + 2;
  });

  const appendRows = [];
  let fetchedPostCount = 0;
  let newCommentCount = 0;
  const failedSids = [];

  posts.forEach(function(post) {
    const sid = post.dataSid;
    const nowCount = post.commentCount || 0;
    const prevRaw = prevCommentCountBySid[sid];
    const prevCount = (prevRaw === '' || prevRaw === undefined || prevRaw === null)
      ? null
      : (parseInt(prevRaw, 10) || 0);
    const changed = prevCount === null ? nowCount > 0 : prevCount !== nowCount;

    if (!changed) return;

    let comments;

    try {
      comments = parseComments_(fetchHtml_(post.url), sid);
    } catch (error) {
      console.log('댓글 수집 실패: ' + post.url + ' / ' + error);
      failedSids.push(sid);
      return;
    }

    fetchedPostCount++;

    const makerName = extractPersonName_(authorBySid[sid] || '');
    const seen = {};

    comments.forEach(function(c) {
      seen[c.commentSid] = true;

      const isMaker = (makerName && c.writer === makerName) ? 'Y' : '';
      const existingRow = rowByCid[c.commentSid];

      if (existingRow) {
        const old = values[existingRow - 2];

        sheet
          .getRange(existingRow, 1, 1, headers.length)
          .setValues([[
            sid,
            c.commentSid,
            c.writer,
            c.date,
            safeCellText_(c.content),
            isMaker,
            old[6] || dateKey,
            dateKey,
            '게시중'
          ]]);

      } else {
        appendRows.push([
          sid,
          c.commentSid,
          c.writer,
          c.date,
          safeCellText_(c.content),
          isMaker,
          dateKey,
          dateKey,
          '게시중'
        ]);

        rowByCid[c.commentSid] = -1;
        newCommentCount++;
      }
    });

    // 모든 댓글이 1쪽에 보이는 경우에만 삭제 판정
    if (nowCount <= CONFIG.COMMENTS_FIRST_PAGE) {
      values.forEach(function(row, index) {
        if (
          String(row[0]) === sid
          && String(row[8]) === '게시중'
          && !seen[String(row[1])]
        ) {
          sheet.getRange(index + 2, 8, 1, 2).setValues([[dateKey, '삭제됨']]);
        }
      });
    }

    Utilities.sleep(150);
  });

  if (appendRows.length) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, appendRows.length, headers.length)
      .setValues(appendRows);
  }

  if (failedSids.length) {
    clearToolCommentCounts_(failedSids);
  }

  return {
    fetchedPostCount: fetchedPostCount,
    newCommentCount: newCommentCount
  };
}


/**
 * 댓글 수집에 실패한 글의 도구목록 댓글수 칸을 비움 → 다음 실행 때 재시도
 */
function clearToolCommentCounts_(sids) {
  const sheet = getSheet_(CONFIG.SHEET_TOOLS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  const col = getToolHeaders_().indexOf('댓글수') + 1;
  const sidValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const target = {};

  sids.forEach(function(sid) { target[sid] = true; });

  sidValues.forEach(function(row, index) {
    if (target[String(row[0]).trim()]) {
      sheet.getRange(index + 2, col).clearContent();
    }
  });
}


/**
 * 상세페이지 <ul id="commentPage"> 안의 댓글 파싱
 *
 * <li>
 *   <div>내용</div>
 *   <span><strong>이름</strong>&nbsp;&nbsp;2026-09-30</span>
 *   ... deleteComment.jbe?...&commentSid=1448 ...
 * </li>
 */
function parseComments_(html, dataSid) {
  const ul = html.match(
    /<ul\b[^>]*id=["']commentPage["'][^>]*>([\s\S]*?)<\/ul>/i
  );

  if (!ul) return [];

  const comments = [];
  const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

  let m;

  while ((m = liRegex.exec(ul[1])) !== null) {
    const li = m[1];

    const bodyMatch = li.match(/<div\b[^>]*>([\s\S]*?)<\/div>/i);
    const metaMatch = li.match(
      /<span\b[^>]*>\s*<strong\b[^>]*>([\s\S]*?)<\/strong>([\s\S]*?)<\/span>/i
    );

    if (!bodyMatch || !metaMatch) continue;

    const content = cleanMultilineText_(bodyMatch[1]);
    const writer = cleanText_(metaMatch[1]);
    const dateMatch = cleanText_(metaMatch[2]).match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : '';

    const sidMatch = li.match(/commentSid=([0-9]+)/i);

    // commentSid가 안 보이면 내용으로 대체 키 생성
    const commentSid = sidMatch
      ? sidMatch[1]
      : 'h' + hashText_(dataSid + '|' + writer + '|' + date + '|' + content);

    comments.push({
      commentSid: commentSid,
      writer: writer,
      date: date,
      content: content
    });
  }

  return comments;
}


/**
 * "군산여자상업고등학교(최현정)" → "최현정"
 */
function extractPersonName_(author) {
  const text = String(author || '').trim();
  const m = text.match(/\(([^()]+)\)\s*$/);

  return m ? m[1].trim() : text;
}


function cleanMultilineText_(htmlText) {
  return decodeHtml_(
    String(htmlText || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map(function(line) { return line.replace(/[ \t]+/g, ' ').trim(); })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


/**
 * =, +, -, @ 로 시작하면 시트가 수식으로 해석하므로 앞에 ' 를 붙임
 */
function safeCellText_(text) {
  const s = String(text || '');

  return /^[=+\-@]/.test(s) ? "'" + s : s;
}


function hashText_(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    text,
    Utilities.Charset.UTF_8
  );

  return bytes
    .map(function(b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); })
    .join('')
    .slice(0, 16);
}


/* =========================================================
 * 7. 시트 생성
 * ========================================================= */

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);

  ensureSheetWithHeaders_(
    CONFIG.SHEET_TOOLS,
    getToolHeaders_()
  );

  ensureSheetWithHeaders_(
    CONFIG.SHEET_HISTORY,
    getHistoryHeaders_()
  );

  ensureSheetWithHeaders_(
    CONFIG.SHEET_LOG,
    getLogHeaders_()
  );

  ensureSheetWithHeaders_(
    CONFIG.SHEET_COMMENTS,
    getCommentHeaders_()
  );

  formatSheets_();
}


function ensureSheetWithHeaders_(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  } else {
    const existingHeaders = sheet
      .getRange(1, 1, 1, headers.length)
      .getValues()[0];

    let different = false;

    for (let i = 0; i < headers.length; i++) {
      if (String(existingHeaders[i] || '') !== headers[i]) {
        different = true;
        break;
      }
    }

    if (different) {
      sheet
        .getRange(1, 1, 1, headers.length)
        .setValues([headers]);
    }
  }

  sheet.setFrozenRows(1);

  return sheet;
}


function formatSheets_() {
  const tools = getSheet_(CONFIG.SHEET_TOOLS);
  const history = getSheet_(CONFIG.SHEET_HISTORY);
  const log = getSheet_(CONFIG.SHEET_LOG);
  const comments = getSheet_(CONFIG.SHEET_COMMENTS);

  // 댓글 작성일·내용이 날짜/수식으로 바뀌지 않게 글자 형식 고정
  comments.getRange('A:F').setNumberFormat('@');

  tools.getRange('F:F').setNumberFormat('#,##0');

  history.getRange('B:B')
    .setNumberFormat('yyyy-mm-dd hh:mm:ss');

  history.getRange('D:D')
    .setNumberFormat('#,##0');

  log.getRange('A:A')
    .setNumberFormat('yyyy-mm-dd hh:mm:ss');

  tools.autoResizeColumns(1, getToolHeaders_().length);
  history.autoResizeColumns(1, getHistoryHeaders_().length);
  log.autoResizeColumns(1, getLogHeaders_().length);
  comments.autoResizeColumns(1, 4);
}


function getSheet_(name) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(name);

  if (!sheet) {
    throw new Error('시트를 찾지 못했습니다: ' + name);
  }

  return sheet;
}


function getToolHeaders_() {
  return [
    'dataSid',
    '도구명',
    '게시글URL',
    '작성일',
    '작성자',
    '현재누적조회수',
    '최초수집일',
    '최종수집일',
    '게시상태',
    '사용목적',
    '적용기관',
    '댓글수'
  ];
}


function getHistoryHeaders_() {
  return [
    '기준일',
    '수집시각',
    'dataSid',
    '누적조회수',
    '댓글수'
  ];
}


/**
 * 댓글목록
 *
 * 제작자답글: 댓글 작성자 이름이 도구 작성자 괄호 안 이름과 같으면 Y
 * 상태: 게시중 / 삭제됨
 */
function getCommentHeaders_() {
  return [
    'dataSid',
    'commentSid',
    '댓글작성자',
    '댓글작성일',
    '내용',
    '제작자답글',
    '최초수집일',
    '최종확인일',
    '상태'
  ];
}


function getLogHeaders_() {
  return [
    '실행시각',
    '기준일',
    '상태',
    '게시판총건수',
    '수집도구수',
    '전체페이지수',
    '신규도구수',
    '작성자수집수',
    '메시지',
    '댓글수집글수',
    '신규댓글수'
  ];
}


/* =========================================================
 * 8. 로그
 * ========================================================= */

function appendLog_(log) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_LOG);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_LOG);
      sheet.appendRow(getLogHeaders_());
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      log.runAt || new Date(),
      log.dateKey || formatDateKey_(new Date()),
      log.status || '',
      log.totalCount || 0,
      log.normalPostCount || 0,
      log.totalPages || 0,
      log.newToolCount || 0,
      log.authorFetchedCount || 0,
      log.message || '',
      log.commentPostFetchedCount || 0,
      log.newCommentCount || 0
    ]);

  } catch (error) {
    console.log('로그 기록 실패: ' + error);
  }
}


/* =========================================================
 * 9. HTTP
 * ========================================================= */

function fetchHtml_(url) {
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    followRedirects: true,
    muteHttpExceptions: true,
    validateHttpsCertificates: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JBE-TeacherMadeToolViewCollector/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7'
    }
  });

  const status = response.getResponseCode();

  if (status !== 200) {
    throw new Error('HTTP ' + status + ' : ' + url);
  }

  return response.getContentText('UTF-8');
}


/* =========================================================
 * 10. HTML 보조 함수
 * ========================================================= */

function extractCellByHeader_(rowHtml, label) {
  const escaped = escapeRegExp_(label);

  const regex = new RegExp(
    '<td\\b[^>]*data-cell-header=["\\\'][^"\\\']*'
      + escaped
      + '[^"\\\']*["\\\'][^>]*>([\\s\\S]*?)<\\/td>',
    'i'
  );

  const match = rowHtml.match(regex);

  return match ? cleanText_(match[1]) : '';
}


function cleanText_(htmlText) {
  return decodeHtml_(
    String(htmlText || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}


function decodeHtml_(text) {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, function(_, code) {
      return String.fromCharCode(parseInt(code, 10));
    });
}


function escapeRegExp_(text) {
  return String(text)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


function absoluteUrl_(href) {
  href = decodeHtml_(String(href || '').trim());

  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  return CONFIG.BASE_URL
    + (href.charAt(0) === '/' ? '' : '/')
    + href;
}


/* =========================================================
 * 11. 날짜
 * ========================================================= */

function normalizeBoardDate_(value) {
  const text = cleanText_(value);

  // 26.07.22
  let match = text.match(
    /^(\d{2})\.(\d{1,2})\.(\d{1,2})\.?$/
  );

  if (match) {
    return '20' + match[1]
      + '-' + pad2_(match[2])
      + '-' + pad2_(match[3]);
  }

  // 2026.07.22
  match = text.match(
    /^(\d{4})\.(\d{1,2})\.(\d{1,2})\.?$/
  );

  if (match) {
    return match[1]
      + '-' + pad2_(match[2])
      + '-' + pad2_(match[3]);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return text;
}


function normalizeDateCellToKey_(value) {
  if (!value) return '';

  if (
    Object.prototype.toString.call(value) === '[object Date]'
    && !isNaN(value)
  ) {
    return Utilities.formatDate(
      value,
      CONFIG.TIMEZONE,
      'yyyy-MM-dd'
    );
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return normalizeBoardDate_(text);
}


function formatDateKey_(date) {
  return Utilities.formatDate(
    date,
    CONFIG.TIMEZONE,
    'yyyy-MM-dd'
  );
}


function pad2_(value) {
  return String(value).padStart(2, '0');
}


/* =========================================================
 * 12. 구글시트 메뉴
 * ========================================================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('도구 조회수')
    .addItem('초기 설정 및 매시간 트리거 생성', 'setup')
    .addItem('지금 수집하기', 'collectDailyViews')
    .addToUi();
}
