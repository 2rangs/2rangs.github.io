---
slug: project-v-integration
title: 여섯 브랜치, 충돌 0건, 그리고 의미의 충돌
summary: 자기 경로만 고치고, 인터페이스와 구조적 미러로 남의 코드를 쓰고, 리허설로 미리 합쳐 본 결과 충돌은 0건이었습니다. 하지만 좌표계와 계약 단위의 충돌은 git이 보지 못했습니다.
tags: [PROJECT V, AI 에이전트, Git]
series: PROJECT V 개발기
date: 2026-11-19T04:09:00.000Z
comment_term: blog-post-project-v-integration
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 10편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `docs/WORK_HISTORY.md`, `docs/INTEGRATION_PLAN.md`, `docs/INTEGRATION_REHEARSAL.md`, `docs/INTEGRATION_RESULT.md`, `packages/integration-adapters`, `tools/integration-rehearsal`과 `git log`를 근거로 썼습니다.

2편부터 9편까지 여섯 세션의 작업을 하나씩 따라왔습니다.
연구, 데이터, 코어, 공간, 맵, 리플레이.
이 여섯 개는 각자 다른 브랜치에서, 서로의 코드를 import하지 않은 채로, 같은 80분 동안 만들어졌습니다.

그리고 14:41, 여섯 브랜치를 하나로 합쳤을 때 git 충돌은 0건이었습니다.

이번 편은 그게 어떻게 가능했는지, 그리고 "충돌 0건"이 실제로는 무엇을 뜻했는지에 대한 이야기입니다.
결론부터 말하면, 충돌이 없었던 이유는 운이 아니라 규칙 때문이었고, 충돌이 없다고 문제가 없었던 것은 아닙니다.

## 한눈에 보기

- 규칙은 세 가지였습니다. 자기 소유 경로만 수정한다. 다른 브랜치는 읽기만 한다. 머지는 맨 마지막에 오케스트레이터가 한다.
- 브랜치 사이의 의존성은 **인터페이스(의존성 역전)** 와 **구조적 미러**(상대 브랜치 API를 복사한 로컬 인터페이스)로 풀었습니다.
- 통합 계획 단계에서 브랜치 쌍마다 추가한 파일 경로를 비교해, 같은 경로를 건드리는 쌍이 하나도 없다는 것을 미리 확인했습니다. "머지는 덧셈일 것이다. 통합 작업은 충돌 해결이 아니라 머지 후 배선이다."
- 버려도 되는 작업 공간에서 리허설을 두 번 했고, 충돌은 0건이었지만 문제 6개(F1~F6)가 나왔습니다. 가장 큰 것은 좌표계와 계약 단위의 불일치였습니다.
- 사용량 제한으로 모든 세션이 두 번 멈췄습니다(약 4시간, 약 4시간).
- 첫 main 머지 이후 하루 동안 main 머지가 여덟 번 있었고, 머지마다 오케스트레이터가 직접 재현해서 숫자를 기록했습니다.

## 규칙 세 개

`docs/WORK_HISTORY.md` 1장의 운영 방식을 다시 옮깁니다.

- 각 세션은 **자기 소유 경로만 수정**하고, 자기 브랜치에 커밋·push한다.
- 다른 브랜치는 fetch해서 **읽기만** 한다.
- 브랜치 간 의존성은 머지 대신 **인터페이스(의존성 역전)·구조적 미러**로 해결하고, 실제 연결은 최종 통합 때 한다.
- 머지와 PR은 금지. 통합은 오케스트레이터가 모든 작업이 끝난 뒤 맨 마지막에.
- 작업이 끝난 세션에는 다음 작업을 즉시 할당한다.

마지막 규칙 때문에 인수인계 문서마다 "N차 작업"이 쌓였습니다.
PV-1은 11차, PV-6은 6차까지 있습니다.

공유 문서도 규칙으로 정리했습니다.
타임라인의 정본은 오케스트레이터가 쓰는 `WORK_HISTORY.md` 하나이고, PV-1은 이 파일을 만들지도 고치지도 않는다고 자기 문서 서두에 적었습니다.
대신 같은 내용을 브랜치별로 더 자세히 쪼갠 `DEVELOPMENT_LOG.md`를 따로 썼습니다.
두 세션이 같은 마크다운 파일 하나에 각자 줄을 추가하면, 코드보다 먼저 거기서 충돌이 납니다.

