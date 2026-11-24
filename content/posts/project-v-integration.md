---
slug: project-v-integration
title: PROJECT V 개발기 (10) 여섯 브랜치를 충돌 없이 합치기
summary: 경로 소유권, 인터페이스와 구조적 미러, 리허설로 여섯 브랜치를 충돌 0건으로 합쳤다. git이 못 잡는 좌표계와 계약 단위 차이는 리허설에서 찾았다.
tags: [PROJECT V, AI 에이전트, Git]
series: PROJECT V 개발기
date: 2026-11-19T04:09:00.000Z
comment_term: blog-post-project-v-integration
---

9편까지 여섯 세션(연구, 데이터, 코어, 공간, 맵, 리플레이)의 작업을 하나씩 봤다. 여섯 작업은 같은 80분 동안 각자 다른 브랜치에서, 서로의 코드를 import하지 않고 진행됐다. 14:41에 이 여섯 브랜치를 하나로 합쳤는데 git 충돌은 0건이었다. 운이 아니라 처음부터 그렇게 되도록 짠 결과였고, 충돌이 없었는데도 합친 뒤에 맞춰야 할 것은 따로 있었다.

## 규칙

`docs/WORK_HISTORY.md` 1장에 적힌 운영 방식은 단순하다. 각 세션은 자기 소유 경로만 수정하고 자기 브랜치에 커밋·push한다. 다른 브랜치는 fetch해서 읽기만 한다. 브랜치 사이의 의존성은 머지 대신 인터페이스(의존성 역전)와 구조적 미러로 풀고, 실제 연결은 최종 통합 때 한다. 머지와 PR은 금지이고, 통합은 모든 작업이 끝난 뒤 오케스트레이터가 맨 마지막에 한다. 일이 끝난 세션에는 다음 작업을 바로 준다. 이 마지막 규칙 때문에 인수인계 문서마다 "N차 작업"이 쌓였다. PV-1은 11차, PV-6은 6차까지 있다.

문서도 나눴다. 타임라인의 정본은 오케스트레이터가 쓰는 `WORK_HISTORY.md` 하나이고, 브랜치별로는 더 자세한 `DEVELOPMENT_LOG.md`를 따로 썼다. PV-1은 자기 문서 서두에 `WORK_HISTORY.md`를 만들지도 고치지도 않는다고 적어 뒀다. 여러 세션이 같은 마크다운 파일에 줄을 추가하면 코드보다 문서에서 먼저 충돌이 난다.

모든 보고는 내가 쓴 `Handoff.md` 25장의 템플릿을 따랐다. 열세 개 절 중 효과가 컸던 건 끝의 두 줄이다.

```markdown
<!-- Handoff.md §25 발췌 -->
## 2. 완료한 작업
실제로 구현하거나 검증한 항목만 기재한다.
## 7. 테스트 결과
실제 결과를 기록한다.
## 13. 작업 재개 지점
다음 AI가 처음 열어야 할 파일과
실행해야 할 명령을 기록한다.

모든 작업 완료 보고에는 실제 테스트 여부를 명시한다.
미실행 테스트를 성공한 것으로 기록하지 않는다.
```

9편의 "cargo build는 차단되어 미실행, 성공으로 기록하지 않음", 5편의 `it.todo`, 8편의 "측정 불가 ≠ 길이 없음" 같은 문장이 다 여기서 나왔다. 세션들은 이 템플릿을 거의 그대로 따랐다.

## 머지하지 않고 남의 코드 쓰기

PV-3의 팀 정책은 PV-4의 공간 엔진으로 경로를 찾아야 하고, PV-4의 라운드 시뮬레이터는 PV-3의 팀 정책을 호출해야 한다. 서로 머지하지 않고 이걸 푼 방법은 두 단계였다.

먼저 5편에서 본 대로 PV-3가 `@pv/shared-types`에 인터페이스 다섯 개(`SpatialQuery`, `ObservationProvider`, `EconomyEvaluator`, `CombatEstimator`, `DecisionPolicy`)를 선언했다. 통합 전에는 Ascent 스텁, 시나리오의 belief 블록, "임시 휴리스틱" 꼬리표가 붙은 대역, 휴리스틱 추정기가 각각 자리를 채웠다. `DecisionPolicy`는 PV-4의 라운드 시뮬레이터가 호출하는 쪽이라 PV-3가 "제안, 맞춰 주세요"로 남겼다. `SpatialQuery`의 머리 주석에는 PV-4의 실제 `SpatialEngine` API를 미러링한다고 적혀 있다. PV-4 브랜치를 fetch해서 읽고 그 모양대로 쓴 것이다.

