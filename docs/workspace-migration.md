# Google Workspace 이전 — 발송 한도 해제

> 작성 2026-09-01. **2026-09-01 개정 — 경로를 바꿨다(§2).** 초판은 스크립트를 새 계정으로
> 복제하는 계획이었으나, §7 미지수를 실제로 확인한 결과 복제가 불가능하고 동시에 불필요했다.
> 초판은 `docs/workspace-migration.md.bak` 에 있다.
>
> 이 이전의 위험은 "안 되는 것"이 아니라 **"되는 것처럼 보이는데 조용히 깨지는 것"**이다.
> §3 을 먼저 읽을 것.

## 1. 왜 하는가

2026-09-01 화요일 일일 시황이 발송되지 못했다(필요 35 · 잔여 29). 구독자 35명이 그날 메일을 못 받았고 **복구되지 않았다** — 일일은 수신자별 발송로그가 없어 이어서 보낼 수 없다.

원인은 한도 계산 방식이다.

```
Gmail 발송 한도는 달력 하루가 아니라 롤링 24시간이다.
  월 07:20  일일 35
  월 09:06  주간 35     ← 화요일 아침 창에 그대로 남는다
  ─────────────────
            71 소진 → 화 07:20 에 29 남음 → 35 필요 → 보류
```

**일일이 매일 나가므로 창에는 항상 2일치가 겹쳐 있다.** 여기에 주간이 얹히면 3N 에 가까워진다. 개인 계정 한도 100명 기준으로 **구독자 35명이 이미 70%를 쓴다.** 매주 월·화 이틀이 위험하고, 구독자가 늘면 평일도 무너진다.

Workspace 계정의 상한은 1,500명이다. 이것이 구독자 상한을 푸는 유일한 경로다.
**다만 1,500 은 계정을 만든다고 바로 오지 않는다 — §7-A 를 반드시 읽을 것.** 그래도 시험판·신규 유료 계정조차 개인 계정(100)보다는 크므로 이전의 근거는 그대로다.

## 2. 경로 — 스크립트를 옮기지 않는다

### 근거가 된 사실 셋 (2026-09-01 확인)

**① 개인 계정 → Workspace 계정 소유권 이전은 불가능하다.** 도메인이 달라 Drive 가 차단한다
("You can't transfer ownership to or from an external user"). 게다가 mailer 는 **응답 시트에
바인딩된 스크립트**라(`CFG.SHEET_ID` 가 `""` → `getActiveSpreadsheet()`) 컨테이너 시트와
분리해 옮길 수도 없고, 그 시트도 같은 이유로 못 옮긴다. **초판의 '소유권 이전 먼저 시도'
경로는 닫혔다.**

**② 설치형 트리거는 설치한 계정으로 실행되고, 한도도 그 계정 것을 쓴다.**
> "Installable triggers always run under the account of the person who created them.
>  The installing user's daily quota is what burns — 100 per day on consumer accounts
>  and 1,500 on Workspace."

**③ 웹앱 `doPost` 는 배포한 계정으로 실행된다**(Execute as Me). 트리거와 **별개 경로**다.

### 그래서 이렇게 한다

②가 뜻하는 것은, **스크립트를 옮길 필요가 없다**는 것이다. 스크립트는 그 자리에 두고
Workspace 계정이 **같은 프로젝트에 자기 트리거를 설치**하면 그때부터 발송이 1,500 한도로 돈다.

| 대상 | 어떻게 | 이유 |
|---|---|---|
| Apps Script 프로젝트 | **안 옮긴다** | 옮길 수 없고(①), 옮길 필요도 없다(②) |
| 트리거 8개 | **개인 계정에서 지우고 Workspace 계정에서 다시 만든다** | 여기가 한도를 정한다 |
| 시트 소유권 | **안 옮긴다** | 편집자 공유로 충분하다 |
| 웹앱 배포 | **안 건드린다** | 재배포하면 URL 이 바뀌어 §3-B 가 되살아난다 |
| `CFG` | **안 건드린다** | SALT·WEBAPP_URL·MARKET_SHEET_ID 그대로 |
| GitHub Secret 9개 | **안 건드린다** | 웹앱 URL 도 게시 CSV 도 그대로다 |
| 도메인·DNS | 새로 설정 | `noreply@brevislab.com` 발신과 SPF·DKIM·DMARC |