### 인수인계 템플릿

모든 세션의 보고는 제가 쓴 `Handoff.md` 25장의 템플릿을 따랐습니다.
열세 개 절입니다.
작업 목표, 완료한 작업, 변경 파일, 데이터 출처, 실행 방법, 검증, 테스트 결과, 미완료, 알려진 문제, 설계 결정, 라이선스, 다음 작업, 작업 재개 지점.

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

마지막 두 줄이 이 연재에서 여러 번 등장한 문장들의 출처입니다.
9편의 "cargo build는 차단되어 미실행, 성공으로 기록하지 않음", 5편의 `it.todo`, 8편의 "측정 불가 ≠ 길이 없음".
세션들은 이 템플릿을 거의 글자 그대로 따랐습니다.

## 머지하지 않고 남의 코드를 쓰는 법

PV-3의 팀 정책은 PV-4의 공간 엔진으로 경로를 찾아야 합니다.
PV-4의 라운드 시뮬레이터는 PV-3의 팀 정책을 호출해야 합니다.
서로 머지하지 않고 어떻게 이게 될까요?

### 1단계: 인터페이스를 먼저 선언한다

5편에서 봤듯이 PV-3는 `@pv/shared-types`에 인터페이스 다섯 개를 먼저 선언했습니다.

| 인터페이스 | 실제 구현 | 통합 전 대역 |
| --- | --- | --- |
| `SpatialQuery` | PV-4 공간 엔진 | Ascent 스텁 |
| `ObservationProvider` | PV-4 지각 엔진 | 시나리오의 belief 블록 |
| `EconomyEvaluator` | PV-2 경제 엔진 | "임시 휴리스틱" 꼬리표 |
| `CombatEstimator` | PV-4 교전 엔진 | 휴리스틱 추정기 |
| `DecisionPolicy` | PV-4 라운드 시뮬레이터가 호출 | PV-3가 "제안, 맞춰 주세요" |

`SpatialQuery`의 머리 주석은 이 인터페이스가 PV-4의 실제 `SpatialEngine` API를 "미러링한다"고 적습니다.
PV-3는 PV-4 브랜치를 fetch해서 읽고, 그 모양에 맞춰 인터페이스를 썼습니다.

### 2단계: 구조적 미러

그다음에는 반대 방향, 실제 엔진을 인터페이스에 끼우는 어댑터가 필요합니다.
그런데 어댑터는 실제 엔진을 import해야 하고, 그 엔진은 다른 브랜치에 있습니다.

PV-3의 해법은 **상대 API를 복사한 로컬 인터페이스**였습니다.

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

헤더에 "어느 브랜치의 어느 커밋을 보고 베꼈는지"가 SHA까지 적혀 있습니다.
TypeScript는 구조적 타입 시스템이라, 이 `SpatialEngineLike`와 모양이 같은 객체라면 진짜 `SpatialEngine`이든 테스트용 가짜든 다 받습니다.
머지하는 날에는 이 인터페이스를 지우고 진짜 import로 바꾸면 됩니다.
"머지 때 import를 교체하라."

PV-4와 PV-2 쪽에도 같은 패턴이 있었습니다.
`shared-mirror.ts`라는 파일에 PV-3의 공유 타입을 복사해 두고, 그 사본에 맞춰 개발했습니다.
PV-6도 같은 방식을 썼다고 핸드오프에 적혀 있습니다.
여섯 세션이 이 패턴을 거의 동시에 각자 찾아낸 셈입니다.

데이터도 마찬가지입니다.
PV-2의 시나리오와 스키마를 PV-3의 테스트 폴더에 그대로 복사하고, 어디서 언제 복사했는지 README에 기록했습니다.
로더 테스트에는 "enum 표류 감시"가 있어서, 복사해 온 스키마 파일의 열거값과 로더의 열거값이 어긋나면 실패합니다.

### 이름 맞추기

같은 것을 세션마다 다르게 부르는 문제도 있었습니다.
식별자 정규화는 한 파일에 모았습니다.

