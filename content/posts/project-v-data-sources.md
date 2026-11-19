---
slug: project-v-data-sources
title: PROJECT V 개발기 (2) 데이터 소스 26개의 라이선스와 접근성 확인
summary: vlr.gg, Riot API, GRID, VCT Reference, 공식 위키 등 데이터 소스를 약관과 실제 접근 결과로 판정하고, 무엇을 쓰고 무엇을 쓰지 않을지 정한 과정입니다.
tags: [PROJECT V, 데이터, 라이선스]
series: PROJECT V 개발기
date: 2026-11-19T04:01:00.000Z
comment_term: blog-post-project-v-data-sources
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 2편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `docs/SOURCES.md`, `docs/LICENSE_AUDIT.md`, `docs/handoffs/PV-1-research.md`와 데이터 빌더 코드를 근거로 썼습니다. 각 사이트의 약관과 API 응답은 2026년 11월 18일에 확인한 상태입니다.

게임 엔진을 만든다고 하면 보통 코드부터 떠올립니다.
PROJECT V에서 가장 먼저 커밋된 것은 코드가 아니라 표였습니다.
"이 데이터는 어디서 오고, 우리가 써도 되는가"를 정리한 표입니다.

1편에서 마스터 프롬프트의 데이터 규칙을 소개했습니다.
"정보를 확인하지 못하면 빈칸 또는 `UNVERIFIED`로 남긴다. 추측으로 내용을 채우지 않는다."
이번 편은 이 규칙에 따라 데이터 소스를 하나씩 판정한 과정입니다.
가장 원했던 위치 데이터는 실제로 존재했지만, 약관 때문에 쓰지 않기로 했습니다.

## 한눈에 보기

- 데이터는 세 층으로 나눴습니다. 경기·라운드 통계(Layer A), 선수 열 명의 시점별 위치와 이벤트(Layer B), 시뮬레이션 선례(Layer C)입니다.
- 소스 레지스트리에 26개 항목, 약 70개 URL을 등록하고 하나씩 판정했습니다.
- Layer A는 **VCT Reference**로 해결했습니다. 상업적 사용까지 허용하는 무료 DuckDB 데이터셋입니다.
- Layer B의 가장 좋은 후보였던 **vlr.gg**는 약관이 자동 접근과 재배포를 금지해서 쓰지 않았습니다. 위치 샘플 1,089개가 들어 있는 경기 데이터를 확인한 뒤의 결정입니다.
- **Riot 개발 키**로는 콘텐츠·상태 API만 열렸고, 경기 API는 403이었습니다. **GRID**는 공개 설명에 시점별 위치 항목이 없었습니다.
- 게임 수치(스킬 비용, 반경, 지속 시간, 궁극기 포인트)는 **공식 위키**에서 가져와 값마다 원문과 출처를 남겼습니다. 무기 21개, 요원 30명, 스킬 130개, 스킬 효과 120/120입니다.
- 라이선스가 불분명한 원본 데이터는 커밋하지 않고, 받아서 다시 만드는 스크립트만 커밋했습니다.

## 데이터의 세 층

시뮬레이션 엔진에 필요한 데이터를 정리하면 세 층이 됩니다.

| 층 | 내용 | 엔진에서 쓰이는 곳 |
| --- | --- | --- |
| Layer A | 경기·맵·라운드 통계, 경제, 킬, 요원 픽 | 선수 능력치, 실측 기준선, 경제 판단 |
| Layer B | 선수 열 명의 시점별 위치, 이벤트 좌표 | 이동 속도, 자리 잡기, 교전 위치 |
| Layer C | 기존 시뮬레이션·전술 분석 사례 | 설계 참고 |

먼저 층마다 합법적인 출처가 있는지 확인해야 했습니다.
이 판정은 다른 세션의 설계에도 영향을 줬습니다.
Layer B 실측 위치를 합법적으로 구할 방법이 없다는 결론이 나오자, 데이터 세션(PV-2)과 공간 세션(PV-4)은 위치 데이터를 합성 데이터로 대체하고, 합성이라는 표시를 분명히 붙였습니다.

## 판정 기준부터 정하기

PV-1 세션은 첫 커밋(08:52)에서 소스 레지스트리 `datasets/registry/sources.json`을 만들었습니다.
마스터 프롬프트 3장이 요구한 형식입니다.

소스마다 라이선스, 상업적 사용, 재배포, 머신러닝 사용 가능 여부, 검증 근거 같은 필드를 채우고, 상태를 열 가지 중 하나로 고릅니다.

