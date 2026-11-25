
PROJECT V에서 가장 먼저 커밋된 건 코드가 아니라 표였다. "이 데이터는 어디서 오고, 우리가 써도 되는가"를 정리한 표다. 1편에서 쓴 마스터 프롬프트의 데이터 규칙, "정보를 확인하지 못하면 빈칸 또는 `UNVERIFIED`로 남긴다. 추측으로 내용을 채우지 않는다."를 실제로 적용한 결과이고, 약관과 API 응답은 2026년 11월 18일 기준이다. 가장 원했던 위치 데이터는 실제로 있었지만, 약관 때문에 쓰지 않기로 했다.

## 필요한 데이터는 세 층

엔진에 필요한 데이터는 세 층으로 나뉜다. Layer A는 경기·맵·라운드 통계와 경제, 킬, 요원 픽으로, 선수 능력치와 실측 기준선, 경제 판단에 쓴다. Layer B는 선수 열 명의 시점별 위치와 이벤트 좌표로, 이동 속도와 자리 잡기, 교전 위치에 쓴다. Layer C는 기존 시뮬레이션과 전술 분석 사례로, 설계 참고용이다.

층마다 합법적인 출처가 있는지가 먼저였고, 이 판정은 다른 세션의 설계까지 바꿨다. Layer B 실측 위치를 합법적으로 구할 길이 없다는 결론이 나오자, 데이터 세션(PV-2)과 공간 세션(PV-4)은 위치를 합성 데이터로 대신하고 합성이라는 표시를 분명히 붙였다.

PV-1 세션은 첫 커밋(08:52)에서 소스 레지스트리 `datasets/registry/sources.json`을 만들었다. 소스마다 라이선스, 상업적 사용, 재배포, 머신러닝 사용 가능 여부, 검증 근거를 채우고 상태는 `VERIFIED_DOWNLOADABLE`(받아서 열어 봤다), `VERIFIED_API`(실제로 호출했다)부터 `LICENSE_RESTRICTED`(약관이 막는다), `UNVERIFIED`(확인하지 못했다), `INACCESSIBLE`까지 열 가지 중 하나로 고른다.

검증 수준도 L0(링크가 살아 있다), L1(문서·스키마·코드로 구조를 확인했다), L2(실제로 데이터를 받았다), L3(그 데이터로 결과를 재현했다)로 나눴다. 마스터 프롬프트에 "README에 기능이 소개되어 있다는 이유만으로 Level 3을 부여하지 마라"라고 적어 둔 덕에 기준이 엄격하게 적용됐고, 처음 등록한 26개 항목(URL 약 70개) 중 L2는 2개, L0는 20개, L3는 하나도 없었다.

## 소스별로 하나씩

커뮤니티가 운영하는 valorant-api.com은 키 없이 직접 호출해 봤다. `/v1/version`은 빌드 `release-13.10`(2026-11-07 빌드), `/v1/agents?isPlayableCharacter=true`는 요원 30명, `/v1/weapons`는 무기 21개, `/v1/maps`는 맵 27개와 월드 좌표를 미니맵 좌표로 바꾸는 변환값을 돌려줬다. 요원·무기·스킬 이름과 슬롯, 맵 UUID, 미니맵 변환값은 여기서 가져온다. 경기 기록, 충돌 지오메트리, 스킬 수치는 없다. 라이선스나 약관을 찾을 수 없어서 "재배포 가능 여부 알 수 없음"으로 판정했고, 그래서 빌더와 스키마, 문서만 커밋하고 생성된 데이터는 각자 로컬에서 다시 만들게 했다. 통합 뒤의 런타임 데이터 패키지 `@pv/game-data`도 같다. 무기 데이터 파일은 gitignore되어 있고, 없으면 내장된 근사 가격표를 쓴다.

공식 Riot Developer API는 개발 키로 호출했다. 키는 세션의 보안 저장소에 있고 프록시가 헤더에 넣어 주기 때문에 코드에서 키 값을 읽거나 커밋하지 않는다. `kr.api.riotgames.com` 기준으로 `/val/status/v1/platform-data`와 `/val/content/v1/contents`는 200, `/val/ranked/v1/leaderboards/by-act/*`는 해당 액트 항목이 없어 404, `/val/match/*`는 production 키 승인이 필요해 403이었다. 경기 데이터는 개발 키로 열리지 않는다. 마스터 프롬프트에 "공식 API가 리플레이 파일 자체를 제공한다고 가정하지 마라"라고 적어 둔 내용이 실제 응답으로 확인됐다.