```ts
// packages/integration-adapters/src/normalization.ts
/** Agent slug aliases → canonical lowercase slug. PV-1/PV-2 use "kay-o"; scenarios "kayo". */
export const AGENT_SLUG_ALIASES: Readonly<Record<string, string>> = {
  kayo: "kay-o",
  "kay/o": "kay-o",
  "kay-o": "kay-o",
};
...
/** Team id: PV-3 uses "team-0"/"team-1"; several branches use teamIdx 0/1. */
export function teamIdToIdx(teamId: string): 0 | 1 {
  return /1$/.test(teamId) ? 1 : 0;
}
```

KAY/O 하나를 `kay-o`, `kayo`, `kay/o` 세 가지로 쓰고 있었습니다.
팀은 `team-0`과 `0`.
그리고 이 파일에는 알려진 불일치 목록(`KNOWN_MISMATCHES`)도 있습니다.
예를 들어 PV-3의 "에코 기준 2,000크레딧"은 은행 잔고 기준이고, PV-2의 "에코 기준 5,000크레딧"은 장비 가치 기준입니다.
숫자가 다르지만 둘 다 맞고, 서로 다른 것을 재고 있다는 기록입니다.

## 충돌 0건을 미리 아는 법

09:59, PV-3는 통합 계획서(`INTEGRATION_PLAN.md`)를 썼습니다.
핵심은 이 분석입니다.

```text
git diff --name-only main...origin/claude/pv-*   (브랜치마다)
→ 브랜치 쌍마다 comm 으로 비교
→ 같은 파일 경로를 추가하는 쌍: 0
```

루트 설정 파일(`package.json`, `pnpm-workspace.yaml`, `tsconfig*`, `vitest.config.ts`)과 `packages/shared-types/`는 PV-3 브랜치에만 있었습니다.
결론은 이렇게 적혀 있습니다.

> Merges are therefore additive — expect no git textual conflicts. The integration work is post-merge wiring, not conflict resolution.

"충돌 0건"은 결과가 아니라 예측이었습니다.
그리고 이 예측이 가능했던 것은 1장의 "자기 소유 경로만 수정" 규칙 덕분입니다.

계획서에는 머지 순서(core → spatial → data → research → replay → mapmesh)와 머지 후 배선 목록도 있습니다.

- PV-4만 `@project-v/*` 이름을 썼으니 `@pv/*`로 바꾸기
- `shared-mirror.ts`를 지우고 진짜 공유 타입 쓰기
- 어댑터의 미러를 진짜 import로 바꾸기
- 형제 패키지의 npm `package-lock.json`을 지우고 pnpm 잠금 파일 재생성
- 단위와 식별자 정규화

## 리허설: 충돌은 없었지만

계획을 세운 다음에는 리허설을 했습니다.
버려도 되는 작업 공간(`git worktree add --detach /tmp/pv-rehearsal`)에서 여섯 브랜치를 전부 머지해 보고, push하지 않고, 끝나면 지웠습니다.
명령은 다시 돌릴 수 있게 저장소에 남아 있습니다.

```bash
# tools/integration-rehearsal/README.md
git worktree add --detach /tmp/pv-rehearsal origin/claude/pv-core
cd /tmp/pv-rehearsal
for b in pv-spatial pv-data pv-replay; do git merge --no-edit origin/claude/$b; done
grep -rl '@project-v/' packages --include=*.ts --include=*.json | xargs -r sed -i 's#@project-v/#@pv/#g'
grep -rl '"@project-v"' packages --include=*.ts | xargs -r sed -i 's#"@project-v"#"@pv"#g'
find packages -name package-lock.json -delete
pnpm install
```

1차 리허설 결과입니다.

- 머지 충돌 **0**.
- 이름 바꾸기 25건. 그런데 따옴표로 감싼 `"@project-v"`는 `@project-v/` 패턴에 걸리지 않아 따로 처리해야 했습니다. 위 스크립트의 두 번째 `sed`가 그 흔적입니다.
- `pnpm install`로 패키지 17개 연결.
- 루트에서 `tsc` 한 번에 돌리면 약 60개의 엄격성 오류로 실패. 패키지별로는 통과.
- 루트 vitest는 47개 파일 중 39개 통과. 나머지 8개는 PV-6의 리플레이 엔진이 vitest가 아니라 `node:test`를 써서 생긴 실행기 문제.
- E2E는 결정론을 만족(같은 시드 → 같은 해시).

그리고 발견한 문제들입니다.