```text
VERIFIED_DOWNLOADABLE   받아서 열어 봤다
VERIFIED_API            API를 실제로 호출했다
VERIFIED_SOURCE_CODE    소스 코드를 받아 읽었다
VIEW_ONLY               보기만 가능하다
AUTH_REQUIRED           인증이 필요하다
PAID_ACCESS             유료다
LICENSE_RESTRICTED      약관이 막는다
UNVERIFIED              확인하지 못했다
DEPRECATED              더 이상 유지되지 않는다
INACCESSIBLE            접근할 수 없다
```

검증 수준은 네 단계로 나눴습니다.

| 수준 | 의미 |
| --- | --- |
| L0 | 링크가 살아 있다 |
| L1 | 구조를 확인했다(문서, 스키마, 코드) |
| L2 | 실제로 접근해 데이터를 받았다 |
| L3 | 그 데이터로 결과를 재현했다 |

마스터 프롬프트에는 "README에 기능이 소개되어 있다는 이유만으로 Level 3을 부여하지 마라"라는 문장이 있습니다.
이 기준을 엄격하게 적용해서, 처음 등록한 26개 항목 중 L2는 2개, L0는 20개였고 L3는 없었습니다.

## 소스별 판정

### valorant-api.com: 키 없이 쓸 수 있는 소스

커뮤니티가 운영하는 valorant-api.com은 직접 호출해 봤습니다.

- `/v1/version`: 빌드 `release-13.10` (2026-11-07 빌드)
- `/v1/agents?isPlayableCharacter=true`: 요원 30명
- `/v1/weapons`: 무기 21개
- `/v1/maps`: 맵 27개, 월드 좌표를 미니맵 좌표로 바꾸는 변환값 포함

요원·무기·스킬의 이름과 슬롯, 맵 UUID, 미니맵 변환값은 여기서 가져옵니다.
경기 기록, 충돌 지오메트리, 스킬 수치(반경, 지속 시간)는 없습니다.

라이선스나 약관은 찾을 수 없어서 "재배포 가능 여부 알 수 없음"으로 판정했습니다.
그래서 이렇게 정했습니다.

```python
# tools/catalog-builder/build_catalog.py
Outputs (under datasets/catalog/<patch>/, gitignored -- Riot-derived data):
  raw/{version,weapons,agents}.json   provenance copies of API responses
  weapons.json  agents.json  abilities.json  equipment.json

Only this builder + the JSON Schemas + docs are committed; the generated data is
regenerated locally because valorant-api's licence is unclear.
```

**빌더와 스키마, 문서만 커밋하고, 생성된 데이터는 각자 로컬에서 다시 만듭니다.**
통합 이후의 런타임 데이터 패키지 `@pv/game-data`도 같은 원칙을 따릅니다.
무기 데이터 파일은 gitignore되어 있고, 파일이 없으면 내장된 근사 가격표를 씁니다.

### Riot 개발 키: 경기 API는 403

공식 Riot Developer API는 개발 키로 호출했습니다.
키는 세션의 보안 저장소에 있고 프록시가 요청 헤더에 넣어 주는 방식이라, 코드에서 키 값을 읽거나 커밋하지 않습니다.

결과는 이렇습니다(`kr.api.riotgames.com`, 2026-11-18).

| 엔드포인트 | 응답 | 의미 |
| --- | --- | --- |
| `/val/status/v1/platform-data` | 200 | 서버 상태 |
| `/val/content/v1/contents` | 200 | 요원·무기 UUID와 이름. 게임플레이 수치는 없음 |
| `/val/ranked/v1/leaderboards/by-act/*` | 404 | 해당 액트 항목 없음 |
| `/val/match/*` | **403** | production 키 승인이 필요 |

경기 데이터는 개발 키로 열리지 않습니다.
마스터 프롬프트에서 "공식 API가 리플레이 파일 자체를 제공한다고 가정하지 마라"라고 적어 둔 내용이 실제 응답으로 확인됐습니다.

대신 다른 쓸모가 있었습니다.
valorant-api의 UUID와 Riot 공식 콘텐츠 API의 UUID를 비교해 보니 **요원 30/30, 무기 21/21이 일치**했습니다.
커뮤니티 API와 공식 API가 같은 ID 체계를 쓴다는 것을 직접 확인한 것입니다.

개발 키는 24시간마다 만료되고, 레이트 리밋은 초당 20회, 2분에 100회입니다.
그래서 교차검증 스크립트는 키가 없거나 만료돼도 실패하지 않게 만들었습니다.

