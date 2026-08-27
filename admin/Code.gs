/**
 * Briefing Signal Lab — 운영자 관리자 콘솔 (Apps Script, standalone).
 * 흩어진 운영 수작업(주간 초안 승인·서재 업로드·방문 통계·대시보드 수동 카드·파이프 토글)을
 * 인증된 콘솔 하나로 수렴한다. 공개 사이트와 독립(별도 URL). 상세: docs/admin-console-plan.md.
 *
 * 인증 = 배포 시 "액세스: 나만(only myself)". Google 로그인이 곧 인증(TOKEN 불필요).
 *   선택적 이중 확인: 스크립트 속성 ADMIN_EMAILS(콤마구분)에 허용 계정을 넣으면 대조.
 *
 * 설치:
 *  1) script.google.com → 새 프로젝트(예: BSL_admin) → 이 파일(Code.gs) + index.html 추가
 *  2) 프로젝트 설정(톱니) → 스크립트 속성:
 *       MARKET_ID    = BSL_market 스프레드시트 ID (주간-초안·서재·대시보드-수동·settings 탭)
 *       ANALYTICS_ID = BSL_analytics 스프레드시트 ID (방문로그 탭)
 *       ADMIN_EMAILS = 본인 gmail (선택, 비우면 배포 "액세스: 나만"에만 의존)
 *  3) 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나, 액세스: 나만(only myself) → URL 북마크
 *
 * 시트ID·비밀은 스크립트 속성으로만(하드코딩 금지).
 */

// ───────────────────────── 탭 이름 ─────────────────────────
var WEEKLY_TAB   = '주간-초안';        // 편집 승인 원천. approved 자체는 공개 상태가 아님
var RELEASE_TAB  = '주간-발행';        // 호 상태 단일 원장
var RELEASE_ITEM_TAB = '주간-발행항목'; // 공개/메일 스냅샷
var DELIVERY_TAB = '주간-발송로그';     // 수신자 해시별 발송 결과
var LIBRARY_TAB  = '서재';             // id·유형·분류·발행일·제목·요약·태그·본문·access
var VISIT_TAB    = '방문로그';          // 날짜시각·페이지·referrer·방문자ID  (BSL_analytics)
var DASH_TAB     = '대시보드-수동';      // 카드키·라벨·단위·주기·출처·시각·값 (신설)
var SETTINGS_TAB = 'settings';         // key·value (없으면 자동 생성)

// ───────────────────────── config / auth ─────────────────────────
function _prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
/** 이 프로젝트에 실제로 설정된 스크립트 속성 '이름'만. 값은 비밀이라 절대 내보내지 않는다. */
function _propNames_() { return PropertiesService.getScriptProperties().getKeys().sort(); }

/** 설치 진단 — "속성을 넣었는데 안 된다"는 상황에서 편집기에서 직접 실행한다.
 *
 * 속성을 엉뚱한 프로젝트에 넣었거나, 이름에 공백이 섞였거나, 저장을 안 눌렀을 때를
 * 눈으로 구분해준다. 세 경우 모두 증상이 "설정하세요" 하나로 같아서 추측으로는 못 찾는다.
 *
 * ⚠️ 이름 끝에 _ 를 붙이지 말 것 — Apps Script 는 _ 로 끝나는 함수를 실행 드롭다운에서 숨긴다.
 * ⚠️ 값은 찍지 않는다. 로그가 실행 기록에 남으므로 토큰이 평문으로 보관된다.
 */