반대 방향, 즉 실제 엔진을 인터페이스에 끼우는 어댑터는 그 엔진을 import해야 하는데 엔진은 다른 브랜치에 있다. 그래서 상대 API를 복사한 로컬 인터페이스를 뒀다.

```ts
// packages/integration-adapters/src/spatial-adapter.ts
/**
 * SpatialQuery adapter over PV-4's spatial-engine.
 *
 * MIRROR SOURCE: origin/claude/pv-spatial @ e3ad1c541e4c5834a2cd4e438199a3ad9557a927
 *   packages/spatial-engine/src/{engine.ts,coordinate.ts,types.ts}
 * At merge, replace `SpatialEngineLike` with `import { SpatialEngine } from "@pv/spatial-engine"`.
 */
...
export interface SpatialEngineLike {
  readonly mapId: string;
  readonly coords: MapCoordinateSystemLike;
  readonly zones: readonly ZoneLike[];
  getZone(id: string): ZoneLike | undefined;
  nearestZone(position: Vec3Like): ZoneLike;
```

헤더에 어느 브랜치의 어느 커밋을 보고 복사했는지 SHA까지 남아 있다. TypeScript는 구조적 타입이라 모양만 같으면 진짜 `SpatialEngine`이든 테스트용 가짜든 받는다. 머지 후에는 이 인터페이스를 지우고 진짜 import로 바꾸면 된다. PV-4와 PV-2도 `shared-mirror.ts`에 PV-3의 공유 타입을 복사해 두고 그 사본에 맞춰 개발했고, PV-6 핸드오프에도 같은 방식이 적혀 있다. 여섯 세션이 거의 동시에 각자 같은 방법을 골랐다.

같은 대상을 세션마다 다르게 부르는 문제도 있었다. KAY/O는 `kay-o`, `kayo`, `kay/o` 세 가지로, 팀은 `team-0`과 `0` 두 가지로 쓰이고 있었다. 식별자 정규화는 `packages/integration-adapters/src/normalization.ts` 한 파일에 모았다. 이 파일에는 알려진 차이 목록(`KNOWN_MISMATCHES`)도 있다. PV-3의 "에코 기준 2,000크레딧"은 은행 잔고 기준이고 PV-2의 "에코 기준 5,000크레딧"은 장비 가치 기준이다. 숫자는 다르지만 재는 대상이 달라서 둘 다 맞다.

## 충돌 0건은 미리 알고 있었다

09:59에 PV-3가 통합 계획서(`INTEGRATION_PLAN.md`)를 썼다. 브랜치마다 `git diff --name-only main...origin/claude/pv-*`로 추가한 파일 경로를 뽑고, 브랜치 쌍마다 `comm`으로 비교했다. 같은 경로를 추가하는 쌍은 없었다. 루트 설정 파일(`package.json`, `pnpm-workspace.yaml`, `tsconfig*`, `vitest.config.ts`)과 `packages/shared-types/`는 PV-3 브랜치에만 있었다. 계획서의 결론은 이렇다.

> Merges are therefore additive — expect no git textual conflicts. The integration work is post-merge wiring, not conflict resolution.

충돌 0건은 머지 전에 이미 예측한 결과였고, 그 예측을 가능하게 한 건 "자기 소유 경로만 수정" 규칙이다. 계획서에는 머지 순서(core → spatial → data → research → replay → mapmesh)와 머지 후 할 일도 있었다. PV-4만 쓰던 `@project-v/*` 이름을 `@pv/*`로 바꾸기, `shared-mirror.ts`와 어댑터 미러를 진짜 import로 바꾸기, 형제 패키지의 npm `package-lock.json`을 지우고 pnpm 잠금 파일 다시 만들기, 단위와 식별자 정규화.

## 리허설

그다음 버려도 되는 작업 공간(`git worktree add --detach /tmp/pv-rehearsal`)에서 여섯 브랜치를 실제로 머지해 봤다. push하지 않고 끝나면 지웠다. 명령은 다시 돌릴 수 있게 `tools/integration-rehearsal/README.md`에 남겼다.

1차 리허설에서 머지 충돌은 0이었다. 이름 바꾸기는 25건이었는데, 따옴표로 감싼 `"@project-v"`는 `@project-v/` 패턴에 안 걸려서 `sed`를 한 번 더 돌렸다. `pnpm install`로 패키지 17개가 연결됐다. 루트에서 `tsc`를 한 번에 돌리면 엄격성 오류 약 60개로 실패했지만 패키지별로는 통과했다. 루트 vitest는 47개 파일 중 39개 통과였고, 나머지 8개는 PV-6의 리플레이 엔진이 vitest 대신 `node:test`를 써서 생긴 실행기 차이였다. E2E는 같은 시드에 같은 해시가 나왔다.