**공유할 시트는 2개뿐이다.** `prefSheet`("관심분야(기술/금융/경제)")는 별도 파일이 아니라
**응답 시트의 탭**이다(`ss_().getSheetByName`). 따라서 응답 시트 + BSL_market 둘만 공유한다.

## 3. 조용히 깨지는 것

초판에는 다섯이었다. 스크립트를 안 옮기므로 SALT·WEBAPP_URL·웹앱 URL·게시 CSV 넷이
**구조적으로 사라졌다.** 남은 것은 하나다.

### A. 트리거 중복 → 이중 발송 ⚠️ 유일한 실질 위험

옛 트리거와 새 트리거가 동시에 있으면 **구독자가 같은 메일을 두 번 받는다.**
주간·스페셜은 발송로그로 막히지만 **일일은 로그가 없어 그대로 두 번 나간다.**

그런데 이 위험은 성질이 고약하다.

> "A given account can't see triggers installed from a second account."

**한 계정에서 다른 계정의 트리거를 볼 수도, 지울 수도 없다.** 그래서
- 개인 계정의 8개는 **개인 계정이 직접** 지워야 한다. Workspace 계정이 대신 못 지운다.
- `createWeeklyTriggers()` 같은 함수의 "기존 동명 트리거 삭제" 로직도 **자기 것만** 지운다.
- 중복 여부를 한 화면에서 확인할 수 없다 — **계정마다 따로** 봐야 한다.

**순서를 반드시 지킨다: 개인 계정에서 전부 삭제 → 확인 → Workspace 계정에서 생성.**

### B. 이전 후 개인 계정에서 `create*` 함수를 실행하면 안 된다

`createDailyTrigger()` · `createWeeklyTriggers()` · `createSpecialTrigger()` 는 실행한 계정에
트리거를 만든다. 이전이 끝난 뒤 개인 계정에서 무심코 하나라도 돌리면 **그 즉시 중복이 생기고,
Workspace 계정 쪽에서는 보이지 않는다.** 진단이 목적이면 `checkMailerProps` 만 쓴다(읽기 전용).

### C. GitHub Actions 백스톱은 개인 계정 한도에 남는다 (수용)

`WEEKLY_MAILER_URL` 의 `doPost` 는 배포자(개인 계정)로 실행된다(③). 평소에는 Apps Script
트리거가 월 09:00 정시에 먼저 돌고, 1~2시간 늦게 오는 Actions 백스톱은 원장이 `emailed` 라
`weeklyLatestBundle_` 이 null 을 반환해 no-op 한다. **문제가 되는 것은 트리거가 실패한
회차뿐이고, 그때 백스톱은 여전히 100 한도로 돈다.**

웹앱을 Workspace 계정으로 재배포하면 풀리지만 그 순간 URL 두 개가 바뀌어 §3 의 사라진
위험들이 되살아난다. **백스톱이 완전히 죽는 것보다 낫다고 보고 남긴다.** 이전 후에도
`[BSL] 발송 한도 부족` 메일이 오면 이 경로를 의심할 것.

## 4. 현재 트리거 8개 — 0단계 기록분

2026-09-01 `checkMailerProps` 실측. 롤백과 재생성의 기준이다.

| 트리거 | 시각(KST) | 재생성 함수 |
|---|---|---|
| `sendDailyMarket` | 07:20 ±15분 | `createDailyTrigger()` |
| `preflightQuotes` | 06:30 (발송−50분, 하한 06:20) | `createDailyTrigger()` |
| `syncDailySchedule` | 매일 03:00 | `createDailyTrigger()` |
| `sendWeekly` | 월 09:00 | `createWeeklyTriggers()` |
| `weeklyAlertDraft` | 일 09:00 | `createWeeklyTriggers()` |
| `weeklyAlertDeadline` | 일 20:00 | `createWeeklyTriggers()` |
| `weeklyAlertResult` | 월 10:00 | `createWeeklyTriggers()` |
| `sendSpecialDue` | 15분 폴링 | `createSpecialTrigger()` |

