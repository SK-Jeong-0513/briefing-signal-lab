/* 경제 캘린더 이벤트 데이터.
 * 내 일정 추가 = 이 배열에 항목 추가 (mine:true, category:"mine").
 * 국내·글로벌 주요 일정은 여기 큐레이션. 실시간 자동수집은 백엔드 필요(Phase 3).
 * region: kr | us | cn | eu | etc
 * category: indicator(경제지표) | policy(통화정책) | bond(채권·입찰) | earnings(실적) | event(컨퍼런스·이벤트) | mine(내 일정)
 * importance: high | mid | low
 * 주의: 날짜·항목은 형식 검증용 "샘플·예시" 데이터. 실제 일정과 다를 수 있음.
 */
/* 구글 시트 연동:
 * 아래에 시트의 "웹에 게시(CSV)" URL을 넣으면, 그 시트가 캘린더의 실제 소스가 됩니다(공개).
 * 비어 있으면 아래 CAL_EVENTS 샘플을 사용합니다.
 * 시트 열(첫 행 헤더): 날짜 | 지역 | 분류 | 영향도 | 제목 | 설명 | title_en | note_en
 *   날짜=2026-07-15, 지역=한국/미국/중국/유럽/기타, 분류=경제지표/통화정책/채권·입찰/실적/컨퍼런스·이벤트/내 일정, 영향도=높음/보통/낮음
 *   title_en/note_en은 선택(비우면 한국어로 표시).
 */
const CAL_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTu517RrSrdj2QZrwF-v750ta7hq2kq2Z4OxxTTyQF5qsrWWvh9UOGAt3rbBzm8gLTPInrOG6LNnjuJ/pub?gid=0&single=true&output=csv";

const CAL_EVENTS = [
  { date: "2026-07-04", region: "us", category: "indicator", importance: "high", mine: false,
    title: { ko: "미국 6월 고용보고서", en: "US June jobs report" },
    note: { ko: "비농업 고용·실업률", en: "Nonfarm payrolls & unemployment" } },
  { date: "2026-07-08", region: "kr", category: "mine", importance: "mid", mine: true,
    title: { ko: "브리핑 편집 회의", en: "Briefing editorial meeting" },
    note: { ko: "주간 기술 브리핑 리뷰", en: "Weekly tech briefing review" } },
  { date: "2026-07-10", region: "us", category: "indicator", importance: "high", mine: false,
    title: { ko: "미국 6월 CPI", en: "US June CPI" },
    note: { ko: "소비자물가지수", en: "Consumer Price Index" } },
  { date: "2026-07-15", region: "kr", category: "policy", importance: "high", mine: false,
    title: { ko: "한국은행 금통위", en: "BOK rate decision" },
    note: { ko: "기준금리 결정", en: "Base rate decision" } },
  { date: "2026-07-16", region: "us", category: "bond", importance: "mid", mine: false,
    title: { ko: "미국 20년물 국채 입찰", en: "US 20Y bond auction" },
    note: { ko: "국채 발행", en: "Treasury auction" } },
  { date: "2026-07-20", region: "cn", category: "indicator", importance: "mid", mine: false,
    title: { ko: "중국 2분기 GDP", en: "China Q2 GDP" },
    note: { ko: "성장률 발표", en: "Growth release" } },
  { date: "2026-07-24", region: "us", category: "event", importance: "mid", mine: false,
    title: { ko: "(샘플) 글로벌 반도체 서밋", en: "(Sample) Global Semiconductor Summit" },
    note: { ko: "업계 컨퍼런스 예시", en: "Industry conference example" } },
  { date: "2026-07-29", region: "us", category: "policy", importance: "high", mine: false,
    title: { ko: "FOMC 정책금리 결정", en: "FOMC rate decision" },
    note: { ko: "연준 통화정책회의", en: "Fed policy meeting" } },
  { date: "2026-07-31", region: "us", category: "indicator", importance: "high", mine: false,
    title: { ko: "미국 6월 PCE", en: "US June PCE" },
    note: { ko: "개인소비지출 물가", en: "PCE price index" } },
  { date: "2026-08-06", region: "eu", category: "policy", importance: "mid", mine: false,
    title: { ko: "ECB 통화정책회의", en: "ECB policy meeting" },
    note: { ko: "유럽중앙은행", en: "European Central Bank" } },
  { date: "2026-08-12", region: "kr", category: "mine", importance: "low", mine: true,
    title: { ko: "유료 구독 후속 연락", en: "Paid subscriber follow-up" },
    note: { ko: "문의자 회신", en: "Reply to inquiries" } },
  { date: "2026-09-01", region: "etc", category: "event", importance: "low", mine: false,
    title: { ko: "(샘플) 모바일 산업 포럼", en: "(Sample) Mobile industry forum" },
    note: { ko: "컨퍼런스 예시", en: "Conference example" } },
];