```python
# tools/catalog-builder/riot_content.py
Endpoint access matrix observed 2026-11-18 (development key):
  GET /val/status/v1/platform-data        -> 200
  GET /val/content/v1/contents?locale=...  -> 200 (release-13.10)
  GET /val/ranked/v1/leaderboards/by-act/* -> 404 (no entries for that act)
  GET /val/match/*                         -> 403 (needs a PRODUCTION key)
...
    except urllib.error.HTTPError as e:
        return None, f"skipped: HTTP {e.code} (dev key expired/absent or endpoint needs production key)"
```

카탈로그 빌드는 이 API에 의존하지 않습니다.
키가 있으면 교차검증하고, 없으면 건너뜁니다.
팀 결정으로는 "Riot 개발 키는 콘텐츠·상태 API 용도로만 쓴다"가 기록됐습니다.

### vlr.gg: 데이터는 있지만 약관상 쓸 수 없음

발로란트 e스포츠 데이터를 찾으면 대부분 vlr.gg부터 떠올립니다.
경기 결과와 선수 통계가 있고, 일부 경기에는 2D 리플레이도 있습니다.
Layer B 위치 데이터의 가장 유력한 후보였습니다.

이 판정은 데이터 조사 세션(PV-1)보다 공간 세션(PV-4)이 먼저 내렸습니다.
PV-4는 Ascent 공간 모델을 만들면서 실제 위치 데이터가 필요했고, 08:58 커밋에서 vlr.gg 약관 원문을 확인했습니다.
기록에 남은 내용은 이렇습니다.

- robots.txt는 매치 페이지 접근을 허용합니다.
- 하지만 **이용약관은 자동 접근과 재배포를 금지**합니다.

> "you will not access the Services through automated or non-human means, whether through a bot, script or otherwise"

> "no Content… may be copied, reproduced, aggregated, republished… distributed…"

콘텐츠 사용 범위는 "personal, non-commercial use or internal business purpose only"입니다.

robots.txt에서 허용한다고 약관에서도 허용하는 것은 아닙니다.
기록은 이 차이를 정확히 구분하고 있습니다.

타당성 확인용으로 Ascent 경기 하나를 열어 보니, 이벤트 193개(킬 173, 설치 16, 해체 4)와 **위치 샘플 1,089개**가 vlr 미니맵 픽셀 좌표로 들어 있었습니다.
원하던 형태의 데이터였지만, 약관에 따라 쓰지 않았습니다.

같은 기준을 관련 소스에도 적용했습니다.

- **vctstats**: 코드는 MIT 라이선스지만, 데이터는 vlr 2D 리플레이를 수집해서 모읍니다. 같은 이유로 데이터는 쓰지 않고, 코드는 스키마 참고용으로만 봤습니다.
- **C9 Gameplan**에도 vlr 통계를 수집하는 스크립트가 있습니다. 이것도 참고만 했습니다.
- vlr 비공식 API 세 개는 `UNVERIFIED`로 남겼습니다. 마스터 프롬프트에 "비공식 API는 공식 데이터 소스라고 표기하지 않는다"는 규칙이 있고, vlr 약관에도 해당합니다.

최종 팀 결정은 이렇습니다.
**"vlr.gg 데이터 사용 금지. 스크레이퍼 미구현, 데이터 미커밋."**

### GRID: 공식 경로이지만 위치 정보는 없음

Riot과 GRID가 함께 내놓은 Riot Open Access는 공식 경로입니다.
조사일 6일 전인 2026년 11월 12일에 출시됐습니다.

공식 페이지를 정리한 `docs/research/GRID_ACCESS.md`에 따르면 조건은 이렇습니다.

- 무료 API 키, 비상업 용도(학생, 연구자, 취미, 초기 프로젝트)
- 데이터는 지연 제공
- 베팅·도박 금지
- 상업 용도는 GRID 영업팀과 별도 유료 라이선스

발로란트 피드에는 라운드 경제, 스킬·궁극기 사용 타이밍, 스파이크 이벤트, 로드아웃, 클러치 확률, 요원 픽이 있습니다.
하지만 공개된 데이터 설명에는 **선수 위치, 좌표, 틱 단위, 미니맵 같은 항목이 없었습니다.**
마스터 프롬프트에서 GRID에 대해 구체적으로 물은 것은 "프로 선수 10명의 시점별 위치 정보를 실제로 얻을 수 있는지"였고, 답은 "확인되지 않으며 제공하지 않을 가능성이 높다"였습니다.