function checkAdminProps() {
  var keys = _propNames_();
  Logger.log('[진단] 이 프로젝트에 설정된 속성 ' + keys.length + '개: [' + keys.join(', ') + ']');
  ['MARKET_ID', 'ANALYTICS_ID', 'MAILER_URL', 'MAILER_TOKEN', 'ADMIN_EMAILS'].forEach(function (k) {
    var v = _prop_(k);
    var note = (v == null) ? '없음'
      : (String(v).trim() === '' ? '있으나 빈 값'
      : (String(v) !== String(v).trim() ? '설정됨 (⚠️ 앞뒤 공백 있음 — 값을 다시 붙여넣으세요)'
      : '설정됨 (' + String(v).length + '자)'));
    Logger.log('  ' + k + ' : ' + note);
  });
  var url = String(_prop_('MAILER_URL') || '').trim();
  if (url && url.indexOf('/exec') < 0) {
    Logger.log('  ⚠️ MAILER_URL 이 /exec 로 끝나지 않습니다 — 배포 관리의 웹 앱 URL 을 쓰세요(/dev 는 안 됩니다)');
  }
  // 어느 웹앱이 응답하는지 확인한다. 이 저장소에 /exec 가 셋(메일러·시장·방문로그) 있어
  // 형식은 맞는데 대상이 틀린 경우가 실제로 나온다 — 형식 검사만으로는 못 잡는다.
  if (url && url.indexOf('/exec') >= 0) {
    try {
      var probe = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      var text = probe.getContentText().slice(0, 400);
      if (/market-webapp/.test(text)) {
        Logger.log('  ❌ MAILER_URL 이 "시장" 웹앱을 가리킵니다 — BSL_mailer 의 배포 URL 로 바꾸세요');
      } else if (/BRIEFING SIGNAL LAB|잘못된 요청/.test(text)) {
        Logger.log('  ✅ MAILER_URL 이 메일러 웹앱에 연결됩니다');
      } else {
        Logger.log('  ⚠️ 응답이 메일러 같지 않습니다(앞 120자): ' + text.slice(0, 120).replace(/\s+/g, ' '));
      }
    } catch (e) {
      Logger.log('  ⚠️ MAILER_URL 연결 확인 실패: ' + e);
    }
  }
  Logger.log('[진단] MAILER_URL·MAILER_TOKEN 이 "없음"이면 이 프로젝트가 아니라 메일러 쪽에 넣었을 가능성이 큽니다.');
}

function _openMarket_() {
  var id = _prop_('MARKET_ID');
  if (!id) throw new Error('스크립트 속성 MARKET_ID 없음');
  return SpreadsheetApp.openById(id);
}
function _openAnalytics_() {
  var id = _prop_('ANALYTICS_ID');
  if (!id) throw new Error('스크립트 속성 ANALYTICS_ID 없음');
  return SpreadsheetApp.openById(id);
}

/** 로그인 계정 반환. ADMIN_EMAILS가 설정돼 있으면 대조(불일치 시 throw). */
function _assertAuth_() {
  var email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  var allow = (_prop_('ADMIN_EMAILS') || '').split(',')
    .map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  if (allow.length && allow.indexOf(email) < 0) {
    throw new Error('권한 없음: ' + (email || '(로그인 계정 확인 불가)'));
  }
  return email;
}

// HtmlService 콘솔 서빙
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('BSL 운영자 콘솔')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSession() {
  var email = _assertAuth_();
  return { email: email, hasAllowlist: !!(_prop_('ADMIN_EMAILS') || '') };
}

// ───────────────────────── 시트 헬퍼 ─────────────────────────
function _norm_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  return v;
}

/** 탭 → { header:[...], rows:[{_row, <헤더>:값, ...}, ...] }. Date는 KST yyyy-MM-dd 문자열로. */
function _readTab_(ss, tabName) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) throw new Error('탭 없음: ' + tabName + ' (시트에 먼저 생성하세요)');
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var header = lastCol
    ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); })
    : [];
  var rows = [];
  if (lastRow > 1 && lastCol) {
    var data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var i = 0; i < data.length; i++) {
      var obj = { _row: i + 2 };
      for (var c = 0; c < header.length; c++) { obj[header[c]] = _norm_(data[i][c]); }
      rows.push(obj);
    }
  }
  return { header: header, rows: rows };
}

function _colIndex_(sh, name) {
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var idx = header.indexOf(name);
  if (idx < 0) throw new Error('열 없음: ' + name);
  return idx + 1;
}

/** 하단부터 삭제해 인덱스 무결성 유지. */
function _deleteRows_(sh, rows) {
  (rows || []).slice().sort(function (a, b) { return b - a; })
    .forEach(function (r) { if (r >= 2) sh.deleteRow(r); });
  return (rows || []).length;
}

function _appendByHeader_(sh, item) {
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  sh.appendRow(header.map(function (h) { return item[h] != null ? item[h] : ''; }));
}
function _ensureTab_(ss, name, header) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastColumn() === 0 || sh.getLastRow() === 0) sh.getRange(1, 1, 1, header.length).setValues([header]);
  var actual = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  header.forEach(function (h) { if (actual.indexOf(h) < 0) throw new Error(name + ' 헤더 누락: ' + h); });
  return sh;
}
function _nowKst_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function _sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