| # | 문제 | 심각도 |
| --- | --- | --- |
| F1 | 좌표: PV-2의 `minimapUnits`는 "정규화 × 1000"이 아니라 vlr 미니맵 **픽셀** 좌표였다. ×1000으로 가정하면 공격 스폰 선수 전원이 B 메인에 찍힌다 | 높음 |
| F2 | 계약 단위: PV-4 라운드 시뮬레이터의 `DecisionPolicy`는 "선수 한 명, 틱 하나" 단위였고, PV-3의 정책은 "팀 전체, 라운드" 단위였다 | 높음 |
| F3 | 시나리오 변환기가 위치와 믿음 정보를 버린다 | 중간 |
| F4 | 루트 tsconfig 엄격성이 다른 패키지를 깨뜨린다 | 중간 |
| F5 | 테스트 실행기가 섞여 있다 | 중간 |
| F6 | 이름 바꾸기가 경로 문자열까지 덮어야 한다 | 낮음 |

F1과 F2를 보면 "충돌 0건"의 의미가 분명해집니다.
git이 보는 것은 텍스트입니다.
같은 줄을 두 사람이 고치지 않으면 충돌이 아닙니다.
하지만 한 세션이 "좌표는 0~1000"이라고 믿고 다른 세션이 "좌표는 게임 단위"라고 믿는 것은, 두 사람이 서로 다른 파일에 쓰는 한 git에게는 아무 문제가 아닙니다.
**의미의 충돌은 텍스트 충돌로 나타나지 않습니다.**

F1의 해법은 9편에서 봤듯이, 변환 함수를 주입할 수 있게 만들고 PV-6가 실데이터 3,001개로 검증한 변환을 쓰는 것이었습니다.
F2의 해법은 PV-4가 자기 라운드 시뮬레이터를 PV-3의 팀 단위 계약에 맞춰 고치는 것이었고(10:04 커밋), F4와 F5는 루트에서 한 번에 돌리지 말고 패키지별로(`pnpm -r typecheck`, `pnpm -r test`) 돌리는 것으로 정리했습니다.

2차 리허설은 PV-4의 수정 뒤에 했습니다.
이번에는 PV-3의 팀 정책이 PV-4의 시뮬레이터를 직접 구동했습니다.
처음으로 "두뇌"와 "몸"이 한 라운드를 같이 돈 순간입니다.

## 멈춤

10:14, 사용량 제한으로 모든 세션이 멈췄습니다.
오케스트레이터는 그 직전인 10:11에 작업 기록 문서 하나(`7e215ac`, "no code merged")를 main에 남겼습니다.
멈춘 시점의 main에는 문서만 있고 코드는 없었습니다.

14:22에 재개됐고, 14:31에 제가 지시를 하나 내렸습니다.

> 엔진 완성 → 시뮬레이션 가능한 초안 → main 머지, 최대한 빨리.

이 지시로 일하는 방식이 바뀌었습니다.
세션별 작업을 "동결(FREEZE)"하고, 동결 시점에 끝나지 않은 일은 TODO로 기록했습니다.
PV-1의 11차 작업(Lotus 메커니즘 명세)이 이렇게 동결됐고, 2편에서 말했듯이 그 명세는 끝내 만들어지지 않았습니다.

## 실제 통합

14:41, 오케스트레이터가 아니라 PV-3가 통합 브랜치(`claude/pv-integration`)를 만들었습니다.
main의 `7e215ac` 위에 계획서 순서대로 머지했습니다.

1. pv-core
2. pv-spatial
3. pv-data
4. pv-research
5. pv-replay (**squash**, 9편의 일반인 이름 이력 제외)
6. pv-mapmesh

충돌 0건.
그리고 `c2eb430`, "wire: first passing integration state".

- 패키지 17개, `pnpm -r typecheck` 17/17 통과
- PV-3 코어 테스트 128 통과 / 4 todo, 형제 패키지 테스트 전부 통과
- 알려진 환경 문제 하나: `tools/data-collector`의 pytest가 `duckdb` 미설치로 수집 단계에서 실패. 통합 결함이 아니라 환경 문제로 명시

어댑터의 미러는 첫 패스에서 **그대로 두었습니다.**
이미 컴파일되고 테스트를 통과하니, 진짜 import로 바꾸는 것은 나중 일로 미뤘습니다.
지금도 일부 패키지에 `shared-mirror` 참조가 남아 있습니다.

