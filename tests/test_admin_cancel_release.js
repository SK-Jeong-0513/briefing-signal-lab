// 관리자 콘솔 — 발행 예약 취소 (2026-09-13).
//
// 배경: 자동 게이트가 08-24·08-31·09-07 세 번 연속 no-op 했다. 매번 운영자 발행 예약이
// 먼저 manual_ready 를 만들어 놨기 때문이고, 09-13 에도 실수로 눌렀다. 되돌릴 길이 없어
// 만든 함수다. 잠그는 것은 셋이다:
//   · 원장 행은 지우거나 덧붙이지 않고 그 자리에서 cancelled 로 바꾼다 — 게이트는
//     이 호에 READY 상태가 하나라도 남아 있으면 no-op 하므로 덧붙이기로는 안 살아난다
//   · 이미 공개·발송된 호는 절대 건드리지 않는다(되돌릴 수 없는 발송)
//   · cancelled 는 게이트(READY_STATES)와 메일러(weeklyLatestBundle_) 어느 목록에도 없다
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function fakeSheet(header, rows) {
  const data = [header.slice()].concat(rows.map((r) => header.map((h) => (r[h] == null ? '' : r[h]))));
  const writes = [];
  return {
    _data: data, _writes: writes,
    getLastRow: () => data.length,
    getLastColumn: () => header.length,
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      return {
        getValues: () => data.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
        setValue: (v) => { data[r - 1][c - 1] = v; writes.push({ r, c, v }); },
        setValues: () => {},
      };
    },
  };
}

const LEDGER_H = ['issue_key','state','revision','manual_confirmed','auto_mode','published_at','emailed_at','content_hash','updated_at','message'];
const ITEM_H = ['issue_key','revision','분야','발행주','유형','제목ko','제목en','한줄ko','한줄en','밸류체인','출처URL','원문제목','원문일시','검수점수','검수사유','상태','published_at','updated_at'];
const DELIV_H = ['issue_key','revision','recipient_hash','status','attempted_at','error'];

function build() {
  const ledger = fakeSheet(LEDGER_H, [
    { issue_key: '2026-W37', state: 'manual_ready', revision: 1, message: '운영자 발행 예약 (193건)' },
    { issue_key: '2026-W37', state: 'published', revision: 1, message: '20:00 공개' },
    { issue_key: '2026-W37', state: 'emailed', revision: 1, message: '발송 성공 42' },
    { issue_key: '2026-W38', state: 'manual_ready', revision: 1, updated_at: '2026-09-13T08:01:36+09:00', message: '운영자 발행 예약 (197건)' },
  ]);
  const items = fakeSheet(ITEM_H, [
    { issue_key: '2026-W37', revision: 1, '상태': 'published', 출처URL: 'w37-a' },
    { issue_key: '2026-W38', revision: 1, '상태': 'superseded', 출처URL: 'old' },   // 이전 예약분 — 다시 쓰지 않는다
    { issue_key: '2026-W38', revision: 1, '상태': 'ready', 출처URL: 'u1' },
    { issue_key: '2026-W38', revision: 1, '상태': 'ready', 출처URL: 'u2' },
    { issue_key: '2026-W38', revision: 1, '상태': 'ready', 출처URL: 'u3' },
  ]);
  const delivery = fakeSheet(DELIV_H, []);
  const sheets = { '주간-발행': ledger, '주간-발행항목': items, '주간-발송로그': delivery };
  const ctx = vm.createContext({
    console,
    Logger: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'MARKET_ID' ? 'm' : null) }) },
    Session: { getActiveUser: () => ({ getEmail: () => 'op@x.com' }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] || null, insertSheet: () => { throw new Error('insertSheet 호출되면 안 됨'); } }) },
    Utilities: { formatDate: () => '2026-09-13T13:40:00+09:00' },
  });
  vm.runInContext(fs.readFileSync('admin/Code.gs', 'utf8'), ctx);
  return { ctx, ledger, items };
}