맞춰야 할 항목은 여섯 개(F1~F6)였고, 중요한 건 앞의 두 개였다.

- F1 좌표: PV-2의 `minimapUnits`는 "정규화 × 1000"이 아니라 vlr 미니맵 픽셀 좌표였다. ×1000으로 가정하면 공격 스폰 선수 전원이 B 메인에 찍힌다.
- F2 계약 단위: PV-4 라운드 시뮬레이터의 `DecisionPolicy`는 "선수 한 명, 틱 하나" 단위였고 PV-3의 정책은 "팀 전체, 라운드" 단위였다.

F1과 F2는 코드는 깨끗하게 합쳐졌는데 세션마다 가정이 달랐던 곳이다. git은 같은 줄을 두 곳에서 고쳐야 충돌로 본다. 한 세션이 좌표를 0~1000으로, 다른 세션이 게임 단위로 다뤄도 파일이 다르면 git은 아무 말도 하지 않는다. 이런 건 합쳐서 돌려 봐야 나온다. F1은 9편에서 쓴 대로 변환 함수를 주입할 수 있게 하고 PV-6가 실데이터 3,001개로 검증한 변환을 쓰는 것으로 풀었다. F2는 PV-4가 라운드 시뮬레이터를 PV-3의 팀 단위 계약에 맞춰 고쳤다(10:04 커밋). 루트 tsconfig 엄격성(F4)과 실행기 혼재(F5)는 `pnpm -r typecheck`, `pnpm -r test`로 패키지별로 돌리는 것으로 정리했다. PV-4의 수정 뒤에 한 2차 리허설에서는 PV-3의 팀 정책이 PV-4의 시뮬레이터를 직접 구동했고, 의사결정 쪽과 시뮬레이션 쪽이 처음으로 한 라운드를 같이 돌았다.

## 멈춘 시간과 실제 통합

10:14에 사용량 제한으로 모든 세션이 멈췄다. 오케스트레이터는 직전인 10:11에 작업 기록 문서(`7e215ac`, "no code merged")를 main에 남겼다. 이때 main에는 문서만 있고 코드는 없었다. 14:22에 재개됐고, 14:31에 내가 지시를 하나 내렸다.

> 엔진 완성 → 시뮬레이션 가능한 초안 → main 머지, 최대한 빨리.

세션별 작업을 동결(FREEZE)하고 끝나지 않은 일은 TODO로 남겼다. PV-1의 11차 작업(Lotus 메커니즘 명세)도 이때 동결됐다.

14:41에 PV-3가 통합 브랜치(`claude/pv-integration`)를 만들고 main의 `7e215ac` 위에 계획서 순서대로 머지했다. pv-replay만 squash로 넣었다(9편의 일반인 이름 이력 제외). 충돌은 0건이었고, 이어서 `c2eb430`("wire: first passing integration state")이 들어갔다. 패키지 17개가 `pnpm -r typecheck`를 모두 통과했고, PV-3 코어 테스트는 128 통과 / 4 todo, 형제 패키지 테스트도 전부 통과했다. `tools/data-collector`의 pytest는 `duckdb` 미설치로 수집 단계에서 실패했는데, 통합 문제가 아니라 환경 문제로 기록했다. 어댑터의 미러는 이미 컴파일되고 테스트도 통과했으니 첫 패스에서는 그대로 뒀다.

이때부터 모든 세션이 통합 브랜치 위에서 직접 작업했다. `git log`에 "Merge branch 'claude/pv-integration' of … into claude/pv-integration"이 많은 건 여러 세션이 같은 브랜치에 push하면서 서로의 커밋을 당겨 합쳤기 때문이다. "자기 소유 경로만" 규칙은 남았고 "각자 브랜치" 규칙은 여기서 끝났다. 이후 40분 동안 팀 67개·선수 1,227명 런타임 데이터(`42d5751`), 데스크톱 UI와 실제 라운드 시뮬레이터 연결, 통합 E2E 수용 테스트, `sim:validate` 러너, 피스톨부터 연장전까지 도는 `@pv/match-runner`(`c251b3a`)가 들어갔다.

E2E 테스트는 라운드가 정상 종료되는지, 같은 시드에서 이벤트 로그 해시가 같은지, 이벤트 로그가 리플레이로 변환되는지, 20시드 비교, 이렇게 네 개다. 머지 전 감사(2편)에서 나온 라이선스 고지와 출처 표기 등 조치 항목 여섯 개도 이때 처리했고, `THIRD_PARTY_NOTICES.md` 끝에 "items [A]–[F] processed"가 남아 있다.

