---
slug: project-v-prologue
title: PROJECT V 개발기 (1) 발로란트 경기 시뮬레이션 엔진을 만들기 시작했다
summary: 결과를 미리 정하지 않고 선수 열 명이 경기를 진행하는 엔진의 첫 초안 기록이다. 문서 두 개와 AI 세션 일곱 개로 첫날 만든 것을 적었다.
tags: [PROJECT V, 게임 AI, AI 에이전트]
series: PROJECT V 개발기
date: 2026-11-19T04:00:00.000Z
comment_term: blog-post-project-v-prologue
---

발로란트 프로 경기를 보다 보면 "저기서 B로 돌았으면 어땠을까", "에코 라운드에 오퍼레이터를 살렸으면 다음 라운드는 이겼을까" 같은 생각이 든다. 축구에는 Football Manager가 있고 야구에는 Out of the Park Baseball이 있는데, 발로란트에는 아직 그런 게임이 없다.

PROJECT V는 발로란트 5v5 경기를 독립된 시뮬레이션 엔진으로 다시 만들고, 그 위에 매니저 게임을 올리려는 프로젝트다. 이 연재는 그 엔진의 첫 초안을 만든 기록이다. 근거는 [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 커밋, 문서, 코드이고, 글에 나오는 수치는 저장소에 남은 기록이거나 내가 다시 돌려 본 결과다.

코드는 대부분 AI 에이전트가 썼다. 여섯 개 세션이 동시에 작업했고, 첫 AI 커밋부터 시뮬레이션 가능한 초안이 main에 들어가기까지 6시간 16분이 걸렸다. 그중 4시간 8분은 사용량 제한으로 모든 세션이 멈춰 있던 시간이다.

## 결과를 먼저 정하지 않는다

스포츠 게임의 경기 엔진을 가장 쉽게 만드는 방법은 능력치로 승자를 먼저 뽑고, 그럴듯한 하이라이트를 나중에 붙이는 것이다.

```text
Team A OVR = 85
Team B OVR = 80

Calculate Match Winner
        ↓
Generate Fake Replay
```

빠르고 단순하지만 이렇게 하면 감독의 지시가 결과에 끼어들 틈이 없다. "B로 페이크를 주고 A로 돌아라"라는 지시가 의미를 가지려면 결과가 지시보다 먼저 정해져 있으면 안 된다. 그래서 인수인계 문서의 DECISION-002로 이 방식을 쓰지 않기로 못 박았다.

대신 선수 열 명이 각자 보이는 것만 보고 판단하고, 움직이고, 스킬을 쓰고, 총을 쏜다. 그 사건들이 쌓여 라운드 결과가 나온다. 승패는 입력이 아니라 출력이다. 나머지 설계는 대부분 여기서 따라 나온다. 맵이 있어야 하고(공간 엔진), 선수가 무엇을 볼 수 있는지 알아야 하고(지각 엔진), 안 보이는 것은 추측해야 하고(Belief State), 할 수 있는 행동을 만들어야 하고(Action Generator), 총싸움을 판정해야 한다(교전 엔진).

## 내가 쓴 건 문서 두 개

저장소의 첫 커밋 네 개는 내가 올렸다. 17:12(KST) `28ec69a` Initial commit, 17:18 `a95456e` 마스터 프롬프트 추가(커밋 메시지는 오타 그대로 `add RAEDme.md`), 17:29 `3934026` 프롬프트 수정, 17:35 `c55733a` 인수인계 문서 `Handoff.md` 추가. 그 뒤 커밋 164개는 AI 세션들이 썼다.

2,840줄짜리 `README.md`의 제목은 "통합 개발 마스터 프롬프트"다. 게임 엔진 아키텍트부터 전술 분석가, QA까지 역할 열두 개를 AI에게 주는 것으로 시작하고, 바로 다음에 이 문장이 나온다.

> 문서만 작성하고 개발이 완료되었다고 보고하지 마라.

이 프롬프트에서 가장 신경 쓴 건 기능 목록이 아니라 데이터 규칙이다. 3장 전체가 "모든 데이터 소스를 실제로 검증한다"는 내용이다. 조사한 자료를 "확보함", "접근 가능하지만 미검증", "접근 불가"로 나누고 출처와 라이선스를 적게 했고, 사용자가 주지 않은 API 키나 권한이 있다고 가정하지 말라고 했다. AI에게 "VCT 데이터로 선수 능력치를 만들어"라고 하면 데이터가 없어도 그럴듯한 표를 만들어 온다. 그게 진짜인지 확인하는 건 결국 내 일이라서, 처음부터 "없으면 없다고 적어라"를 규칙으로 박아 뒀다. 이 규칙은 2편에서 실제로 여러 번 쓰인다.

1,961줄짜리 `Handoff.md`는 프로젝트를 이어받는 AI가 이전 대화를 읽지 않고도 바로 일을 시작할 수 있게 쓴 문서다. 중심은 3장의 설계 결정 열한 개다.

매니지먼트보다 경기 엔진이 먼저이고(001), 결과를 미리 정하지 않으며(002), 행동을 평가하기 전에 상황에 맞는 후보부터 만든다(003). AI는 실제 상태가 아니라 자기가 인지한 상태만 알고(004), 초기 엔진은 ML 없이 돌아야 하며 LLM이 실시간으로 10명을 조종하지 않는다(005). 나머지는 GPU 의존 최소화(006), Electron·React·TypeScript·PixiJS 기반 PC 게임(007), TypeScript로 시작해 필요하면 Rust로 가는 코어(008), 첫 맵 Ascent(009), 같은 초기 상태와 시드면 같은 경기가 나오는 결정론(010), 세이브와 궁극기를 주요 전략 요소로 본다는 것(011)이다.

4장에는 "개발이 완료된 것으로 오해하면 안 되는 사항" 표가 있다. 저장소 생성, VCT 데이터 다운로드, 리플레이 디코딩, NavMesh 생성, World State 구현이 전부 "미확인"이나 "미구현"으로 적혀 있다. 이전 대화에서 조사하고 설계한 것과 실제로 만든 것을 섞지 말라는 뜻이다.

## 세션 일곱 개로 나눠 일하기

문서를 올린 뒤 오케스트레이터 세션 하나에 일을 맡겼고, 오케스트레이터는 이를 여섯 갈래로 나눴다.

| 세션 | 담당 | 브랜치 |
| --- | --- | --- |
| PV-1 Research | 데이터 소스 레지스트리와 라이선스, 게임 데이터 카탈로그, 전술 지식 베이스, 감사 | `claude/pv-research` |
| PV-2 Data | 데이터 스키마와 ETL, 실측 통계, 경제 엔진, 검증 도구, 선수·팀 프로필 | `claude/pv-data` |
| PV-3 Core | 모노레포, World State와 규칙, 의사결정·행동·팀 엔진, 통합 준비 | `claude/pv-core` |
| PV-4 Spatial | 공간·지각·교전·스킬 엔진, 라운드 시뮬레이터 | `claude/pv-spatial` |
| PV-5 MapMesh | Ascent Blender 맵 처리, NavMesh, 실측 시야 | `claude/pv-mapmesh` |
| PV-6 Replay | `.vrf` 리플레이 파서, 리플레이 포맷과 뷰어, 데스크톱 앱 UI | `claude/pv-replay` |

운영 규칙은 `docs/WORK_HISTORY.md`에 남아 있다. 각 세션은 자기 담당 경로만 고치고 자기 브랜치에만 push한다. 다른 브랜치는 fetch해서 읽기만 한다. 브랜치끼리 의존성이 생기면 머지하지 않고 인터페이스와 구조적 미러로 풀고, 실제 연결은 마지막 통합 때 한다. 머지는 모든 작업이 끝난 뒤 오케스트레이터가 하고, 일이 끝난 세션에는 바로 다음 일을 준다.

덕분에 여섯 세션이 같은 `package.json`을 동시에 고치는 일은 없었다. PV-3가 "공간 질의는 이 인터페이스로 받는다"고 타입을 먼저 정하면 PV-4가 거기에 맞춰 구현하는 식이다. 이걸로 어떻게 충돌 0건 통합까지 갔는지는 10편에서 쓴다.

하루를 커밋 시각(UTC, KST는 +9시간)으로 보면 이렇다. 08:35에 인수인계 문서를 커밋했고 사람이 한 일은 여기까지다. 08:49에 PV-4가 Ascent 좌표계와 콜아웃 구역 그래프를 올리며 첫 AI 커밋이 나왔고, 10:10까지 80분 동안 여섯 세션이 커밋 50개 넘게 쌓았다. 10:14에 사용량 제한으로 전부 멈췄다가 14:22에 재개했다. 14:31에 "엔진 완성 → 시뮬레이션 가능한 초안 → main 머지, 최대한 빨리"라고 지시했고, 14:41에 통합 브랜치 `claude/pv-integration`에서 여섯 브랜치를 충돌 0건으로 합쳐 15:05에 시뮬레이션 초안이 main에 들어갔다.

그 뒤로도 제한에 한 번 더 걸려 가며 다음 날 02:37까지 main 머지가 여덟 차례 이어졌다. 시간 초과 라운드 해결, 수비 보정, 안개 뷰, 스킬 시전 모델, 한국어 UI, 전술 타임아웃과 코치 지시, 스파이크 폭발 비율 보정이 이때 들어갔다.

첫 커밋부터 첫 main 머지까지 6시간 16분이고, 세션이 실제로 돌던 시간은 2시간 남짓이다. 그렇다고 "2시간 만에 게임 엔진을 만들었다"고 하기는 어렵다. 그 전에 이전 대화들에서 조사와 설계를 끝냈고, 그 결과가 문서 4,800줄에 들어 있었다. 첫 머지 시점의 초안도 경기를 끝까지 돌릴 수 있는 수준이었을 뿐, 실제 경기와 비슷하게 만드는 일은 그 뒤에 시작됐다.

## 저장소 구성

지금 저장소에는 TypeScript 패키지 19개, 도구 8개, 앱 2개(PixiJS 리플레이 뷰어, Electron 데스크톱 앱)가 있고 커밋은 169개다.

```text
                 shared-types (모든 타입)
                       │
     ┌─────────────────┼──────────────────┐
     │                 │                  │
 [PV-3 판단]        [PV-4 공간]        [PV-2 경제]
 world-state        spatial-engine     economy-engine
 decision-engine    perception-engine
 action-generator   combat-engine
 team-engine  ◀───  ability-engine
 outcome-predictor  round-simulator
     │                 │
     └──── match-runner ────┘
                 │
     [PV-6] replay-engine → replay-viewer / desktop
```

라운드 시뮬레이터(PV-4)는 매 순간 선수에게 "지금 보이는 것"만 넘기고, 무엇을 할지는 팀 엔진(PV-3)의 `DecisionPolicy`에 묻는다. 실제 세계 상태는 시뮬레이터만 갖고 있고 AI는 관측만 받는다. DECISION-004가 코드의 경계로 들어간 부분이다.

## 한 경기 돌려 보기

글을 쓰면서 저장소를 새로 받아 `pnpm install --frozen-lockfile` 후 한 경기를 돌려 봤다.

```bash
pnpm sim:match --teamA 1001 --teamB 1034 --map ascent --seed 42
```

1001은 Team Heretics, 1034는 NRG로, `@pv/game-data`에 들어 있는 실제 VCT 팀 로스터다.

```text
=== MATCH: Team Heretics (A) vs NRG (B) — map ascent, seed 42 ===

R 1 PISTOL atk=Team Heretics win=NRG        [elimination] kills A:1 B:5 buy A:Classic(pistol) B:Classic(pistol) $A:2900 $B:4800 score 0-1
R 2        atk=Team Heretics win=NRG        [elimination] kills A:1 B:5 buy A:Spectre(force) B:Vandal(full) $A:3500 $B:4900 score 0-2
R 3        atk=Team Heretics win=NRG        [spikeDefused planted] kills A:3 B:5 buy A:Spectre(force) B:Vandal(full) $A:5300 $B:5000 score 0-3
R 4        atk=Team Heretics win=Team Heretics [elimination planted] kills A:5 B:3 buy A:Vandal(full) B:Vandal(full) $A:5700 $B:3600 score 1-3
...
R 8        atk=Team Heretics win=Team Heretics [spikeDetonation planted] kills A:4 B:3 buy A:Vandal(full) B:Spectre(force) $A:7100 $B:4500 score 5-3
...
R13 PISTOL atk=NRG        win=Team Heretics [elimination] kills A:5 B:1 buy A:Classic(pistol) B:Classic(pistol) $A:4800 $B:2900 score 8-5
...
R23        atk=NRG        win=NRG        [elimination planted] kills A:4 B:5 buy A:Spectre(force) B:Vandal(full) $A:4600 $B:5800 score 10-13

FINAL: Team Heretics 10 — 13 NRG  →  NRG wins
```

23라운드에 약 2초가 걸렸다. 한 줄이 한 라운드다. 1라운드 피스톨을 진 Team Heretics는 2, 3라운드를 Spectre 포스 바이로 버티다 둘 다 지고 4라운드에야 풀 바이를 한다. 패배 보너스가 쌓이는 경제 규칙이 돌고 있다는 얘기다. 13라운드에 공수가 바뀌며 피스톨이 다시 오고, 8라운드는 스파이크 폭발로 끝났다.

`docs/WORK_HISTORY.md`에는 첫 main 머지 때 같은 명령, 같은 시드로 돌린 결과가 남아 있는데, 그때는 Team Heretics가 13–11로 이겼다. DECISION-010과 어긋나는 건 아니다. 같은 코드와 같은 시드면 몇 번을 돌려도 결과가 같다. 그사이 바뀐 건 코드다. 수비수가 앵커 자리를 지키고, 스파이크 소지자가 설치를 끝까지 마치고, 가망 없는 리테이크를 포기하도록 바뀌면서 같은 난수열에서 다른 경기가 나왔다. 오히려 결정론 덕분에 이 차이가 코드 변경 때문이라고 확실히 말할 수 있다.

결과는 `match-out/`에 요약, 이벤트 로그, 리플레이, 의사결정 추적(`trace.json`)으로 떨어진다.

## 첫 초안은 시간 초과투성이였다

첫 main 머지 때 남긴 "알려진 한계"에는 예시 경기 24라운드 중 19라운드가 시간 초과(timeExpired)였다고 적혀 있다. 실측은 약 3%다. 두 번째 머지 뒤 세 시드로 53라운드를 돌렸을 때도 46라운드(약 87%)가 시간 초과였다. 원인은 팀 엔진이 500ms마다 명령을 다시 고르는 구조였다. 설치에 4초, 해체에 7초가 걸리는데 0.5초마다 행동을 새로 고르니 설치가 중간에 끊겼다. 이걸 고치자 20경기 배치 기준 시간 초과가 61.8%에서 0%가 됐다(87%는 세 경기, 61.8%는 20경기로 잰 값이다). 대신 공격 승률이 61.7%로 뛰었다. 실제 VCT는 50.9%다.

한 지표를 맞추면 다른 지표가 움직이는 일이 여덟 번의 main 머지 내내 이어졌다. 저장소의 `sim:batch`는 20경기를 돌려 실제 VCT 통계와 나란히 비교해 준다.

| 지표 | 처음 | 8차 머지 후 | 실제 VCT |
| --- | --- | --- | --- |
| 시간 초과로 끝난 라운드 | 61.8% | 4.6% | 4.3% |
| 스파이크 폭발로 끝난 라운드 | 0.4% | 9.0% | 8.2% |
| 공격 승률 | 19.7% | 61.7% | 50.9% |
| 판정 지표 통과 | 0 / 9 | 4 / 8 | — |

시간 초과와 폭발 비율은 실측에 가까워졌지만 공격 승률은 아직 높고, 판정 지표도 8개 중 4개가 남아 있다. 각 숫자를 움직이려고 무엇을 고쳤는지는 11편에서 쓴다.

## 연재 순서

1~12편은 첫날(11월 18~19일) 작업을 다루고, 그 뒤 작업은 진행되는 대로 이어서 쓴다.

1. 프롤로그 — 이 글
2. 데이터 찾기 — vlr.gg 약관, Riot API 403, GRID (PV-1)
3. 데이터를 숫자로 — 실측 기준선, 쓰지 않은 LightGBM 모델, 선수 능력치 (PV-2)
4. 경제와 궁극기 엔진 (PV-2)
5. 상황 기반 선택지 생성 — World State, Belief State, Action Generator (PV-3)
6. 팀 엔진과 한 경기 — IGL, 선수 정책, 미래 탐색, 전술 타임아웃 (PV-3)
7. 공간, 지각, 교전 (PV-4)
8. Blender 맵에서 NavMesh 만들기 (PV-5)
9. 리플레이와 데스크톱 앱 (PV-6)
10. 충돌 0건 통합
11. 실측에 맞추기 — 시간 초과 87%에서 판정 4/8까지
12. 첫날 작업을 돌아보며
13. 배운 것들 — 첫날 이후 작업까지 포함해 Project-VM에서 배운 것
14. 이후 — 11개 맵, 이동 엔진 개편, 개인 경제, 커리어 모드 등

각 편은 따로 읽어도 되게 썼다. 게임 AI 쪽이면 5, 6, 11편, 데이터 쪽이면 2, 3, 4편, 여러 AI 에이전트로 큰 프로젝트를 굴리는 방법이 궁금하면 10, 12, 13편부터 봐도 된다.

하나 밝혀 둘 것이 있다. 이건 출시된 게임이 아니라 내부 개발 단계의 엔진 초안이다. 실제 프로 선수와 팀 이름을 쓰고 있고, 출시 전에 초상권, 상표, Riot 자산 라이선스를 다시 검토하기로 저장소에 적어 두었다. 이 엔진의 경기 결과는 실제 팀의 실력을 예측한 것이 아니다.

다음 편은 엔진의 재료인 데이터 이야기다. "VCT 경기 데이터를 모아 와"라는 요청이 실제로 어떤 확인을 거쳤는지 쓴다.

## 참고 자료

- [Project-VM 저장소](https://github.com/2rangs/Project-VM)
- [README.md (마스터 프롬프트)](https://github.com/2rangs/Project-VM/blob/main/README.md)
- [Handoff.md (인수인계 문서)](https://github.com/2rangs/Project-VM/blob/main/Handoff.md)
- [docs/WORK_HISTORY.md (작업 히스토리)](https://github.com/2rangs/Project-VM/blob/main/docs/WORK_HISTORY.md)
- [docs/ARCHITECTURE.integrated.md (통합 아키텍처)](https://github.com/2rangs/Project-VM/blob/main/docs/ARCHITECTURE.integrated.md)