// ───────────────────────── ① 주간 초안 승인 ─────────────────────────
function weeklyList() {
  _assertAuth_();
  return _readTab_(_openMarket_(), WEEKLY_TAB);
}
function weeklySetStatus(row, status) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(WEEKLY_TAB);
  sh.getRange(row, _colIndex_(sh, 'status')).setValue(status);
  return { ok: true };
}
function weeklySetType(row, type) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(WEEKLY_TAB);
  sh.getRange(row, _colIndex_(sh, '유형')).setValue(type);
  return { ok: true };
}
function weeklyDeleteRows(rows) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(WEEKLY_TAB);
  return { ok: true, deleted: _deleteRows_(sh, rows) };
}

/** 선택한 행들의 한 열을 같은 값으로 일괄 변경. 반환 = 실제 바뀐 행 수.
 *
 * 열 전체를 한 번 읽고 한 번 쓴다. 행마다 setValue 를 부르면 선택 48건에
 * 왕복 48회가 나가 콘솔이 수십 초 멈춘다(운영자가 하나씩 누르던 것과 같은 비용).
 * 대상이 흩어져 있어도 읽기 1회·쓰기 1회로 끝나는 것이 이 방식의 요점이다.
 *
 * ⚠️ 대상 열만 읽고 쓴다. 행 전체를 되쓰면 손대지 않은 열까지 재기록돼
 *    날짜 서식 등이 흔들린다.
 */
function _weeklySetColumnBatch_(rows, colName, value) {
  var sh = _openMarket_().getSheetByName(WEEKLY_TAB);
  if (!sh) throw new Error('탭 없음: ' + WEEKLY_TAB);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  var targets = (rows || []).map(Number).filter(function (r) { return r >= 2 && r <= lastRow; });
  if (!targets.length) return 0;
  var range = sh.getRange(2, _colIndex_(sh, colName), lastRow - 1, 1);
  var values = range.getValues();
  var changed = 0;
  targets.forEach(function (r) {
    var i = r - 2;
    if (String(values[i][0]) !== String(value)) { changed++; }
    values[i][0] = value;
  });
  range.setValues(values);
  return changed;
}

function weeklySetStatusBatch(rows, status) {
  _assertAuth_();
  if (['draft', 'approved'].indexOf(String(status)) < 0) throw new Error('알 수 없는 status: ' + status);
  return { ok: true, updated: _weeklySetColumnBatch_(rows, 'status', status), total: (rows || []).length };
}

function weeklySetTypeBatch(rows, type) {
  _assertAuth_();
  if (['signal', 'headliner'].indexOf(String(type)) < 0) throw new Error('알 수 없는 유형: ' + type);
  return { ok: true, updated: _weeklySetColumnBatch_(rows, '유형', type), total: (rows || []).length };
}

// ───────────────────────── ①-b 주간 호 발행 예약/웹 리비전 ─────────────────────────
var RELEASE_HEADER = ['issue_key','state','revision','manual_confirmed','auto_mode','published_at','emailed_at','content_hash','updated_at','message'];
var RELEASE_ITEM_HEADER = ['issue_key','revision','분야','발행주','유형','제목ko','제목en','한줄ko','한줄en','밸류체인','출처URL','원문제목','원문일시','검수점수','검수사유','상태','published_at','updated_at'];
var DELIVERY_HEADER = ['issue_key','revision','recipient_hash','status','attempted_at','error'];