const col = (H, name) => H.indexOf(name);

// ── 정상 취소 ──────────────────────────────────────────────────────────
{
  const { ctx, ledger, items } = build();
  const out = JSON.parse(vm.runInContext('JSON.stringify(weeklyCancelRelease("2026-W38"))', ctx));
  assert.deepStrictEqual(out, { ok: true, issueKey: '2026-W38', cancelled: 1, superseded: 3 });

  const w38 = ledger._data[4];
  assert.strictEqual(w38[col(LEDGER_H, 'state')], 'cancelled', '원장 state 를 그 자리에서 cancelled 로');
  assert.strictEqual(w38[col(LEDGER_H, 'updated_at')], '2026-09-13T13:40:00+09:00');
  assert.strictEqual(w38[col(LEDGER_H, 'message')], '운영자 발행 예약 (197건) → 운영자 취소', '이력은 message 에 남긴다');
  assert.strictEqual(ledger._data.length, 5, '원장에 행을 덧붙이지 않는다');
  for (let i = 1; i <= 3; i++) assert.strictEqual(ledger._data[i][col(LEDGER_H, 'state')], ['manual_ready','published','emailed'][i - 1], 'W37 원장은 손대지 않는다');

  const st = col(ITEM_H, '상태');
  assert.strictEqual(items._data[1][st], 'published', 'W37 항목 불변');
  assert.strictEqual(items._data[2][st], 'superseded', '이미 superseded 인 행은 그대로');
  assert.deepStrictEqual([3, 4, 5].map((i) => items._data[i][st]), ['superseded','superseded','superseded'], 'ready 항목 전부 superseded');
  const itemWrites = items._writes.filter((w) => w.c === st + 1);
  assert.strictEqual(itemWrites.length, 3, 'ready 였던 3행만 쓴다(이미 superseded 인 행 재기록 없음)');
}

// ── 공개·발송된 호는 취소 불가 ─────────────────────────────────────────
{
  const { ctx, ledger, items } = build();
  assert.throws(() => vm.runInContext('weeklyCancelRelease("2026-W37")', ctx), /취소할 수 없습니다.*emailed/, '발송된 호');
  assert.strictEqual(ledger._writes.length + items._writes.length, 0, '거절 시 아무것도 쓰지 않는다');
}

// ── 예약이 없는 호 ────────────────────────────────────────────────────
{
  const { ctx, ledger, items } = build();
  assert.throws(() => vm.runInContext('weeklyCancelRelease("2026-W39")', ctx), /취소할 예약이 없습니다/);
  assert.throws(() => vm.runInContext('weeklyCancelRelease("")', ctx), /발행주를 지정/);
  assert.strictEqual(ledger._writes.length + items._writes.length, 0);
}

// ── cancelled 가 게이트·메일러 어느 목록에도 없어야 취소가 성립한다 ─────────
{
  const py = fs.readFileSync('scripts/prepare_weekly_release.py', 'utf8');
  const m = py.match(/READY_STATES\s*=\s*\{([^}]*)\}/);
  assert(m, 'prepare_weekly_release.py 의 READY_STATES 를 못 찾음');
  const ready = m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  assert(ready.indexOf('manual_ready') >= 0, 'READY_STATES 파싱 확인');
  assert(ready.indexOf('cancelled') < 0, '게이트가 cancelled 를 READY 로 보면 취소해도 no-op 이 계속된다');

  const mailer = fs.readFileSync('mailer/Code.gs', 'utf8');
  const fn = mailer.slice(mailer.indexOf('function weeklyLatestBundle_'), mailer.indexOf('function weeklyPublish_'));
  assert(/"manual_ready","auto_ready","published","email_partial","emailed"/.test(fn), '메일러 상태 목록 확인');
  assert(fn.indexOf('cancelled') < 0, '메일러가 cancelled 원장을 집으면 취소한 호가 발송된다');
}

console.log('test_admin_cancel_release: OK');