**시각을 손으로 옮겨 적을 필요가 없다.** `applyDailySchedule()` 이 `settings.daily_send_time`
을 읽어 계산하므로, Workspace 계정이 `createDailyTrigger()` 를 돌리면 같은 07:20/06:30 이 나온다.
주간·스페셜은 함수에 시각이 박혀 있다.

**스크립트 속성도 옮길 필요가 없다.** 프로젝트 단위라 계정이 달라도 같은 값을 본다
(`WEEKLY_CRON_TOKEN` 40자 · `GH_DISPATCH_TOKEN` · `daily_send_time_applied`).

## 5. 순서

각 단계의 검증을 통과해야 다음으로 간다.

### 0단계 — 준비 (발송에 영향 없음)

```
□ §4 표가 현재와 같은지 확인 — 개인 계정에서 checkMailerProps 실행
  (2026-09-01 확인 완료. 시간이 지났으면 다시 볼 것)
```

초판의 SALT·WEBAPP_URL·스크립트 속성 기록 항목은 **전부 불필요해졌다** — 스크립트를 안 옮긴다.

### 1단계 — Workspace 계정과 도메인

**이전 전 DNS 스냅샷 (2026-09-01 실측, 8.8.8.8 조회).** 되돌릴 때의 기준이다.

```
NS      carter.ns.cloudflare.com · anita.ns.cloudflare.com   ← DNS 관리는 Cloudflare
A       185.199.108.153 / .109.153 / .110.153 / .111.153     ← GitHub Pages 공식 IP. 절대 건드리지 말 것
        (Cloudflare 프록시 OFF = 회색 구름. GitHub 실IP 가 그대로 응답한다)
CNAME   www → sk-jeong-0513.github.io
MX      없음     ← 충돌 없음. Google MX 를 그냥 추가하면 된다
TXT     없음     ← SPF 도 없다. 병합 걱정 없이 새로 넣으면 된다
```

⚠️ 사이트를 살리는 것은 **A 4개와 www CNAME** 이다. Workspace 가 요구하는 것은 TXT·MX·DKIM 뿐이라
종류가 겹치지 않는다. 자동 DNS 도구(Entri 등)를 쓰더라도 **작업 후 이 5개가 그대로인지 반드시 확인**한다.

```
□ Google Workspace 구독(Business Starter, 사용자 1명)
  ⚠️ 요금제는 **월간(Flexible)** 을 고른다. 연간 약정이 $6.30 로 10% 싸지만 중도 해지해도
     12개월치가 청구된다. 월간은 $7.00 이고 **언제든 해지 가능**하다 — 월 $0.70 차이로
     해지 자유를 산다. 어느 쪽이든 자동 결제이며 Workspace 에 일회성 결제는 없다.
  ⚠️ 2026-09-01 에 무료 체험을 시작했다가 자동 결제 때문에 취소한 이력이 있다. 조직이
     남아 있으면 **신규 가입이 아니라 admin.google.com → 결제 → 구독 재개**로 가야 한다.
     같은 도메인으로 새로 가입하면 '이미 사용 중인 도메인' 오류가 난다.
□ 관리자 계정 주소는 하나면 충분하다 — 사용자를 더 만들면 1명당 $7 이 더 붙는다.
  발신 표시 이름은 코드의 CFG.SENDER_NAME("Briefing Signal Lab")이 정하므로,
  구독자에게는 「Briefing Signal Lab <관리자주소@brevislab.com>」로 보인다.
  noreply@ 별칭은 필요 없다(§7-B 의 from 옵션 불확실성을 피한다).
□ brevislab.com 도메인 소유 확인
□ DNS: MX · SPF · DKIM · DMARC
□ 검증: 새 계정에서 외부 주소로 테스트 메일 1통 → 수신측 '원본 보기' 에서
        SPF·DKIM·DMARC 가 전부 PASS 인지
□ 검증: 새 계정 Apps Script 에서 Logger.log(MailApp.getRemainingDailyQuota())
        ⚠️ 1,500 을 기대하지 말 것 — §7-A 참조. 실측값을 보고 다음을 판단한다.
           100 근처  → 뭔가 잘못됐다(개인 계정으로 실행했거나 도메인 미연결). 중단하고 원인 확인
           300~500   → 예상 범위. 현재 구독자 35명에는 충분하다. 그대로 진행
           1,500     → 최선. 그대로 진행
```