function _releaseTabs_(ss) {
  return {
    ledger: _ensureTab_(ss, RELEASE_TAB, RELEASE_HEADER),
    items: _ensureTab_(ss, RELEASE_ITEM_TAB, RELEASE_ITEM_HEADER),
    delivery: _ensureTab_(ss, DELIVERY_TAB, DELIVERY_HEADER)
  };
}
function weeklyReleaseStatus(issueKey) {
  _assertAuth_();
  var ss = _openMarket_(), tabs = _releaseTabs_(ss), data = _readTab_(ss, RELEASE_TAB).rows;
  var rows = data.filter(function (r) { return !issueKey || String(r.issue_key) === String(issueKey); });
  var latest = rows.length ? rows[rows.length - 1] : null;
  return { issueKey: issueKey || '', latest: latest, history: rows.slice(-8) };
}
function weeklyPrepareRelease(issueKey) {
  _assertAuth_();
  if (!issueKey) throw new Error('발행주를 선택하세요');
  var ss = _openMarket_(), tabs = _releaseTabs_(ss);
  var approved = _readTab_(ss, WEEKLY_TAB).rows.filter(function (r) {
    return String(r['발행주'] || '') === String(issueKey) && String(r.status || '').toLowerCase() === 'approved';
  });
  if (!approved.length) throw new Error('선택한 발행주의 approved 행이 없습니다');
  var ledgerRows = _readTab_(ss, RELEASE_TAB).rows.filter(function (r) { return String(r.issue_key) === String(issueKey); });
  var published = ledgerRows.some(function (r) { return ['published','email_partial','emailed'].indexOf(String(r.state)) >= 0; });
  var maxRevision = ledgerRows.reduce(function (m, r) { return Math.max(m, Number(r.revision || 0)); }, 0);
  var revision = published ? maxRevision + 1 : 1;
  var itemState = published ? 'published' : 'ready';
  var ledgerState = published ? 'published' : 'manual_ready';
  var now = _nowKst_(), publishedAt = published ? now : '';
  if (!published) {
    var existingItems = _readTab_(ss, RELEASE_ITEM_TAB).rows;
    var stateCol = _colIndex_(tabs.items, '상태'), updatedCol = _colIndex_(tabs.items, 'updated_at');
    existingItems.forEach(function (r) {
      if (String(r.issue_key) === String(issueKey) && Number(r.revision || 0) === 1 && String(r['상태']) === 'ready') {
        tabs.items.getRange(r._row, stateCol).setValue('superseded');
        tabs.items.getRange(r._row, updatedCol).setValue(now);
      }
    });
  }
  var items = approved.map(function (r) {
    return {
      issue_key: issueKey, revision: revision, '분야': r['분야'], '발행주': r['발행주'], '유형': r['유형'],
      '제목ko': r['제목ko'], '제목en': r['제목en'], '한줄ko': r['한줄ko'], '한줄en': r['한줄en'],
      '밸류체인': r['밸류체인'], '출처URL': r['출처URL'], '원문제목': r['원문제목'], '원문일시': r['원문일시'],
      '검수점수': r['검수점수'] || '', '검수사유': published ? 'late manual web revision' : 'manual approval',
      '상태': itemState, published_at: publishedAt, updated_at: now
    };
  });
  items.forEach(function (item) { _appendByHeader_(tabs.items, item); });
  var digest = _sha256_(JSON.stringify(items));
  _appendByHeader_(tabs.ledger, {
    issue_key: issueKey, state: ledgerState, revision: revision, manual_confirmed: 'true', auto_mode: 'false',
    published_at: publishedAt, emailed_at: '', content_hash: digest, updated_at: now,
    message: published ? '늦은 승인 웹판 rev.' + revision + ' (' + items.length + '건, 이메일 재발송 없음)' : '운영자 발행 예약 (' + items.length + '건)'
  });
  return { ok: true, unchanged: false, issueKey: issueKey, state: ledgerState, revision: revision, count: items.length };
}


// ───────────────────────── ⑥ 스페셜 리포트 발송 ─────────────────────────
// 콘솔은 예약 행만 쓴다. 실제 발송은 메일러(별도 프로젝트)의 sendSpecialDue() 15분 폴링이
// 한다 — 구독자 목록·동의 판정·수신거부·중복방지가 전부 거기 있고, 여기 복제하면 규칙이
// 갈라져 갈라진 쪽이 통과시킨 사람에게 메일이 나간다.
//
// 유일한 예외가 '나에게 테스트 발송'이다. 15분을 기다려서는 렌더링을 확인할 수 없으므로
// 메일러 doPost 를 즉시 부른다. 그 경로는 수신자를 인자로 받지 않고 운영자 주소로 고정돼
// 있어 구독자에게 닿지 못한다.
var SPECIAL_TAB = '스페셜-발송';
var SPECIAL_HEADER = ['발송id', '서재id', '메일제목', '리드', '대상카테고리', '예약시각',
                      '상태', '발송수', '실패수', 'created_at', 'updated_at', 'message'];
