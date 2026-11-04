# ChartConvert

AI가 만든 `.md`의 ` ```mermaid ` 차트를 PNG로 바꿔 서재 리포트로 만드는 로컬 도구입니다.
서재(`read.html`)에는 Mermaid가 없어서, 변환하지 않으면 차트가 코드 텍스트로 보입니다.

사이트에는 아무것도 추가되지 않습니다. Mermaid는 이 폴더에서만 쓰고, 렌더 중 외부 요청은 모두 차단합니다.

## 앱으로 올리기

1. `ChartConvert.bat`(또는 바탕화면 바로가기)을 더블클릭합니다. 브라우저가 열립니다.
2. 원고 `.md`를 화면에 끌어다 놓습니다. 차트 미리보기와 제목·초록이 나옵니다.
3. 파일 이름과 분류를 확인하고, 수치·출처 확인에 체크합니다.
4. **서재에 공개**를 누릅니다. 사이트 반영까지 화면에서 기다렸다가 리포트 링크를 보여 줍니다.

앱을 쓰는 동안 실행 창은 열어 둡니다. 창을 닫은 뒤 서버가 남아도 다음 실행이 정리합니다. 바로 끄려면 `stop.ps1`을 실행합니다.

차트가 없는 원고도 경고를 보여 준 뒤 글만 공개할 수 있습니다.
유형에서 **노트**를 고르면 `public/library/notes/`로 올라가고 분류는 없어도 됩니다.
메모장의 ANSI 파일은 자동으로 UTF-8로 변환하고 알려 줍니다.
포트와 사이트 주소는 `config.json`에서 바꿉니다.

## 처음 한 번

Python `playwright`와 Chromium이 필요합니다. 없으면 `pip install playwright` 후 `playwright install chromium`을 실행합니다.
Mermaid는 앱을 처음 실행할 때 자동으로 설치됩니다.

## 명령어로 올리기

앱 대신 명령어를 쓸 수도 있습니다. 저장소 루트(`BrieSigLab/`)에서 실행합니다.

1. 원고 `.md`를 `ChartConvert/input/`에 넣습니다. 이 폴더는 git에 올라가지 않습니다.
2. 변환합니다. 아직 공개되지 않습니다.

   ```powershell
   python ChartConvert/convert.py ChartConvert/input/원고.md --slug us-federal-interest --category 경제 --tags "국채,이자"
   ```

3. `public/library/reports/`의 `.md`와 `public/library/assets/`의 PNG를 확인합니다.
4. 원고의 수치와 출처를 확인한 뒤 공개합니다.

   ```powershell
   python ChartConvert/convert.py ChartConvert/input/원고.md --slug us-federal-interest --category 경제 --tags "국채,이자" --force --publish
   ```

   2번과 같은 옵션에 `--force --publish`만 더하면 됩니다.

`--publish`는 이 도구가 만든 파일만 커밋해 `main`에 푸시합니다. 목록 갱신과 배포는 `library-manifest.yml`이 이어서 합니다.

## 옵션

| 옵션 | 설명 |
|---|---|
| `--slug` | 필수. 영문 소문자·숫자·하이픈. 결과 파일은 `YYYY-MM-<slug>` (KST 기준 월) |
| `--category` | 원고에 프런트매터가 없으면 필수: 기술 / 금융 / 경제 |
| `--tags` | 쉼표로 구분한 태그 |
| `--force` | 같은 이름의 결과물을 덮어씀 |
| `--publish` | 변환 뒤 커밋·푸시 |

프런트매터가 없으면 제목은 H1, 초록은 첫 일반 문단으로 채웁니다.

## 멈추는 경우

아래는 오류로 멈추고 파일을 쓰지 않습니다.

- mermaid 블록이 0건일 때
- 차트 하나라도 렌더에 실패할 때
- 같은 이름의 결과물이 이미 있을 때(`--force` 없이)
- 프런트매터와 `--category`가 모두 없을 때(노트 제외)
- 글자가 깨진 파일일 때
- 컴퓨터에 있는 이미지를 쓴 원고일 때(인터넷 주소 이미지는 통과)

## 알아둘 점

- **입력은 `.md`만 받습니다.** HTML은 처리하지 않습니다. 내려받은 HTML의 스크립트를 실행하지 않기 위해서입니다.
- **sankey 라벨:** Mermaid의 sankey 문법은 ASCII 라벨만 받습니다. 이 도구가 임시 코드로 그린 뒤 한글로 되돌리므로 원고는 그대로 두면 됩니다.
- **스페셜 메일:** 이 도구의 결과물은 파일 경로 리포트입니다. 메일 렌더러(`renderBody_`)는 이미지 문법을 처리하지 않으므로, 서재 시트 `본문`에 이미지 링크를 넣어 발송하면 글자 그대로 나옵니다.
- **수치 검증은 하지 않습니다.** AI 원고의 숫자는 공개 전에 원자료와 대조하세요.

## 테스트

```powershell
python tests/test_chartconvert.py
python tests/test_chartconvert_app.py
```