참고로 C9 Gameplan 코드에도 위치 데이터는 GRID 포털의 이벤트 파일과 VCT 파트너 자격으로 얻었고, API로는 메타데이터만 받았다는 주석이 있습니다.

GRID 신청은 하지 않았습니다.
신청 여부는 사람이 정할 일이라고 보고, 신청할 때 필요한 준비물 체크리스트만 만들어 두었습니다.

### VCT Reference: Layer A 데이터

기대 이상이었던 소스도 있습니다.
VCT Reference는 VCT 경기 통계를 DuckDB 파일 하나로 배포합니다.
데이터 세션(PV-2)이 받아서 열어 보니 `vct.duckdb`(13MB) 안에 테이블 10개가 있었습니다.

| 테이블 | 행 수 |
| --- | --- |
| matches | 2,930 |
| maps | 7,398 |
| rounds | 156,769 |

약관은 "Free to use, including commercially, with no warranty"입니다.
출처 표기를 권장하고 도박·베팅 용도를 금지할 뿐, 재배포 금지 조항은 없습니다.
상태는 `VERIFIED_DOWNLOADABLE`, 수준은 L2입니다.

PV-1은 이 DB로 국제전 Ascent 통계를 직접 뽑았습니다.

- 표본: 153맵(팀 기준 306), 패치 2.09 ~ 13.05에 걸친 16개 패치
- 픽률: Sova 81.4%, Omen 72.2%, Jett 69.9%, KAY/O 55.2%, Killjoy 49.7%, Astra 26.5%, Fade 19.6%, Chamber 18.0%
- 가장 흔한 조합(Jett·KAY/O·Killjoy·Omen·Sova): 85맵, 맵 승률 57.6%
- 역할 구성: Controller 1 / Duelist 1 / Initiator 2 / Sentinel 1이 52.6%, 그다음은 센티넬을 둘 쓰는 1 / 1 / 1 / 2가 17.0%
- 공수 라운드 승률: 공격 47.2%, 수비 52.8%. Ascent는 수비가 유리한 맵입니다.

원본 DuckDB는 매일 다시 만들어지고 용량도 커서 커밋하지 않습니다.
대신 집계 결과와 함께 원본의 SHA-256, 약관 URL, 패치 범위를 커밋합니다.
표본의 한계도 데이터 파일 안에 적었습니다.

```json
// datasets/derived/comps/ascent-comps.json
"filter": "is_international = TRUE",
"sampleCaveats": [
  "Sample = 306 team-maps (153 maps) of international Ascent.",
  "Patches span Patch 2.09 .. Patch 13.05 (16 distinct); aggregates blend multiple metas, NOT stamped to the current build. Ascent rotates in/out of the pool, so recent pick rates may differ.",
  ...
]
```

실측 결과가 나오면서 이전 판단 하나를 수정했습니다.
그 전 차수에서 PV-1은 실측 데이터 없이 "대표 요원" 10명을 골라 스킬 효과 명세를 만들었습니다.
실측 픽률 상위 8명과 비교해 보니 6명이 겹쳤고, Fade와 Chamber가 Cypher, Gekko, Breach, Viper보다 많이 쓰이고 있었습니다.
그래서 다음 확장은 픽률 순서대로 진행했습니다.

## 게임 수치는 공식 위키에서, 값마다 출처와 함께

valorant-api에는 스킬 수치가 없습니다.
그래서 처음 카탈로그를 만들 때(2차)는 스킬의 비용, 충전 수, 쿨다운, 궁극기 포인트, 지속 시간을 **모두 `null`과 `verified: false`로 두고**, 추정값은 넣지 않았습니다.

빌더도 추정값이 들어가지 않는 구조로 만들었습니다.
변환 로직은 순수 함수로 분리하고, 수치는 출처가 붙은 사실 테이블로만 주입합니다.
테이블에 없으면 `null`이 됩니다.

3차부터는 공식 VALORANT 위키(wiki.playvalorant.com)를 출처로 썼습니다.

- 스킬 집계표를 파싱해 valorant-api와 스킬 이름으로 조인: 비패시브 스킬 120/120, 궁극기 포인트 30/30
- 방어구: Light 400크레딧/25, Heavy 1000/50, Regen 650/25(+재생 풀 50)
- 스파이크: 설치 4,000ms, 해체 7,000ms, 절반 해체 3,500ms, 폭발 45,000ms
- 스킬별 페이지의 표와 인포박스에서 반경, 지속 시간, 쿨다운, 사거리, 시전 시간, 키바인드