var SPECIAL_CATEGORIES = ['기술', '금융', '경제'];   // mailer CATS 의 label 과 동기 유지

function _specialSheet_() { return _ensureTab_(_openMarket_(), SPECIAL_TAB, SPECIAL_HEADER); }

/** 예약 목록 + 드롭다운용 서재 항목(본문 포함 — 미리보기에 쓴다). */
function specialList() {
  _assertAuth_();
  var ss = _openMarket_();
  _specialSheet_();
  return {
    sends: _readTab_(ss, SPECIAL_TAB).rows,
    library: _readTab_(ss, LIBRARY_TAB).rows,
    categories: SPECIAL_CATEGORIES,
  };
}

/** 예약 생성. payload = { 서재id, 메일제목, 리드, 대상카테고리:[], 예약시각 } */
function specialSchedule(payload) {
  _assertAuth_();
  var libId = String((payload && payload['서재id']) || '').trim();
  if (!libId) throw new Error('서재 항목을 선택하세요');
  var lib = _readTab_(_openMarket_(), LIBRARY_TAB).rows.filter(function (r) {
    return String(r['id'] || '').trim() === libId;
  })[0];
  if (!lib) throw new Error('서재 항목을 찾을 수 없습니다: ' + libId);

  var when = String((payload && payload['예약시각']) || '').trim();
  // 콘솔은 KST 로 입력받는다. 메일러의 toTime_ 이 "yyyy-MM-dd HH:mm" 을 파싱하므로 그 형식으로 쓴다.
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(when)) throw new Error('예약시각 형식은 YYYY-MM-DD HH:MM 입니다');
  var cats = (payload && payload['대상카테고리']) || [];
  cats = (Array.isArray(cats) ? cats : [cats]).map(function (s) { return String(s).trim(); })
    .filter(function (s) { return SPECIAL_CATEGORIES.indexOf(s) >= 0; });
  if (!cats.length) throw new Error('대상 카테고리를 하나 이상 고르세요');

  var now = _nowKst_();
  var id = 'sp-' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd-HHmmss');
  _appendByHeader_(_specialSheet_(), {
    '발송id': id, '서재id': libId,
    '메일제목': String((payload && payload['메일제목']) || '').trim() || ('[스페셜 리포트] ' + String(lib['제목'] || '')),
    '리드': String((payload && payload['리드']) || '').trim(),
    '대상카테고리': cats.join(','), '예약시각': when.replace('T', ' '),
    '상태': '대기', '발송수': 0, '실패수': 0,
    created_at: now, updated_at: now, message: '',
  });
  return { ok: true, id: id, when: when, categories: cats };
}

/** 예약 취소. 이미 발송된 건은 되돌릴 수 없으므로 '대기'만 취소한다. */
function specialCancel(row) {
  _assertAuth_();
  var sh = _specialSheet_();
  var state = String(sh.getRange(row, _colIndex_(sh, '상태')).getValue() || '').trim();
  if (state !== '대기') throw new Error("'대기' 상태만 취소할 수 있습니다 (현재: " + state + ')');
  sh.getRange(row, _colIndex_(sh, '상태')).setValue('취소');
  sh.getRange(row, _colIndex_(sh, 'updated_at')).setValue(_nowKst_());
  return { ok: true };
}

/** '발송중'에 멈춘 행을 '대기'로 되돌린다. 발송로그가 이미 받은 사람을 걸러내므로
 *  다시 보내도 중복되지 않는다 — 크래시 복구용이다. */
function specialRequeue(row) {
  _assertAuth_();
  var sh = _specialSheet_();
  var state = String(sh.getRange(row, _colIndex_(sh, '상태')).getValue() || '').trim();
  if (['발송중', '부분', '실패'].indexOf(state) < 0) {
    throw new Error("'발송중'·'부분'·'실패' 만 재시도할 수 있습니다 (현재: " + state + ')');
  }
  sh.getRange(row, _colIndex_(sh, '상태')).setValue('대기');
  sh.getRange(row, _colIndex_(sh, 'updated_at')).setValue(_nowKst_());
  return { ok: true };
}