대신 쓸모가 하나 있었다. valorant-api의 UUID를 Riot 공식 콘텐츠 API와 비교해 보니 요원 30/30, 무기 21/21이 일치했다. 커뮤니티 API와 공식 API가 같은 ID 체계를 쓴다는 걸 직접 확인했다. 개발 키는 24시간마다 만료되기 때문에 교차검증 스크립트는 키가 없거나 만료돼도 실패하지 않고 건너뛰게 만들었다. 카탈로그 빌드는 이 API에 의존하지 않는다. 팀 결정에는 "Riot 개발 키는 콘텐츠·상태 API 용도로만 쓴다"가 기록됐다.

## vlr.gg는 데이터가 있어도 못 쓴다

vlr.gg는 경기 결과와 선수 통계에 일부 경기 2D 리플레이까지 있어서 Layer B의 가장 유력한 후보였다. 이 판정은 PV-1보다 PV-4가 먼저 내렸다. Ascent 공간 모델에 실제 위치 데이터가 필요했던 PV-4가 08:58 커밋에서 약관 원문을 확인했다. robots.txt는 매치 페이지 접근을 허용하지만 이용약관은 자동 접근과 재배포를 금지한다.

> "you will not access the Services through automated or non-human means, whether through a bot, script or otherwise"

> "no Content… may be copied, reproduced, aggregated, republished… distributed…"

콘텐츠 사용 범위도 "personal, non-commercial use or internal business purpose only"다. robots.txt가 허용한다고 약관이 허용하는 건 아니고, 기록은 이 둘을 정확히 구분하고 있다.

타당성 확인용으로 Ascent 경기 하나를 열어 보니 이벤트 193개(킬 173, 설치 16, 해체 4)와 위치 샘플 1,089개가 vlr 미니맵 픽셀 좌표로 들어 있었다. 딱 원하던 형태였지만 쓰지 않았다. 같은 기준으로, MIT 라이선스 코드지만 데이터는 vlr 2D 리플레이를 긁어 모으는 vctstats는 코드만 스키마 참고용으로 봤고, vlr 통계 수집 스크립트가 있는 C9 Gameplan도 참고만 했다. vlr 비공식 API 세 개는 "비공식 API는 공식 데이터 소스라고 표기하지 않는다"는 규칙에 따라 `UNVERIFIED`로 남겼다. 최종 팀 결정은 "vlr.gg 데이터 사용 금지. 스크레이퍼 미구현, 데이터 미커밋."이다.

GRID는 공식 경로다. Riot과 GRID가 함께 낸 Riot Open Access는 조사 6일 전인 2026년 11월 12일에 나왔다. `docs/research/GRID_ACCESS.md`에 정리한 조건은 무료 API 키에 비상업 용도(학생, 연구자, 취미, 초기 프로젝트), 지연 제공, 베팅·도박 금지이고, 상업 용도는 GRID 영업팀과 별도 유료 라이선스다. 발로란트 피드에는 라운드 경제, 스킬 타이밍, 스파이크 이벤트, 로드아웃 등이 있지만 공개된 설명에 선수 위치나 좌표, 틱 단위, 미니맵 항목은 없었다. 마스터 프롬프트가 GRID에 대해 물은 건 "프로 선수 10명의 시점별 위치 정보를 실제로 얻을 수 있는지"였고, 답은 "확인되지 않으며 제공하지 않을 가능성이 높다"였다. 신청은 사람이 정할 일이라 하지 않았고, 신청할 때 필요한 준비물 체크리스트만 만들어 뒀다.

## Layer A는 VCT Reference로

기대 이상이었던 건 VCT Reference다. VCT 경기 통계를 DuckDB 파일 하나로 배포하는데, PV-2가 받아 보니 `vct.duckdb`(13MB)에 테이블 10개, matches 2,930행, maps 7,398행, rounds 156,769행이 들어 있었다. 약관은 "Free to use, including commercially, with no warranty"이고, 출처 표기 권장과 도박·베팅 금지 외에 재배포 금지 조항은 없다. `VERIFIED_DOWNLOADABLE`, L2로 판정했다.

PV-1은 이 DB로 국제전 Ascent 통계를 직접 뽑았다. 표본은 153맵(팀 기준 306), 패치 2.09~13.05의 16개 패치다. 픽률은 Sova 81.4%, Omen 72.2%, Jett 69.9%, KAY/O 55.2%, Killjoy 49.7%, Astra 26.5%, Fade 19.6%, Chamber 18.0% 순이고, 가장 흔한 조합(Jett·KAY/O·Killjoy·Omen·Sova)은 85맵에서 맵 승률 57.6%였다. 역할 구성은 Controller 1 / Duelist 1 / Initiator 2 / Sentinel 1이 52.6%, 센티넬 둘을 쓰는 1 / 1 / 1 / 2가 17.0%다. 라운드 승률은 공격 47.2%, 수비 52.8%로 Ascent는 수비가 유리했다.