값마다 원문 문자열과 확인 근거를 남깁니다.
Omen의 연막(Dark Cover)은 이렇게 저장됩니다.

```json
// tools/catalog-builder/data/ability_effects.json (공백을 줄였습니다)
"params": { "deployTimeMs": 1000.0, "rangeMeters": 80.0, "radiusMeters": 4.1,
            "durationMs": 15000.0, "cooldownMs": 40000.0, "blocksVision": true,
            "defaultKeybind": "E", "damage": null, "affectsAllies": null },
"fieldSources": {
  "radiusMeters": { "raw": "4.1 meters",          "confirmed": "Game files" },
  "durationMs":   { "raw": "15 seconds",          "confirmed": "v0.50" },
  "cooldownMs":   { "raw": "Cooldown 40 seconds", "confirmed": "infobox" },
  "blocksVision": { "raw": "definitional (smoke occludes sightlines)", "confirmed": "definition" }
},
"sourcePage": "https://wiki.playvalorant.com/en-us/Dark_Cover",
```

`damage`와 `affectsAllies`는 위키에서 확인하지 못해서 `null`입니다.
`blocksVision: true`는 위키 수치가 아니라 "연막은 정의상 시야를 가린다"는 근거로 넣었고, 그 근거도 함께 적혀 있습니다.

작업하면서 정한 세부 원칙은 이렇습니다.

- **팬덤 위키는 출처로 쓰지 않았습니다.** 요원 페이지의 수치가 Lua 모듈 안에 있어서 추출할 수 없었습니다.
- Astra의 Nebula 서브페이지는 404였습니다. 다음 차수에서 Astra 메인 페이지에서 값을 찾아 120/120을 채웠습니다.
- 키바인드는 인포박스 39개에서 확인한 슬롯↔키 매핑(Ability1→Q, Ability2→E, Grenade→C, Ultimate→X)이 100% 일관적이어서, 페이지별 정규식 추출보다 이 매핑을 우선했습니다.
- 위키 값을 "13.10 기준 값"으로 본 근거도 적었습니다. valorant-api로 라이브 빌드가 13.10임을 확인했고, 공식 위키는 라이브 값을 반영합니다. 패치노트를 역추적한 값이 아니라는 점은 레코드마다 표시했습니다.

### 다른 세션의 값은 기록으로 바로잡기

공식 값으로 카탈로그를 채운 뒤, PV-1은 코어 세션(PV-3)이 먼저 만든 게임 규칙 패키지와 숫자를 대조했습니다.
실드, 스파이크, 무기 가격은 일치했고, 궁극기 포인트는 표본 6명 중 4명이 달랐습니다.

| 요원 | PV-3 값 | 공식 값 |
| --- | --- | --- |
| Jett | 8 | 7 |
| Brimstone | 8 | 7 |
| Sage | 7 | 8 |
| Killjoy | 9 | 8 |

1편에서 소개한 규칙에 따라 PV-1은 다른 세션의 파일을 직접 고치지 않습니다.
"공식 값으로 교체 권고"라고 기록만 남겼고, PV-3가 이를 읽고 09:35에 30명 전체의 궁극기 포인트를 공식 값으로 맞췄습니다.
세션끼리 직접 대화하지 않고 문서와 커밋으로 의견을 주고받은 사례입니다.

## 전술 지식에는 출처를 억지로 붙이지 않기

Ascent 전술 지식 베이스(공격 8개, 수비 9개 요소)를 만들 때, "A 메인을 연막으로 막고 미드를 장악한다" 같은 전술은 인용할 만한 출처가 거의 없었습니다.

그래서 출처 링크를 지어내지 않고, 이런 항목에는 `expert-knowledge-unsourced` 표시를 달았습니다.
Ascent 위키는 지형(어느 구역이 어디와 이어지는지)의 출처로만 쓰고, 공식 문서로 메커니즘이 확인되는 센티넬 셋업 두 개만 `official`로 분류했습니다.
"이 전술이 프로 경기의 몇 %에서 나온다" 같은 빈도 수치는 근거가 없어서 쓰지 않았습니다.

## 커밋 정책 세 단계

판정한 데이터를 저장소에 넣는 방식은 세 단계로 정리됐습니다.