/** 운영자 본인에게 테스트 메일 1통. 메일러 웹앱을 부른다(발송 로직은 그쪽에만 있다).
 *  스크립트 속성 MAILER_URL·MAILER_TOKEN 이 필요하다 — 없으면 무엇을 넣어야 하는지 알린다. */
function specialTestSend(payload) {
  _assertAuth_();
  var url = (_prop_('MAILER_URL') || '').trim(), token = (_prop_('MAILER_TOKEN') || '').trim();
  // 어느 쪽이 빠졌는지 말해준다 — "둘 다 넣으라"고만 하면 하나만 틀렸을 때 찾지 못한다.
  var missing = [];
  if (!url) missing.push('MAILER_URL');
  if (!token) missing.push('MAILER_TOKEN');
  if (missing.length) {
    throw new Error(
      '이 콘솔 프로젝트(BSL_admin)의 스크립트 속성 ' + missing.join(' · ') + ' 이(가) 비어 있습니다. ' +
      '⚙ 프로젝트 설정 → 맨 아래 스크립트 속성에 추가하세요. ' +
      '메일러 프로젝트가 아니라 이 프로젝트에 넣어야 합니다. ' +
      '현재 이 프로젝트에 설정된 속성: [' + _propNames_().join(', ') + ']');
  }
  if (url.indexOf('/exec') < 0) {
    throw new Error('MAILER_URL 이 /exec 로 끝나야 합니다(현재 값의 끝: …' + url.slice(-12) + '). ' +
      '/dev URL 은 배포본이 아니라 편집기 전용이라 doPost 가 동작하지 않습니다.');
  }
  var response = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({
      token: token, action: 'send_special_test',
      libId: String((payload && payload['서재id']) || '').trim(),
      lead: String((payload && payload['리드']) || '').trim(),
      subject: String((payload && payload['메일제목']) || '').trim(),
    }),
  });
  var body = response.getContentText();
  var parsed = {};
  try { parsed = JSON.parse(body); } catch (e) {
    throw new Error('메일러 응답을 해석하지 못했습니다: ' + body.slice(0, 200));
  }
  if (!parsed.ok) {
    // 이 저장소에는 /exec 웹앱이 셋(메일러·시장·방문로그) 있어 URL 을 헷갈리기 쉽다.
    // 시장 웹앱은 tab 필드를 요구하므로 'tab not found' 로 자기를 드러낸다 — 그대로
    // "메일러 오류"라고 옮기면 메일러를 들여다보며 시간을 버린다.
    if (/tab not found/i.test(String(parsed.error || ''))) {
      throw new Error('MAILER_URL 이 메일러가 아니라 "시장" 웹앱을 가리키고 있습니다. ' +
        'BSL_mailer 프로젝트(sendWeekly·sendDailyMarket 이 있는 것)의 배포 URL 로 바꾸세요. ' +
        '메일러 CFG.WEBAPP_URL 에 같은 URL 이 들어 있습니다(수신거부 링크가 그 주소를 씁니다).');
    }
    throw new Error('메일러 오류: ' + (parsed.error || body.slice(0, 200)));
  }
  return parsed;
}

// ───────────────────────── ③ 서재 업로드 ─────────────────────────
function libraryList() {
  _assertAuth_();
  return _readTab_(_openMarket_(), LIBRARY_TAB);
}
/** item = { id, 유형, 분류, 발행일, 제목, 요약, 태그, 본문, access } */
function libraryAdd(item) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(LIBRARY_TAB);
  if (!sh) throw new Error('탭 없음: ' + LIBRARY_TAB);
  if (!item || !String(item['id'] || '').trim() || !String(item['제목'] || '').trim()) {
    throw new Error('id와 제목은 필수입니다');
  }
  _appendByHeader_(sh, item);
  return { ok: true };
}
/** 기존 행 수정. item에 있는 열만 덮어쓰고 나머지 열은 보존. */
function libraryUpdate(row, item) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(LIBRARY_TAB);
  if (!sh) throw new Error('탭 없음: ' + LIBRARY_TAB);
  if (!item || !String(item['id'] || '').trim() || !String(item['제목'] || '').trim()) {
    throw new Error('id와 제목은 필수입니다');
  }
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var existing = sh.getRange(row, 1, 1, header.length).getValues()[0];
  var values = header.map(function (h, i) {
    return (item.hasOwnProperty(h) && item[h] != null) ? item[h] : existing[i];
  });
  sh.getRange(row, 1, 1, header.length).setValues([values]);
  return { ok: true };
}
function libraryDeleteRows(rows) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(LIBRARY_TAB);
  return { ok: true, deleted: _deleteRows_(sh, rows) };
}

