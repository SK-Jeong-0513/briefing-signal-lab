// 일일 시황 발송 시각 설정(settings.daily_send_time) — 메일러 트리거 + 관리자 콘솔 검증.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Apps Script 런타임 스텁. settingsRows로 settings 탭 내용을 주입한다.
function mailerContext(settingsRows, opts) {
  opts = opts || {};
  const state = { triggers: [], props: Object.assign({}, opts.props), logs: [] };
  const sheet = settingsRows && {
    getLastRow: () => settingsRows.length + 1,
    getRange: (r, c, n) => ({ getValues: () => settingsRows.slice(r - 2, r - 2 + n) }),
  };
  const builder = (fn) => {
    const t = { fn };
    const b = {
      timeBased: () => b,
      atHour: (h) => { t.hour = h; return b; },
      nearMinute: (m) => { t.minute = m; return b; },
      everyDays: (d) => { t.days = d; return b; },
      inTimezone: (tz) => { t.tz = tz; return b; },
      create: () => { state.triggers.push(t); return t; },
    };
    return b;
  };
  const context = vm.createContext({
    console,
    Utilities: { formatDate: () => '2026,7,28' },
    Logger: { log: (m) => state.logs.push(String(m)) },
    SpreadsheetApp: {
      openById: () => {
        if (opts.throwOnOpen) throw new Error('권한 없음');
        return { getSheetByName: () => sheet || null };
      },
    },
    ScriptApp: {
      newTrigger: builder,
      getProjectTriggers: () => state.triggers.map((t) => Object.assign({
        getHandlerFunction: () => t.fn,
      }, t)),
      deleteTrigger: (tr) => { state.triggers = state.triggers.filter((t) => t.fn !== tr.getHandlerFunction()); },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in state.props ? state.props[k] : null),
        setProperty: (k, v) => { state.props[k] = v; },
      }),
    },
  });
  vm.runInContext(fs.readFileSync('mailer/Code.gs', 'utf8'), context);
  vm.runInContext('CFG.MARKET_SHEET_ID = "market-id";', context);
  return { context, state };
}

// ── 설정값 해석 ──
let m = mailerContext([['daily_send_time', '07:20']]);
assert.strictEqual(vm.runInContext('dailySendTime_().label', m.context), '07:20', '설정값을 읽어야 함');

m = mailerContext([['pipeline_enabled', '1']]);
assert.strictEqual(vm.runInContext('dailySendTime_().label', m.context), '07:40', '미설정이면 CFG 기본값');

m = mailerContext([['daily_send_time', '25:99']]);
assert.strictEqual(vm.runInContext('dailySendTime_().label', m.context), '07:40', '범위 밖이면 기본값');
assert(m.state.logs.some((l) => l.includes('형식 오류')), '형식 오류는 로그로 남겨야 함');

m = mailerContext([['daily_send_time', '7:5']]);
assert.strictEqual(vm.runInContext('dailySendTime_().label', m.context), '07:40', 'HH:MM 아니면 기본값');

m = mailerContext([['daily_send_time', '8:05']]);
assert.strictEqual(vm.runInContext('dailySendTime_().label', m.context), '08:05', '한 자리 시는 0 패딩');

m = mailerContext(null, { throwOnOpen: true });
assert.strictEqual(vm.runInContext('dailySendTime_().label', m.context), '07:40', '시트 조회 실패는 fail-open');

// ── 트리거 생성 ──
m = mailerContext([['daily_send_time', '07:20']]);
assert.strictEqual(vm.runInContext('applyDailySchedule()', m.context), '07:20');
let send = m.state.triggers.filter((t) => t.fn === 'sendDailyMarket');
assert.strictEqual(send.length, 1, '발송 트리거는 1개');
assert.strictEqual(send[0].hour, 7);
assert.strictEqual(send[0].minute, 20, 'nearMinute 없으면 지정 시각 이후 1시간 내 임의 실행됨');
assert.strictEqual(send[0].tz, 'Asia/Seoul');
assert.strictEqual(m.state.props.daily_send_time_applied, '07:20');

vm.runInContext('applyDailySchedule()', m.context);
assert.strictEqual(m.state.triggers.filter((t) => t.fn === 'sendDailyMarket').length, 1, '재실행해도 트리거 중복 없음(멱등)');

// ── 새벽 동기화 ──
m = mailerContext([['daily_send_time', '07:20']], { props: { daily_send_time_applied: '07:20' } });
vm.runInContext('applyDailySchedule(); var before = ScriptApp.getProjectTriggers().length; syncDailySchedule();', m.context);
assert.strictEqual(m.state.logs.filter((l) => l.includes('발송 시각')).length, 0, '변경 없으면 동기화는 no-op');

m = mailerContext([['daily_send_time', '07:20']]);
vm.runInContext('applyDailySchedule();', m.context);
vm.runInContext('SpreadsheetApp.openById = function(){ return { getSheetByName: function(){ return { getLastRow: function(){return 2;}, getRange: function(){ return { getValues: function(){ return [["daily_send_time","06:50"]]; } }; } }; } }; };', m.context);
vm.runInContext('syncDailySchedule();', m.context);
send = m.state.triggers.filter((t) => t.fn === 'sendDailyMarket');
assert.strictEqual(send.length, 1);
assert.strictEqual(send[0].hour, 6);
assert.strictEqual(send[0].minute, 50, '콘솔에서 바꾼 시각이 동기화로 반영돼야 함');