⚠️ DMARC 는 처음에 `p=none` 으로 두고 며칠 리포트를 본 뒤 조인다. 바로 `p=reject` 로 두면 설정 실수가 곧 전량 반송이다.

### 2단계 — 시트 공유 (소유권 이전 아님)

```
□ 응답 시트(mailer 의 컨테이너)를 Workspace 계정에 **편집자**로 공유
  — 탭: 설문지 응답 시트2 · 관심분야(기술) · 관심분야(금융) · 관심분야(경제)
□ BSL_market 을 Workspace 계정에 **편집자**로 공유
□ 검증: Workspace 계정으로 응답 시트 → 확장 프로그램 → Apps Script 가 열리는지
□ 검증: 그 편집기에서 checkMailerProps 실행 → 승인 창 통과 →
        CFG 진단 3줄이 개인 계정과 같게 나오고, 설치된 트리거가 [] 로 나오는지
        (여기서 [] 가 정상이다 — 아직 Workspace 계정 트리거가 없다)
```

⚠️ Workspace 관리 콘솔의 외부 공유 설정에 따라 개인 계정 소유 파일 접근이 막힐 수 있다.
막히면 관리 콘솔에서 외부 공유를 허용해야 한다.

### 3단계 — 전환 (되돌리기 어려운 지점)

**하루 중 발송이 없는 시간대에 한다.** 일일 07:20 · 주간 월 09:00 · 주간 알림(일 09:00/20:00,
월 10:00)을 피한다 — **화~금 오후가 무난하다.** 스페셜 15분 폴링은 피할 수 없지만 '대기' 행이
없으면 아무 일도 하지 않는다(전환 전 스페셜-발송 탭에 대기 행이 없는지 확인할 것).

```
□ [개인 계정] 트리거 8개를 전부 삭제 (§3-A)
□ [개인 계정] 검증: checkMailerProps → '설치된 트리거: []'
   ⚠️ 이 확인 없이 다음으로 가지 말 것. Workspace 계정에서는 확인할 수 없다.
□ [Workspace 계정] createDailyTrigger() 실행   → sendDailyMarket · preflightQuotes · syncDailySchedule
□ [Workspace 계정] createWeeklyTriggers() 실행  → sendWeekly · weeklyAlert 3개
□ [Workspace 계정] createSpecialTrigger() 실행  → sendSpecialDue
□ [Workspace 계정] 검증: checkMailerProps → 트리거 8개가 §4 표와 같은지
```

웹앱 배포·CFG·GitHub Secret 은 **하나도 건드리지 않는다.**

### 4단계 — 검증 (실제 발송으로)

```
□ 다음 일일 시황(07:20)이 발송되는지 — Workspace 계정 실행 기록에 [일일] ... 발송 N
□ 개인 계정 실행 기록에는 아무것도 없는지 (있으면 트리거가 남아 있다 — 즉시 §6 롤백)
□ 구독자가 같은 메일을 두 번 받지 않았는지 (§3-A) — 운영자 본인 메일함으로 확인
□ 받은 메일의 발신자 주소 확인 — 이 시점에는 Workspace 계정 주소로 나간다(§5 전까지)
□ 그 메일의 수신거부 링크가 동작하는지 — SALT·WEBAPP_URL 이 그대로이므로 동작해야 정상.
  안 되면 무언가를 건드린 것이다
□ 다음 월요일 04:00 후 주간-발행항목에 행이 들어오는지 — 게이트는 웹앱을 쓰므로 무관해야 정상
□ 다음 월요일 09:00 주간 발송이 Workspace 계정에서 도는지
```