원본 DuckDB는 매일 다시 만들어지고 크기도 커서 커밋하지 않는다. 집계 결과와 함께 원본의 SHA-256, 약관 URL, 패치 범위를 커밋하고, 표본의 한계도 데이터 파일 안에 적었다.

```json
// datasets/derived/comps/ascent-comps.json
"filter": "is_international = TRUE",
"sampleCaveats": [
  "Sample = 306 team-maps (153 maps) of international Ascent.",
  "Patches span Patch 2.09 .. Patch 13.05 (16 distinct); aggregates blend multiple metas, NOT stamped to the current build. Ascent rotates in/out of the pool, so recent pick rates may differ.",
  ...
]
```

이 결과로 이전 판단 하나를 고쳤다. 그 전 차수에서 PV-1은 실측 없이 "대표 요원" 10명을 골라 스킬 효과 명세를 만들었는데, 실측 픽률 상위 8명과 겹치는 건 6명뿐이었고 Fade와 Chamber가 Cypher, Gekko, Breach, Viper보다 많이 쓰이고 있었다. 그래서 다음 확장은 픽률 순서로 진행했다.

## 게임 수치는 공식 위키에서, 값마다 출처를 붙여

valorant-api에는 스킬 수치가 없어서, 처음 카탈로그를 만들 때(2차)는 비용, 충전 수, 쿨다운, 궁극기 포인트, 지속 시간을 전부 `null`과 `verified: false`로 두고 추정값을 넣지 않았다. 빌더도 그렇게 짰다. 변환 로직은 순수 함수로 떼어 내고, 수치는 출처가 붙은 사실 테이블로만 주입한다. 테이블에 없으면 `null`이 된다.

3차부터는 공식 VALORANT 위키(wiki.playvalorant.com)를 출처로 썼다. 스킬 집계표를 파싱해 valorant-api와 스킬 이름으로 조인해서 비패시브 스킬 120/120, 궁극기 포인트 30/30을 채웠다. 방어구는 Light 400크레딧/25, Heavy 1000/50, Regen 650/25(+재생 풀 50), 스파이크는 설치 4,000ms, 해체 7,000ms, 절반 해체 3,500ms, 폭발 45,000ms다. 반경, 지속 시간, 쿨다운, 사거리, 시전 시간, 키바인드는 스킬별 페이지의 표와 인포박스에서 가져왔다. 값마다 원문 문자열과 확인 근거가 남는다. Omen의 연막(Dark Cover)은 이렇게 저장된다.