m = mailerContext([['daily_send_time', '07:20']], { props: { daily_send_time_applied: '07:20' } });
vm.runInContext('syncDailySchedule();', m.context);
assert.strictEqual(m.state.triggers.filter((t) => t.fn === 'sendDailyMarket').length, 1, '트리거가 사라졌으면 값이 같아도 재생성');

// ── 설치 함수는 이름·역할 유지 ──
m = mailerContext([['daily_send_time', '07:20']]);
vm.runInContext('createDailyTrigger();', m.context);
assert.strictEqual(m.state.triggers.filter((t) => t.fn === 'sendDailyMarket').length, 1);
assert.strictEqual(m.state.triggers.filter((t) => t.fn === 'syncDailySchedule').length, 1, '설치 시 동기화 트리거도 생성');
const mailer = fs.readFileSync('mailer/Code.gs', 'utf8');
assert(/function sendDailyMarket\(\)/.test(mailer) && /function createDailyTrigger\(\)/.test(mailer), '기존 진입점 이름 유지');

// ── 관리자 콘솔 ──
const admin = vm.createContext({ console });
vm.runInContext(fs.readFileSync('admin/Code.gs', 'utf8'), admin);
vm.runInContext('var _store={}; function _assertAuth_(){} function _getSetting_(k){return k in _store?_store[k]:null;} function _setSetting_(k,v){_store[k]=v;}', admin);
assert.strictEqual(vm.runInContext('getDailySendTime().time', admin), '07:40');
assert.strictEqual(vm.runInContext('getDailySendTime().isDefault', admin), true, '미지정은 기본값임을 표시');
assert.strictEqual(vm.runInContext('setDailySendTime("7:05").time', admin), '07:05');
assert.strictEqual(vm.runInContext('getDailySendTime().time', admin), '07:05');
assert.strictEqual(vm.runInContext('getDailySendTime().isDefault', admin), false);
assert.throws(() => vm.runInContext('setDailySendTime("24:00")', admin), /HH:MM/, '범위 밖은 거부');
assert.throws(() => vm.runInContext('setDailySendTime("아침")', admin), /HH:MM/, '형식 오류는 거부');
assert.strictEqual(vm.runInContext('DAILY_SEND_TIME_DEFAULT', admin), '07:40');
assert(mailer.includes('DAILY_SEND_TIME: "07:40"'), '콘솔 기본값과 메일러 폴백은 같아야 함');

// ── 지표 사전 점검 트리거 (2026-08-27) ──
// 발송 트리거와 한 자리에서 관리한다 — 발송 시각을 바꾸면 점검 시각도 따라가야 한다.
m = mailerContext([['daily_send_time', '07:40']]);
vm.runInContext('applyDailySchedule()', m.context);
let pre = m.state.triggers.filter((t) => t.fn === 'preflightQuotes');
assert.strictEqual(pre.length, 1, '사전 점검 트리거 1개');
assert.strictEqual(pre[0].hour, 6);
assert.strictEqual(pre[0].minute, 50, '발송 50분 전 — ±15분 오차를 양쪽에 두고도 20분 남는다');
assert.strictEqual(pre[0].tz, 'Asia/Seoul');
assert.strictEqual(pre[0].days, 1, '일일 메일이 주말에도 나가므로 점검도 매일');

vm.runInContext('applyDailySchedule()', m.context);
assert.strictEqual(m.state.triggers.filter((t) => t.fn === 'preflightQuotes').length, 1, '재실행해도 중복 없음(멱등)');

// 바닥값: 겨울(EST) 미 증시 마감이 21:00 UTC = 06:00 KST라 그보다 이르면 마감 전 데이터를 물어온다.
assert.strictEqual(vm.runInContext('preflightTime_({h:7,m:40}).label', m.context), '06:50');
assert.strictEqual(vm.runInContext('preflightTime_({h:6,m:30}).label', m.context), '06:20', '06:20 바닥에 걸린다');
assert.strictEqual(vm.runInContext('preflightTime_({h:6,m:20})', m.context), null, '여유가 0이면 만들지 않는다');
assert.strictEqual(vm.runInContext('preflightTime_({h:6,m:15})', m.context), null, '발송이 바닥보다 이르면 만들지 않는다');

m = mailerContext([['daily_send_time', '06:10']]);
vm.runInContext('applyDailySchedule()', m.context);
assert.strictEqual(m.state.triggers.filter((t) => t.fn === 'preflightQuotes').length, 0, '발송이 이르면 사전 점검 생략');
assert.strictEqual(m.state.triggers.filter((t) => t.fn === 'sendDailyMarket').length, 1, '그래도 발송은 건다');
assert(m.state.logs.some((l) => l.includes('사전 점검 트리거 생략')), '생략 이유를 로그로 남긴다');

// 사전 점검 트리거만 사라져도 새벽 동기화가 되살린다
m = mailerContext([['daily_send_time', '07:40']], { props: { daily_send_time_applied: '07:40' } });
vm.runInContext('applyDailySchedule();', m.context);
m.state.triggers = m.state.triggers.filter((t) => t.fn !== 'preflightQuotes');
vm.runInContext('syncDailySchedule();', m.context);
assert.strictEqual(m.state.triggers.filter((t) => t.fn === 'preflightQuotes').length, 1, '사라진 사전 점검 트리거 복구');
assert.strictEqual(m.state.triggers.filter((t) => t.fn === 'sendDailyMarket').length, 1, '복구해도 발송 트리거는 1개');

console.log('daily schedule tests: OK');