## 6. 롤백

3단계까지 되돌릴 수 있다. 아무것도 파괴하지 않았기 때문이다.

```
□ [Workspace 계정] 트리거 8개 삭제
□ [개인 계정] createDailyTrigger() · createWeeklyTriggers() · createSpecialTrigger() 실행
□ [개인 계정] 검증: checkMailerProps → 8개 복구 확인
```

웹앱·CFG·Secret 을 안 건드렸으므로 되돌릴 것이 없다.

## 7. 한도에 대해 확인된 것과 남은 미지수

### A. ⚠️ 1,500 은 계정을 만든다고 바로 오지 않는다 (2026-09-01 확인)

Apps Script 공식 할당량 문서의 각주다.

> "Additional limits apply for trial accounts. After you convert from a free trial account
>  to a paid subscription, your account limits automatically increase when both of the
>  following are true: Your domain has cumulatively paid at least USD $100 (or equivalent).
>  At least 60 days have passed since reaching that payment threshold."

즉 **누적 결제 $100 + 그로부터 60일**이 지나야 상한이 올라간다. Business Starter 1명은
$7.00/월(연간 약정 시 첫 해 $6.30)이라 **$100 누적에 14~16개월**이 걸리고, 거기에 60일이 더 붙는다.
1명으로 가면 1,500 은 사실상 2027년 이야기다.

### ⛔ 실측 결과 — 100 이었다 (2026-09-01 18:17)

```
[한도] 실행 계정: noreply@brevislab.com
[한도] 잔여 수신자 수: 100
```

계정 주소가 정확히 찍혔으므로 **계정 선택 오류가 아니라 실제 한도가 100** 이다.
**개인 계정과 완전히 같다 — Workspace 이전으로 얻는 것이 현재 0이다.**

추정했던 300~500 은 틀렸다. 그 숫자는 Gmail 일반 발송 한도에 대한 2차 자료였고
Apps Script 기준이 아니었다. 위 각주의 "Additional limits apply for trial accounts" 가
**개인 계정과 동일한 100** 을 의미한다는 것이 이 실측으로 확인됐다.

⚠️ 결제 정보를 넣어도 **무료 체험 기간에는 체험 계정**이다. 체험이 끝나 실제 결제가
일어나야 유료 계정이 되고, 그 뒤에도 누적 $100 + 60일 문턱이 남는다.
1명 연간($6.30/월)이면 $100 누적에 16개월이다.

**남은 확인:** 계정을 만든 지 몇 시간뿐이라 신규 계정 워밍업 기간일 가능성이 있다.
Google 지원 답변은 **"신규 가입자는 2~3일 사용 후 정상 쿼터로 올라간다"** 였다.
이는 위 각주($100 + 60일)와 맞지 않는다 — 어느 쪽이 Apps Script 쿼터에 적용되는지는
**재보는 것 외에 확정할 방법이 없다.** 그래서 일정으로 처리한다.

| 날짜(KST) | 할 일 |
|---|---|
| 09-02 · 09-03 · 09-04 | 매일 `checkQuota` 재측정 |
| **09-05 (금)** | **결정 기한.** 여기서도 100 이면 Workspace 경로를 접고 전용 발송 서비스로 간다 |
| 09-06~07 (주말) | (100 인 경우) 발송 경로 교체 배포 |
| 09-08 (화) | 위험일 — 이때는 이미 해결돼 있어야 한다 |

⚠️ 기한을 두는 이유: 「내일이면 오르겠지」로 미루면 09-08 에 또 한 회차를 잃는다.
2026-09-01 에 잃은 회차가 그렇게 나왔다.

💡 "2~3일 **사용** 후"라는 표현대로, 계정을 실제로 써 두면 도움이 될 수 있다 —
`noreply@brevislab.com` 로 로그인해 며칠간 실제 메일을 몇 통 주고받는다.
발송 평판 워밍업의 통상적인 방법이기도 하다.