// ───────────────────────── ④ 방문 통계 ─────────────────────────
// referrer 원본은 전체 URL이라 그대로 세면 같은 채널이 수십 줄로 흩어진다.
// 호스트만 남기고, 자기 사이트에서 넘어온 이동은 '사이트 내 이동'으로 묶어
// '외부에서 몇 명이 어느 경로로 왔나'만 보이게 한다.
function _refLabel_(raw) {
  var s = String(raw || '').trim();
  if (!s) return '직접 방문·알 수 없음';
  var host = s.replace(/^[a-z]+:\/\//i, '').split('/')[0].split('?')[0].toLowerCase();
  if (!host) return '직접 방문·알 수 없음';
  if (host.indexOf('brevislab.com') >= 0 || host.indexOf('sk-jeong-0513.github.io') >= 0) return '사이트 내 이동';
  return host.replace(/^www\./, '');
}
function visitStats() {
  _assertAuth_();
  var sh = _openAnalytics_().getSheetByName(VISIT_TAB);
  if (!sh) throw new Error('탭 없음: ' + VISIT_TAB);
  var out = { views: 0, visitors: 0, external: 0, byDate: [], byPage: [], byRef: [], testRows: [] };
  var last = sh.getLastRow();
  if (last <= 1) return out;
  var data = sh.getRange(2, 1, last - 1, 4).getValues();  // 날짜시각·페이지·referrer·방문자ID
  var seen = {}, dateMap = {}, pageMap = {}, refMap = {};
  for (var i = 0; i < data.length; i++) {
    var ts = String(_norm_(data[i][0]) || ''), page = String(data[i][1] || ''), id = String(data[i][3] || '');
    out.views++;
    if (id) seen[id] = 1;
    var d = ts.slice(0, 10);
    if (d) dateMap[d] = (dateMap[d] || 0) + 1;
    if (page) pageMap[page] = (pageMap[page] || 0) + 1;
    var ref = _refLabel_(data[i][2]);
    refMap[ref] = (refMap[ref] || 0) + 1;
    if (ref !== '사이트 내 이동' && ref !== '직접 방문·알 수 없음') out.external++;
    if (page.indexOf('beacon-test') >= 0) out.testRows.push(i + 2);
  }
  out.visitors = Object.keys(seen).length;
  out.byDate = Object.keys(dateMap).sort().map(function (k) { return { date: k, count: dateMap[k] }; });
  out.byPage = Object.keys(pageMap).sort(function (a, b) { return pageMap[b] - pageMap[a]; })
    .map(function (k) { return { page: k, count: pageMap[k] }; });
  out.byRef = Object.keys(refMap).sort(function (a, b) { return refMap[b] - refMap[a]; })
    .map(function (k) { return { ref: k, count: refMap[k] }; });
  return out;
}
function visitDeleteRows(rows) {
  _assertAuth_();
  var sh = _openAnalytics_().getSheetByName(VISIT_TAB);
  return { ok: true, deleted: _deleteRows_(sh, rows) };
}

// ───────────────────────── ② 대시보드 수동 카드 ─────────────────────────
// 시트 = 데이터 점 1개당 1행(카드키로 그룹, 행 순서 = 시계열 순서).
// fetch_dashboard.py가 이 탭 CSV를 읽어 valuechain_manual.json 재생성(dashboard.js 무변경).
function dashList() {
  _assertAuth_();
  return _readTab_(_openMarket_(), DASH_TAB);
}
/** point = { 카드키, 라벨, 단위, 주기, 출처, 시각, 값 } */
function dashAdd(point) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(DASH_TAB);
  if (!sh) throw new Error('탭 없음: ' + DASH_TAB + ' (헤더: 카드키·라벨·단위·주기·출처·시각·값)');
  if (!point || !String(point['카드키'] || '').trim() || String(point['값'] || '') === '') {
    throw new Error('카드키와 값은 필수입니다');
  }
  _appendByHeader_(sh, point);
  return { ok: true };
}
function dashDeleteRows(rows) {
  _assertAuth_();
  var sh = _openMarket_().getSheetByName(DASH_TAB);
  return { ok: true, deleted: _deleteRows_(sh, rows) };
}

