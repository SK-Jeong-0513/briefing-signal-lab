// GmailApp.sendEmail 이 비-BMP 문자를 깨뜨리는 문제 — 발송 직전 제거 검증.
// 근거(2026-07-27 진단): 시트 셀 정상, Apps Script 읽기도 정상(U+D83D U+DCCC 확인),
// 수신 메일에서만 replacement 문자로 나옴 → 범인은 GmailApp 발송 단계.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const c = vm.createContext({ console, Utilities: { formatDate: () => 'x' }, Logger: { log: () => {} } });
vm.runInContext(fs.readFileSync('mailer/Code.gs', 'utf8'), c);
const safe = (s) => vm.runInContext('mailSafe_(' + JSON.stringify(s) + ')', c);

// ── 실제로 깨졌던 문자열 ──
assert.strictEqual(safe('### 📌 토픽별 통합 브리핑'), '###  토픽별 통합 브리핑');
assert.strictEqual(safe('### 📰 채널별 요약'), '###  채널별 요약');

// ── 한글·CJK·기호는 BMP라 그대로 살아야 한다(과잉 제거 방지) ──
const keep = [
  '반도체 9500억弗 협력 발표',
  'US10Y 4.679% +3bp · 나스닥 −0.6%',
  '주요 시장 지표 · 미 증시 07-24 마감 기준',
  '2026–27 첫 대규모 검증',          // en/em dash
  '“메모리 피크아웃 우려는 과도”',    // 곡선 따옴표
  '⇅ ▲ ▼ → ← ✓',                    // 정렬·화살표 기호(BMP)
  'EWY(한국·야간) 162.96 -6.3%',
];
keep.forEach((s) => assert.strictEqual(safe(s), s, 'BMP 문자는 보존해야 함: ' + s));

// ── HTML 구조가 망가지면 안 된다 ──
const html = '<div style="color:#17202A">📌 제목</div><span>본문</span>';
assert.strictEqual(safe(html), '<div style="color:#17202A"> 제목</div><span>본문</span>');

// ── 경계 케이스 ──
assert.strictEqual(safe(''), '');
assert.strictEqual(safe(null), '');
assert.strictEqual(safe(undefined), '');
assert.strictEqual(safe('\uD83D'), '', '짝 없는 상위 서로게이트도 제거');
assert.strictEqual(safe('\uDCCC'), '', '짝 없는 하위 서로게이트도 제거');
assert.strictEqual(safe('a📌b🚀c'), 'abc', '여러 개 연속 제거');

// ── 배선: 발송 직전 두 곳 모두 감싸야 한다(한쪽만 감싸면 평문/HTML 중 하나가 깨짐) ──
const src = fs.readFileSync('mailer/Code.gs', 'utf8');
assert(src.includes('mailSafe_(dailyPlain_(dg, detail, quotes))') &&
       src.includes('mailSafe_(dailyHtml_(email, dg, detail, quotes))'), '일일 메일 평문·HTML 양쪽');
assert(src.includes('mailSafe_(plain_(perCat, kw))') &&
       src.includes('mailSafe_(html_(email, kw, perCat))'), '주간 메일 평문·HTML 양쪽');

console.log('mail safe (non-BMP) tests: OK');