이 시점부터 모든 세션은 각자 브랜치가 아니라 통합 브랜치 위에서 직접 일했습니다.
`git log`에 "Merge branch 'claude/pv-integration' of … into claude/pv-integration" 같은 커밋이 잔뜩 남은 이유입니다.
여러 세션이 같은 브랜치에 push하면서 서로의 커밋을 당겨 합친 흔적입니다.
1장의 "자기 소유 경로만" 규칙은 유지됐지만 "각자 브랜치" 규칙은 여기서 끝났습니다.

통합 직후 40분 동안 들어간 것들입니다.

| 커밋 | 내용 | 세션 |
| --- | --- | --- |
| `42d5751` | `@pv/game-data`: 팀 67개, 선수 1,227명 런타임 데이터 | PV-1 |
| `e0ba8e8`, `d96eb23` | 데스크톱 UI + 실제 라운드 시뮬레이터 연결 | PV-6 |
| `d275150` | 통합 E2E 수용 테스트 + 머지 전 감사 처리 | PV-3 |
| `bd80480` | `sim:validate` 러너, 경기 단위 경제 API | PV-2 |
| `f9f7a09` | 리플레이 포맷에 팀별 지각 트랙 | PV-6 |
| `c251b3a` | `@pv/match-runner`: 피스톨부터 연장전까지 | PV-3 |

### 수용 테스트

통합 계획서 5장의 수용 기준은 다섯 가지입니다.
결정론, 정보 경계(정책 입력에 세계 상태 없음), 실행 가능성 판정, 경제 평가(todo 4개), 통계 타당성(PV-2 기준선).

```ts
// packages/integration-adapters/test/e2e.integration.test.ts
const hash = (o: unknown) => createHash("sha256").update(JSON.stringify(o)).digest("hex").slice(0, 16);
...
  it("is deterministic (same seed → identical EventLog)", () => {
    expect(hash(teamSim(7).runRound(makeSyntheticRound(spatial)).events))
      .toBe(hash(teamSim(7).runRound(makeSyntheticRound(spatial)).events));
  });
```

E2E 4개: 라운드가 정상 종료되는가, 결정적인가, 이벤트 로그 → PV-6 포맷 → 리플레이 변환이 되는가, 20시드 비교.

머지 전 감사(2편)의 조치 항목 6개도 이때 처리됐습니다.
리플레이 웹 플레이어를 다시 구현한 코드의 MIT 라이선스 전문 첨부, Recast/Detour의 zlib 고지, 외부 파서 고지, 리플레이 브랜치 squash, 실데이터 스크린샷 육안 확인, VCT Reference 출처 표기.
`THIRD_PARTY_NOTICES.md` 끝에 "items [A]–[F] processed"가 남아 있습니다.

### 15:05, 첫 main 머지

오케스트레이터는 통합 브랜치를 그냥 머지하지 않고 직접 재현했습니다.

- `pnpm -r typecheck` 전 패키지 통과
- 코어 128 통과 / 4 todo, 패키지별 테스트 전부 통과(공간 21, 지각 17, 교전 15, 스킬 18, 라운드 16, 경제 31, 리플레이 14, 게임 데이터 7, 경기 진행 8)
- 실제 경기: Team Heretics 13–11 NRG, 약 2.4초
- 비밀정보, 자격증명, 원본 `.blend`/`.vrf`: 0건

그리고 "알려진 한계"를 같이 적었습니다.
24라운드 중 19라운드가 시간 초과.
11편의 이야기는 여기서 시작합니다.

## 여덟 번의 main 머지

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

1~7차는 머지 커밋이고, 대부분 바로 뒤에 "docs: record N-th main merge" 커밋이 따라옵니다.
8차는 머지 커밋이 아니라 main에 직접 올린 커밋 하나이고, 작업 기록 갱신도 같은 커밋에 들어 있습니다.

15:19부터 19:32까지 두 번째 사용량 제한이 있었습니다.
PV-2, PV-3, PV-4가 멈췄습니다.
그래서 1차와 2차 머지 사이가 4시간 넘게 비어 있습니다.

머지마다 오케스트레이터가 같은 명령(`sim:batch --matches 20`)으로 직접 재현한 숫자를 기록했고, 7차처럼 기능만 추가한 머지에서도 "기본값 판정 3/8 불변"을 확인했습니다.
새 기능이 기존 시뮬레이션 결과를 바꾸지 않았다는 확인입니다.