오케스트레이터는 통합 브랜치를 바로 머지하지 않고 직접 재현했다. 전 패키지 typecheck 통과, 코어 128 통과 / 4 todo, 패키지별 테스트 전부 통과(공간 21, 지각 17, 교전 15, 스킬 18, 라운드 16, 경제 31, 리플레이 14, 게임 데이터 7, 경기 진행 8), 실제 경기 Team Heretics 13–11 NRG 약 2.4초, 비밀정보·자격증명·원본 `.blend`/`.vrf` 0건. 알려진 한계로 24라운드 중 19라운드가 시간 초과로 끝난다는 것도 같이 적었다. 그리고 15:05에 첫 main 머지가 들어갔다.

## 그 뒤 여덟 번의 main 머지

| 차수 | 시각(UTC) | 핵심 | 판정 지표 |
| --- | --- | --- | --- |
| 1 | 11-18 15:03 | 시뮬레이션 엔진 초안 | 측정 전 (24R 중 19R 시간 초과) |
| 2 | 19:35 | 실제 팀 레이팅, 데스크톱 ↔ 경기 진행기, 라운드 엔진 개선 | 53R 중 46R 시간 초과 (개선 없음) |
| 3 | 19:42 | 시간 초과 수정, `sim:batch` | 0/9 → 2/8 |
| 4 | 19:58 | 수비 홀드, 안개 뷰, 침묵·대시, `--compare` | 3/8 |
| 5 | 20:44 | 바라보는 방향, 피커 이점, 목표 지점 스킬, 통과 가능한 몰리, 리뷰 화면 | 3/8 |
| 6 | 21:03 | 시전 모델, 스킬 켜기(기본은 꺼짐) | 3/8 |
| 7 | 11-19 02:00 | 한국어 UI, 전술 타임아웃 | 3/8 (불변 확인) |
| 8 | 11-19 02:37 | 설치 후 세이브(폭발 0 해결) | 4/8 |

1~7차는 머지 커밋이고 대부분 바로 뒤에 "docs: record N-th main merge" 커밋이 붙는다. 8차는 main에 직접 올린 커밋 하나이고 작업 기록 갱신도 거기 들어 있다. 1차와 2차 사이가 4시간 넘게 빈 건 15:19부터 19:32까지 두 번째 사용량 제한으로 PV-2, PV-3, PV-4가 멈췄기 때문이다.

오케스트레이터는 머지마다 같은 명령(`sim:batch --matches 20`)으로 숫자를 재현해 남겼다. 7차처럼 기능만 추가한 머지에서도 "기본값 판정 3/8 불변"을 확인해서 새 기능이 기존 결과를 바꾸지 않았다는 걸 기록했다. 세션별 문서 중 일부는 통합 전 상태로 남아 있어서, 최신 상태는 `WORK_HISTORY.md` 5장을 기준으로 봐야 한다.

아직 남은 일도 있다. 일부 패키지에는 `shared-mirror` 참조가 남아 있어서 진짜 import로 바꾸는 작업이 끝나지 않았다. 4편의 경제 판단, 6편의 결과 예측기처럼 만들어 두고 경기에 연결하지 않은 부품도 있다. 세션 간 가정 차이는 리허설에서 상당수 찾았지만 나머지는 시뮬레이션 숫자를 보면서 찾고 있다. 판정 지표를 0/9에서 4/8까지 올린 보정 과정은 다음 편에 쓴다.

## 참고 자료

- [docs/WORK_HISTORY.md](https://github.com/2rangs/Project-VM/blob/main/docs/WORK_HISTORY.md)
- [docs/INTEGRATION_PLAN.md](https://github.com/2rangs/Project-VM/blob/main/docs/INTEGRATION_PLAN.md)
- [docs/INTEGRATION_REHEARSAL.md](https://github.com/2rangs/Project-VM/blob/main/docs/INTEGRATION_REHEARSAL.md)
- [docs/INTEGRATION_RESULT.md](https://github.com/2rangs/Project-VM/blob/main/docs/INTEGRATION_RESULT.md)
- [docs/THIRD_PARTY_NOTICES.md](https://github.com/2rangs/Project-VM/blob/main/docs/THIRD_PARTY_NOTICES.md)
- [packages/integration-adapters](https://github.com/2rangs/Project-VM/tree/main/packages/integration-adapters)
- [tools/integration-rehearsal](https://github.com/2rangs/Project-VM/tree/main/tools/integration-rehearsal)
- [Handoff.md 25장 (인수인계 템플릿)](https://github.com/2rangs/Project-VM/blob/main/Handoff.md)
