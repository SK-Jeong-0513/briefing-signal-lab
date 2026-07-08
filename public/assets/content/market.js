/* 시장(주식) 탭 데이터 소스 — 구글 시트 "웹에 게시(CSV)" URL.
 * 시트 준비 후 각 탭의 published CSV URL을 넣으면 그 시트가 실제 소스가 됩니다(공개).
 * 비어 있으면 "준비 중" 플레이스홀더가 표시됩니다(정적 스캐폴드 단계).
 *
 * 시장-일일 탭 컬럼:  날짜 · 제목 · 한줄 · 출처URL · access
 * 시장-종목 탭 컬럼:  날짜 · 티커 · 이름 · 요약 · 근거 · 출처URL · access
 */
const MARKET_DAILY_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR9qlZFl78TiUcCCKApDu7dD_4rkGF8tlYWpyV2dzaTQg6WFtd9DJoNMyjyPa-dn21JzQ1ivAVKPd31/pub?gid=0&single=true&output=csv";
const MARKET_TICKERS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR9qlZFl78TiUcCCKApDu7dD_4rkGF8tlYWpyV2dzaTQg6WFtd9DJoNMyjyPa-dn21JzQ1ivAVKPd31/pub?gid=2102188761&single=true&output=csv";