```json
// tools/catalog-builder/data/ability_effects.json (공백을 줄였다)
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

`damage`와 `affectsAllies`는 위키에서 확인하지 못해 `null`이고, `blocksVision: true`는 위키 수치가 아니라 "연막은 정의상 시야를 가린다"는 근거로 넣었다는 게 같이 적혀 있다.

팬덤 위키는 요원 페이지 수치가 Lua 모듈 안에 있어서 추출할 수 없었고, 출처로 쓰지 않았다. Astra의 Nebula 서브페이지는 404였는데, 다음 차수에서 Astra 메인 페이지에서 값을 찾아 120/120을 채웠다. 키바인드는 인포박스 39개에서 확인한 슬롯↔키 매핑(Ability1→Q, Ability2→E, Grenade→C, Ultimate→X)이 100% 일관적이어서 페이지별 정규식 추출보다 이 매핑을 우선했다. 위키 값은 라이브 빌드(13.10) 기준으로 보되, 패치노트를 역추적한 값이 아니라는 표시를 레코드마다 붙였다.

공식 값으로 카탈로그를 채운 뒤 PV-1은 코어 세션(PV-3)이 먼저 만든 게임 규칙 패키지와 숫자를 대조했다. 실드, 스파이크, 무기 가격은 맞았는데 궁극기 포인트는 표본 6명 중 4명이 달랐다.

| 요원 | PV-3 값 | 공식 값 |
| --- | --- | --- |
| Jett | 8 | 7 |
| Brimstone | 8 | 7 |
| Sage | 7 | 8 |
| Killjoy | 9 | 8 |

PV-1은 규칙상 다른 세션의 파일을 직접 고치지 않는다. "공식 값으로 교체 권고"라고 기록만 남겼고, PV-3가 이걸 읽고 09:35에 30명 전체의 궁극기 포인트를 공식 값으로 맞췄다. 세션끼리 대화 없이 문서와 커밋만으로 의견이 오간 경우다.

Ascent 전술 지식 베이스(공격 8개, 수비 9개 요소)를 만들 때는 반대 문제가 있었다. "A 메인을 연막으로 막고 미드를 장악한다" 같은 전술은 인용할 출처가 거의 없다. 그래서 링크를 지어내지 않고 이런 항목에 `expert-knowledge-unsourced` 표시를 달았다. Ascent 위키는 어느 구역이 어디와 이어지는지 같은 지형의 출처로만 썼고, 공식 문서로 메커니즘이 확인되는 센티넬 셋업 두 개만 `official`로 분류했다. "이 전술이 프로 경기의 몇 %에서 나온다" 같은 빈도는 근거가 없어서 쓰지 않았다.

## 무엇을 커밋하고, 무엇을 사람에게 넘기나

커밋 정책은 세 가지로 정리됐다. valorant-api 응답, `vct.duckdb`, Blender 맵, `.vrf`처럼 라이선스가 불분명한 대량 원본은 커밋하지 않고 받아서 다시 만드는 스크립트만 커밋한다. `ability_facts.json`, `ability_effects.json`처럼 출처 URL이 붙은 작은 사실 테이블은 커밋한다. `ascent-comps.json` 같은 집계 파생물은 원본 해시와 약관 URL을 붙여 커밋한다.

GRID 신청, 키 발급, 프로 선수 실명 사용처럼 AI가 대신 정하면 안 되는 문제는 PV-1이 "사용자 결정 필요"로 남겼다. 선수 핸들과 팀 이름은 내가 "출시 전 내부 개발 단계이니 허용한다"고 정했고, 감사 문서는 이에 맞춰 해당 항목을 다시 분류했다(10:05 커밋). 다만 리플레이 파일 속 프로필 이름이나 `이름#태그` 같은 일반인 식별자는 계속 위반으로 취급하고, 출시 전에 초상권과 상표 법무 검토를 거친다는 조건을 붙였다.

머지 직전에는 여섯 브랜치의 커밋 50개를 대상으로 라이선스·개인정보·출처 감사를 했다. 차단 항목 0건, 통합 시 조치 6건이었고 비밀정보, `.env`, Riot ID, 일반인 실명은 0건이었다. 조치 6건은 서드파티 고지문 추가, 리플레이 브랜치 squash 같은 것으로 통합 때 모두 처리했다(10편).

위치 데이터가 없다는 걸 일찍 확인한 덕에 공간 엔진은 처음부터 합성 데이터로 돌고 나중에 실측으로 갈아 끼울 수 있게 만들어졌다. 실측 위치를 얻는 가장 현실적인 방법은 내가 직접 Ascent 5v5 커스텀 게임을 하고 그 리플레이(`.vrf`)를 쓰는 것이다. 자기 리플레이에는 제3자 약관이 걸리지 않는다. 파이프라인은 준비돼 있고 9편에서 다룬다.

그 밖에 남은 일도 있다. 카탈로그는 13.10 값인데 Ascent 통계에는 2.09부터 13.05까지의 메타가 섞여 있어서, 조합 통계에 9.x 이후(42맵) 필터를 적용해야 한다. Cyber Cage, Blade Storm, Resurrection 등 스킬 효과 20건은 엔진에 텔레포트, 부활, 조종 드론 같은 유형이 아직 없어 효과 유형이 비어 있다. 소스 레지스트리 상태 값도 최신 판정에 맞춰 갱신해야 한다.

다음 편은 이렇게 확보한 Layer A 데이터로 실측 기준선과 선수 능력치를 만든 이야기다.

## 참고 자료

- [docs/SOURCES.md](https://github.com/2rangs/Project-VM/blob/main/docs/SOURCES.md)
- [docs/DATA_AVAILABILITY.md](https://github.com/2rangs/Project-VM/blob/main/docs/DATA_AVAILABILITY.md)
- [docs/LICENSE_AUDIT.md](https://github.com/2rangs/Project-VM/blob/main/docs/LICENSE_AUDIT.md)
- [docs/research/GRID_ACCESS.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/GRID_ACCESS.md)
- [docs/research/CATALOG.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/CATALOG.md)
- [docs/handoffs/PV-1-research.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-1-research.md)
- [datasets/registry/sources.json](https://github.com/2rangs/Project-VM/blob/main/datasets/registry/sources.json)
- [tools/catalog-builder](https://github.com/2rangs/Project-VM/tree/main/tools/catalog-builder)