**이 실측을 트리거 전환 *전에* 한 것이 중요했다.** 순서를 바꿔 트리거부터 옮겼다면
8개를 다 옮기고 나서야 얻은 게 없음을 알았을 것이고, 그 사이 이중 발송 위험(§3-A)만
떠안았을 것이다.

빨리 1,500 이 필요하면 방법은 하나뿐이다 — **사용자 수를 늘려 $100 을 앞당기는 것.**
예: 2명 연간 선결제 약 $168 이면 결제 즉시 $100 을 넘고, 그로부터 60일 뒤 상한이 오른다.
**지금 정하지 말 것.** 실측값이 300 이상이면 당분간 불필요한 지출이다.

### B. 남은 미지수

계정이 생겨야 확인된다. **추정으로 진행하지 말 것.**

- **별칭 발신.** `noreply@brevislab.com` 으로 `GmailApp.sendEmail({from: ...})` 이 되는가.
  `from` 은 유료 계정에서만 동작하고 `GmailApp.getAliases()` 에 뜨는 send-as 별칭이어야 한다.
  "목록엔 뜨는데 `from` 이 안 먹는다"는 보고가 있어 **실계정에서 1통 보내 확인할 것.**
  안 되면 Workspace 계정 자체를 `noreply@brevislab.com` 으로 만드는 방법이 있다.
- **시험판·신규 유료 계정의 실제 Apps Script 한도.** §7-A. 1단계에서 실측한다.

## 8. 코드 변경

이전이 끝난 뒤에 적용한다. 계정이 준비되기 전에 넣으면 개인 계정에서 잘못된 발신자로 나간다.

```
□ mailer/Code.gs sendMail_ — options.from 을 noreply@brevislab.com 으로 (§7 확인 후)
□ mailQuotaOk_ / mailQuotaWarn_ 안내 문구의 '100명 → 1,500명' 반영
□ CLAUDE.md 의 '구독자 50명 상한' 서술 갱신
```

⚠️ 이 변경들은 **Apps Script 수동 배포가 필요하다.** 방법은 **52행부터 끝까지만 교체**한다.

```
50행   };                        ← CFG 끝
51행   (빈 줄)
52행   // ===== 카테고리 정의 ... ← 여기부터 끝까지
```

VS Code 에서 52행 맨 앞 클릭 → `Ctrl+Shift+End` → `Ctrl+C`, Apps Script 편집기에서 같은 자리에
붙여넣고 저장한다. **CFG(20~50행)를 아예 건드리지 않으므로 `SALT`·`TEST_MODE`·`MARKET_SHEET_ID`
를 실수로 망가뜨릴 경로가 없다.** 라이브와 저장소는 CFG 안의 *값* 3개만 다르고 줄 수가 같아
52행이라는 위치가 양쪽에서 정확히 일치한다(2026-09-01 전체 diff 로 확인).

붙여넣기 전에 라이브 편집기의 52행이 같은 텍스트인지 한 번 보고, 붙여넣은 뒤에는
`checkMailerProps` 를 실행해 문법 오류가 없는지 확인한다.

## 9. 이전까지의 임시 안전망 (커밋 3522a8e — 배포 완료)

이전이 끝날 때까지 지금 구조로 돌아야 한다. 그 기간의 방어는 이렇게 돼 있다.

| | 발송로그 | 한도 부족 시 |
|---|---|---|
| 일일 | 없음 | **막고** 운영자에게 알림 (`mailQuotaOk_`) |
| 주간·스페셜 | 있음 | 막지 않고 **알림** (`mailQuotaWarn_`) — 끊겨도 못 받은 사람에게만 다시 나감 |

**2026-09-01 12:49 배포 완료.** 검증: `CFG.TEST_MODE = false` · `MARKET_SHEET_ID 설정됨` ·
`SALT 설정됨` · 트리거 8개 · `mailQuotaWarn_` 3건(정의 1 + 호출 2). 이때 라이브와 저장소를
전체 diff 해 **차이가 CFG 3줄뿐**임을 확인했다 — 그동안의 수동 배포가 빠짐없이 반영돼 있었다.