## 문서끼리 어긋난 곳

이 연재를 쓰면서 기록을 교차 확인하다 보니, 문서끼리 어긋나는 곳이 꽤 있었습니다.

- 2차 리허설의 20시드 비교 결과를 리허설 문서는 "전멸 11 / 시간 초과 9"로, 통합 결과 문서는 "전멸 9 / 시간 초과 11"로 적었습니다. 정반대입니다.
- 작업 기록은 시간 초과 수정을 커밋 두 개(`717750f`/`b739123`)로 적었는데, `717750f`는 저장소의 어떤 ref에도 없습니다.
- 판정 지표의 분모가 9에서 8로 바뀐 이유는 적혀 있지 않습니다. 시뮬레이션에 나타난 구매 매치업 칸 구성이 달라진 것으로 보이지만 확인하지 못했습니다.
- `HANDOFF.md`, `DEVELOPMENT_LOG.md`, `NEXT_TASKS.md`는 통합 **전**에 쓰여서 "Electron 앱 없음" 같은 낡은 상태를 그대로 담고 있습니다.
- 작업 기록 2장의 PV-6 마지막 줄은 아직 "진행 중"입니다.

하나하나는 사소합니다.
하지만 여섯 세션이 각자 문서를 쓰고, 상황이 바뀌어도 이전 문서를 고치지 않는 구조에서는 이런 어긋남이 빠르게 쌓입니다.
사람 팀이라면 회의에서 "그 문서 이제 틀렸어요"라고 말할 사람이 있겠지만, 여기서는 그 역할을 맡은 세션이 없었습니다.
오케스트레이터는 숫자를 재현했지만 문서끼리의 일관성은 검사하지 않았습니다.

## 정리

충돌 0건은 세 가지가 만든 결과입니다.

1. **소유권**: 경로마다 주인이 하나. 이 규칙이 텍스트 충돌을 원천적으로 막았습니다.
2. **계약 우선**: 공유 타입과 인터페이스를 먼저 선언하고, 상대 브랜치의 API를 복사해서 개발. 이 패턴이 "머지 없이 같이 일하기"를 가능하게 했습니다.
3. **리허설**: 버려도 되는 곳에서 미리 합쳐 보기. 텍스트 충돌이 없다는 것을 확인한 다음, 진짜 문제인 의미 충돌(F1~F6)을 찾아냈습니다.

그리고 한계도 분명합니다.
의미의 충돌은 리허설에서 일부만 잡혔고, 나머지는 통합 후 시뮬레이션 숫자가 이상하게 나오는 형태로 드러났습니다.
"미러를 진짜 import로 바꾸기"는 아직 끝나지 않았습니다.
4편의 경제 판단, 6편의 결과 예측기처럼 "만들었지만 꽂지 않은" 부품들도 이 단계에서 연결 목록에서 빠졌습니다.

다음 편은 통합 이후 하루 동안의 보정 이야기입니다.
판정 0/9에서 4/8까지, 숫자 하나를 고칠 때마다 다른 숫자가 튀어나오던 과정입니다.

## 참고 자료

- [docs/WORK_HISTORY.md](https://github.com/2rangs/Project-VM/blob/main/docs/WORK_HISTORY.md)
- [docs/INTEGRATION_PLAN.md](https://github.com/2rangs/Project-VM/blob/main/docs/INTEGRATION_PLAN.md)
- [docs/INTEGRATION_REHEARSAL.md](https://github.com/2rangs/Project-VM/blob/main/docs/INTEGRATION_REHEARSAL.md)
- [docs/INTEGRATION_RESULT.md](https://github.com/2rangs/Project-VM/blob/main/docs/INTEGRATION_RESULT.md)
- [docs/THIRD_PARTY_NOTICES.md](https://github.com/2rangs/Project-VM/blob/main/docs/THIRD_PARTY_NOTICES.md)
- [packages/integration-adapters](https://github.com/2rangs/Project-VM/tree/main/packages/integration-adapters)
- [tools/integration-rehearsal](https://github.com/2rangs/Project-VM/tree/main/tools/integration-rehearsal)
- [Handoff.md 25장 (인수인계 템플릿)](https://github.com/2rangs/Project-VM/blob/main/Handoff.md)