| 종류 | 예 | 정책 |
| --- | --- | --- |
| 라이선스가 불분명한 대량 원본 | valorant-api 응답, `vct.duckdb`, Blender 맵, `.vrf` | 커밋하지 않음. 받아서 다시 만드는 스크립트만 커밋 |
| 출처 URL이 붙은 작은 사실 테이블 | `ability_facts.json`, `ability_effects.json` | 커밋 |
| 집계 파생물 | `ascent-comps.json` | 원본 해시와 약관 URL을 붙여 커밋 |

## 사람이 정할 일은 기록으로 남기기

조사 중에 AI가 대신 정하면 안 되는 문제가 몇 가지 나왔습니다.
GRID 신청, 키 발급, 프로 선수 실명 사용입니다.

PV-1은 이런 항목을 직접 결정하지 않고 "사용자 결정 필요"로 남겼습니다.
프로 선수 핸들과 팀 이름은 제가 "출시 전 내부 개발 단계이니 허용한다"고 정했고, 감사 문서는 이 결정에 맞춰 해당 항목을 다시 분류했습니다(10:05 커밋).
조건도 붙였습니다.

- 일반인 식별자(리플레이 파일 속 프로필 이름, `이름#태그`)는 계속 위반으로 취급합니다.
- 출시 전에 초상권과 상표에 대한 법무 검토를 거칩니다.

머지 직전에는 여섯 브랜치의 커밋 50개를 대상으로 라이선스·개인정보·출처 감사를 했습니다.
결과는 **차단 항목 0건, 통합 시 조치 6건**이었고, 비밀정보나 `.env`, Riot ID, 일반인 실명은 0건이었습니다.
조치 6건은 서드파티 고지문 추가, 리플레이 브랜치 squash 같은 것으로, 통합 때 모두 처리했습니다.
자세한 내용은 10편에서 다룹니다.

## 정리

이 단계의 결과물은 엔진이 아니라 데이터 소스 판정표였습니다.
쓸 수 있는 것(VCT Reference, 공식 위키, valorant-api), 쓸 수 없는 것(vlr.gg), 아직 열리지 않은 것(Riot 경기 API, GRID 위치)을 구분해 두자, 다른 세션들이 이를 바탕으로 설계를 정할 수 있었습니다.
위치 데이터가 없다는 것을 일찍 확인했기 때문에, 공간 엔진은 처음부터 합성 데이터로 동작하고 나중에 실측 데이터로 교체할 수 있는 구조로 만들었습니다.

## 남은 과제

- **실측 위치(Layer B) 확보.** 가장 현실적인 방법은 제가 직접 Ascent 5v5 커스텀 게임을 하고 그 리플레이 파일(`.vrf`)을 쓰는 것입니다. 자기 리플레이에는 제3자 약관이 적용되지 않습니다. 파이프라인은 준비되어 있고 9편에서 다룹니다.
- **현재 메타 기준 통계.** 카탈로그는 13.10 값이지만 Ascent 통계에는 2.09부터 13.05까지의 메타가 섞여 있습니다. 조합 통계에 9.x 이후(42맵) 필터를 적용하는 작업이 남아 있습니다.
- **스킬 효과 유형 확장.** 스킬 효과 20건(Cyber Cage, Blade Storm, Resurrection 등)은 엔진에 텔레포트, 부활, 조종 드론 같은 유형이 아직 없어서 효과 유형이 비어 있습니다.
- 소스 레지스트리의 상태 값을 최신 판정에 맞춰 갱신합니다.

다음 편에서는 확보한 Layer A 데이터로 한 작업을 다룹니다.
실측 기준선, 쓰지 않기로 한 머신러닝 모델, 그리고 알 수 없는 능력치는 비워 둔 선수 능력치 추정입니다.

## 참고 자료

- [docs/SOURCES.md](https://github.com/2rangs/Project-VM/blob/main/docs/SOURCES.md)
- [docs/DATA_AVAILABILITY.md](https://github.com/2rangs/Project-VM/blob/main/docs/DATA_AVAILABILITY.md)
- [docs/LICENSE_AUDIT.md](https://github.com/2rangs/Project-VM/blob/main/docs/LICENSE_AUDIT.md)
- [docs/research/GRID_ACCESS.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/GRID_ACCESS.md)
- [docs/research/CATALOG.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/CATALOG.md)
- [docs/handoffs/PV-1-research.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-1-research.md)
- [datasets/registry/sources.json](https://github.com/2rangs/Project-VM/blob/main/datasets/registry/sources.json)
- [tools/catalog-builder](https://github.com/2rangs/Project-VM/tree/main/tools/catalog-builder)