// ───────────────────────── 파이프라인 토글 (settings) ─────────────────────────
function _settingsSheet_() {
  var ss = _openMarket_();
  var sh = ss.getSheetByName(SETTINGS_TAB);
  if (!sh) { sh = ss.insertSheet(SETTINGS_TAB); sh.appendRow(['key', 'value']); }
  return sh;
}
function _getSetting_(key) {
  var sh = _settingsSheet_();
  var last = sh.getLastRow();
  if (last < 2) return null;
  var data = sh.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) return _settingText_(data[i][1]);
  }
  return null;
}
// 메일러 settingText_ 와 같은 이유·같은 규칙(동기 유지). 시트가 "07:20" 을 시각으로
// 자동 해석해 Date 로 저장하므로, String() 하면 콘솔 화면에도 긴 날짜 문자열이 뜬다.
function _settingText_(v) {
  if (v instanceof Date) return ("0" + v.getHours()).slice(-2) + ":" + ("0" + v.getMinutes()).slice(-2);
  return String(v == null ? "" : v).trim();
}
function _setSetting_(key, value) {
  var sh = _settingsSheet_();
  var last = sh.getLastRow();
  var keys = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues() : [];
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) { sh.getRange(i + 2, 2).setValue(value); return; }
  }
  sh.appendRow([key, value]);
}
// 미설정 = 활성(fail-open). '0'일 때만 중지. Python 파이프도 동일 규칙(scripts/lib/toggle.py).
function getPipelineEnabled() { _assertAuth_(); return _getSetting_('pipeline_enabled') !== '0'; }
function setPipelineEnabled(on) {
  _assertAuth_();
  _setSetting_('pipeline_enabled', on ? '1' : '0');
  return { ok: true, enabled: !!on };
}

// ───────────────────────── LLM 엔진 선택 ─────────────────────────
// ⚠️ scripts/lib/ai.py의 ENGINES와 동기 유지(새 provider 추가 시 양쪽 + Secret + 워크플로 env).
var LLM_ENGINES = ['deepseek', 'gemini'];
function getLlmConfig() {
  _assertAuth_();
  var primary = _getSetting_('llm_primary');
  return { engines: LLM_ENGINES, primary: (LLM_ENGINES.indexOf(primary) >= 0) ? primary : LLM_ENGINES[0] };
}
function setLlmPrimary(name) {
  _assertAuth_();
  if (LLM_ENGINES.indexOf(name) < 0) throw new Error('알 수 없는 엔진: ' + name);
  _setSetting_('llm_primary', name);
  return { ok: true, primary: name };
}

// ───────────────────────── 일일 시황 발송 시각 ─────────────────────────
// 메일러(별도 Apps Script)가 이 값을 읽어 새벽 03:00 syncDailySchedule()에서 트리거를 재생성한다.
// 서머타임 등으로 적정 시각이 바뀌므로 코드가 아니라 설정으로 둔다.
// ⚠️ Apps Script 시간 트리거는 지정 시각 ±15분 오차 — 프리마켓(08:30) 전 도착이 목적이면 여유를 둘 것.
var DAILY_SEND_TIME_DEFAULT = '07:40';   // mailer/Code.gs CFG.DAILY_SEND_TIME과 동기 유지
function _parseHhmm_(value) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return ('0' + Number(m[1])).slice(-2) + ':' + m[2];
}
function getDailySendTime() {
  _assertAuth_();
  var saved = _parseHhmm_(_getSetting_('daily_send_time'));
  return { time: saved || DAILY_SEND_TIME_DEFAULT, isDefault: !saved, fallback: DAILY_SEND_TIME_DEFAULT };
}
function setDailySendTime(value) {
  _assertAuth_();
  var time = _parseHhmm_(value);
  if (!time) throw new Error('시각 형식은 HH:MM (00:00~23:59)');
  _setSetting_('daily_send_time', time);
  return { ok: true, time: time };
}
