---
slug: project-v-action-generation
title: PROJECT V 개발기 (5) AI가 할 수 없는 것부터 정의하기: 상황 기반 선택지 생성
summary: 못 보는 적은 타입에서 지우고, 불가능한 행동은 이유를 붙여 빼고, 난수는 스트림으로 쪼갰습니다. World State, Belief State, Action Generator, 의사결정 디버거 이야기입니다.
tags: [PROJECT V, 게임 AI, TypeScript]
series: PROJECT V 개발기
date: 2026-11-19T04:04:00.000Z
comment_term: blog-post-project-v-action-generation
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 5편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `docs/DECISION_MODEL.md`, `docs/handoffs/PV-3-core.md`와 `packages/shared-types`, `world-state`, `decision-engine`, `action-generator`, `decision-debugger`, `simulation-core`의 코드를 근거로 썼습니다.

마스터 프롬프트 1.3절의 제목은 "개발에서 가장 먼저 해결해야 할 문제"입니다.
매니지먼트 UI도, 그래픽도 아니고 이 질문입니다.

> 현재 경기 상태에서 선수 또는 팀이 실행할 수 있는 의미 있는 선택지를 어떻게 자동으로 생성할 것인가?

예시도 붙어 있습니다.
남은 시간 35초, 공격 3명, 수비 4명.
공격 팀은 사이트에 진입할 수도, 다른 사이트로 돌 수도, 페이크를 줄 수도, 시간을 끌 수도 있습니다.
그런데 실제로 가능한 선택지는 스파이크를 누가 들고 어디 있는지, 남은 시간 안에 거기까지 갈 수 있는지, 적이 어디 있다고 믿는지에 따라 달라집니다.

이번 편은 코어 세션(PV-3)이 이 질문에 답한 방식입니다.
그리고 그 답이 "AI가 보면 안 되는 것을 못 보게 만드는" 설계에서 출발한다는 이야기입니다.

## 한눈에 보기

- 실제 세계(World State)와 선수가 아는 것(Observation, Belief)을 **타입으로** 분리했습니다. 관측된 적에는 "현재 위치" 필드가 아예 없고, "마지막으로 본 위치"만 있습니다.
- 관측 함수의 기본값은 아무것도 보지 못하는 `BLIND_ORACLE`입니다. 연결을 잘못하면 정보가 새는 대신 모자라게 됩니다.
- Belief State는 마지막으로 본 위치에서 시간이 지날수록 갈 수 있는 구역으로 확률을 퍼뜨립니다.
- 행동 후보는 고정 목록이 아니라 상황에서 생성합니다. 불가능한 행동은 점수를 깎는 게 아니라 **이유를 붙여 제외**합니다. 예: "B 진입에는 13.5초가 필요한데 8초 남았다."
- 가능한 행동은 위험도와 기대 효용으로 평가합니다. 머신러닝 없이 규칙과 가중치로 계산하고, 가중치는 전부 "임시값"으로 표시되어 있습니다.
- 의사결정 디버거가 후보, 제외 이유, 평가, 선택 이유를 마크다운 보고서로 출력합니다.
- 결정론은 이름 붙은 난수 스트림을 서로 독립적으로 쪼개는 방식으로 보장했습니다. 한 스트림에서 난수를 하나 더 뽑아도 다른 스트림 값은 바뀌지 않습니다.

## 전체 흐름

의사결정 한 번이 지나가는 길은 이렇습니다(`docs/DECISION_MODEL.md` §1).

```text
DecisionContext (시나리오 JSON)
   │  loadDecisionContext          (world-state)
   ▼
TeamDecisionContext
   │  buildTeamBelief              (decision-engine: 관측 + 공간 질의만 사용)
   ▼
TeamBeliefModel
   │  generateActions              (action-generator: 공간 질의 + 적 압박)
   ▼
GenerationResult  =  가능한 후보(평가됨) + 제외된 후보(이유) + 선택
   │  buildTrace / renderMarkdown  (decision-debugger)
   ▼
보고서
```

마스터 프롬프트 15.1절이 요구한 파이프라인(관측 → 믿음 → 목표 → 스키마 → 파라미터 → 제약 → 후보 → 결과 예측 → 효용 → 선택)을 거의 그대로 따릅니다.
하나씩 보겠습니다.

## 1단계: 못 보는 것은 모르게

DECISION-004는 "AI 선수가 자신이 볼 수 없는 적의 정확한 위치를 알고 행동하는 것은 허용하지 않는다"입니다.
이런 규칙은 보통 코드 리뷰로 지킵니다.
"여기서 `world.players`를 읽으면 안 돼요."
PV-3는 이 규칙을 리뷰가 아니라 타입으로 지키게 했습니다.

관측된 적의 타입은 이렇습니다.

```ts
// packages/shared-types/src/observation.ts
export type HealthBand = "full" | "hurt" | "low" | "unknown";
export interface ObservedEnemy {
  readonly playerId: PlayerId;
  readonly agentId: AgentId | null;
  /** Where the enemy was when last seen — NOT their current position. */
  readonly lastSeenPosition: Vector3;
  readonly lastSeenAtMs: number;
  readonly healthBand: HealthBand;
  readonly observedWeaponId: WeaponId | null;
  readonly currentlyVisible: boolean;
}
```

여기에는 적의 현재 위치가 없습니다.
마지막으로 본 위치와 그 시각만 있습니다.
체력도 정확한 숫자가 아니라 "멀쩡함, 다침, 빈사, 모름" 네 단계입니다.
실제 게임에서도 적 체력은 대략적으로만 알 수 있으니까요.

세계에서 관측으로 넘어가는 문은 `observeWorld` 하나뿐입니다.

```ts
// packages/world-state/src/observation.ts
/** Default oracle: no vision, no hearing. Fails safe (never leaks unseen enemies). */
export const BLIND_ORACLE: VisibilityOracle = {
  canSee: () => false,
};
...
  for (const target of world.players) {
    if (target.teamId === observer.teamId) continue; // allies are not "observed enemies"
    if (!target.alive) continue;
    if (!oracle.canSee(observer, target, world)) continue;
    visibleEnemies.push({
      playerId: target.id, agentId: target.agentId,
      lastSeenPosition: target.position, lastSeenAtMs: world.timeRemainingMs,
      healthBand: healthBand(target.health),
      observedWeaponId: target.weapon?.weaponId ?? null, currentlyVisible: true,
    });
  }
```

"누가 누구를 볼 수 있는가"는 오라클이 판단합니다.
실제 오라클은 공간·지각 엔진(PV-4)이 제공합니다(7편).
그리고 기본 오라클은 **아무것도 보지 못합니다.**

이 기본값이 중요합니다.
오라클을 연결하는 걸 깜빡하면 AI는 적을 하나도 못 보는 상태로 움직입니다.
이상하게 소극적으로 굴겠지만, 벽 너머의 적을 아는 치트 AI가 되지는 않습니다.
설계 문서의 표현으로는 잘못 연결하면 "새는 대신 모자라게(under-informs rather than leaks)" 됩니다.

이 경계는 테스트로도 고정되어 있습니다.
팀 정책이 받는 입력(`PolicyView`)에는 세계 상태 필드가 없고, 테스트는 실행 시점에 `expect("world" in view).toBe(false)`로 그걸 확인합니다.
`belief.ts`는 `WorldState`를 import하지도 않습니다.
핸드오프 문서는 이걸 "전지적 플레이가 금지된 게 아니라 표현 불가능하다"고 적었습니다.

## 2단계: 본 적 없는 적을 믿기

못 보는 적은 어디 있을까요?
마스터 프롬프트 17.3절은 이렇게 말합니다.
"10초 전에 본 적의 위치를 지금 위치로 가정하지 마라. 이동 가능한 범위로 퍼뜨려라."

Belief State가 그 일을 합니다(`packages/decision-engine/src/belief.ts`).

1. 적을 마지막으로 본 구역에 확률 1을 둡니다.
2. 그 뒤로 시간 `t`가 지날 때마다, 그 시간 안에 달려서 갈 수 있는 구역들에 `1 − t / maxAgeMs`만큼의 가중치를 줍니다.
3. 정규화합니다.
4. 시간이 더 흐르면 계속 퍼뜨립니다(`advanceTeamBelief`).
5. 그 적이 다시 보이면 다시 한 점으로 모읍니다(`observeTeamBelief`).

소리도 들어갑니다.
발소리나 스킬 소리가 들리면 그 구역에 "접촉"이 생기고, 가중치는 소리의 확신도에 10초에 걸친 선형 감쇠를 곱한 값입니다.

이렇게 만든 믿음에서 구역마다 "적 압박(enemy pressure)"을 뽑습니다.
그 구역에 있을 것으로 믿는 적들의 확률 합에 소리 접촉을 더한 값입니다.
이 숫자가 다음 단계에서 위험도 계산에 쓰입니다.

나중에 라운드 시뮬레이터와 연결하면서 `buildBeliefState`라는 함수가 추가됐습니다.
시뮬레이터가 매 틱 호출하는 계약 함수이고, 위협이 큰 구역 상위 8개와 확신도(적이 하나라도 보이면 0.6, 아니면 0.3)를 함께 돌려줍니다.
9편의 "안개 뷰"에서 화면에 칠해지는 히트맵이 이 믿음입니다.

## 3단계: 행동 후보 만들기

이제 이 프로젝트의 핵심 질문으로 돌아옵니다.
가능한 행동을 어떻게 만들까요?

### 스키마는 목록이 아니라 함수다

행동 스키마 타입입니다.

```ts
// packages/shared-types/src/action-schema.ts
export interface ActionSchema {
  readonly id: string;
  readonly category: ActionCategory;          // "strategic" | "tactical" | "individual"
  readonly parameters: readonly ParameterDefinition[];
  readonly preconditions: readonly Condition[];
  generate(context: DecisionContext): readonly CandidateAction[];
}
```

`generate`가 함수입니다.
"행동은 이 10개"라는 상수 배열이 아니라, 상황을 받아서 그 상황에 맞는 후보를 만들어 내는 함수입니다.
사이트가 두 개인 맵에서는 `A_EXECUTE`, `B_EXECUTE`가, 세 개인 맵에서는 셋이 나옵니다.
보이는 적이 있으면 그 적마다 출구 킬 후보가 나옵니다.

### 무엇이 생성되나

상황별로 이런 후보들이 나옵니다(`packages/action-generator/src/generate.ts`).

| 상황 | 후보 |
| --- | --- |
| 공격, 설치 전 | 사이트마다 `X_EXECUTE`, `MID_CONTROL`, `DEFAULT`(5초간 정보 수집), `FAKE_X_TO_Y`, `LURK` |
| 공격, 설치 후 | `POST_PLANT_HOLD`, 관측된 적마다 `EXIT_KILL_<id>` |
| 수비 | `DEFAULT_HOLD`, `AGGRO_PUSH`, `ROTATE_A/B`, 설치 후 `RETAKE` |
| 언제나 | `SAVE` |
| 선수 개인 | `HOLD`, `MOVE`, `PEEK`(믿음상 압박이 가장 큰 쪽으로), `ABILITY:<id>`, `PLANT`, `DEFUSE`, `SAVE_RETREAT` |

전략 단위(팀 전체)와 개인 단위가 같이 나온다는 점이 특징입니다.
팀은 "A로 간다"를 고르고, 선수 각자는 그 안에서 "나는 홀드, 너는 피킹"을 고릅니다.
이 두 층을 엮는 것이 6편의 팀 엔진입니다.

### 불가능한 것은 이유를 붙여 뺀다

마스터 프롬프트 15.3절에는 이런 문장이 있습니다.
"불가능한 행동은 점수만 낮추는 것이 아니라 명확하게 제외한다."

이 차이는 생각보다 큽니다.
불가능한 행동에 낮은 점수만 주면, 다른 행동의 점수가 더 낮아지는 이상한 상황에서 불가능한 행동이 선택될 수 있습니다.
그리고 디버깅할 때 "이 행동은 점수가 낮아서 안 골랐다"와 "이 행동은 할 수 없어서 안 골랐다"가 구분되지 않습니다.

그래서 결과 타입이 둘로 갈립니다.

```ts
// packages/shared-types/src/action-schema.ts
export type InfeasibilityReason =
  | "noPath" | "insufficientTime" | "missingAbility" | "deadActor"
  | "wrongSpikeState" | "notEnoughPlayers" | "outOfRange" | "blocked";

export type FeasibilityResult =
  | { readonly feasible: true }
  | { readonly feasible: false; readonly reasons: readonly InfeasibilityReason[] };
```

사이트 진입의 가능 여부는 이렇게 판단합니다.

```ts
// packages/action-generator/src/generate.ts
      // The plant is gated by the CARRIER reaching the site (support players converge in
      // parallel); requiredTime = carrier travel + plant.
      const requiredTime = (carrierReach ?? 0) + PLANT_MS;
      let feas: FeasibilityResult;
      let explanation = "";
      if (carrier === null || carrierReach === null) {
        feas = infeasible(["noPath"]);
        explanation = `spike carrier cannot reach ${letter} site`;
      } else if (requiredTime > timeRemaining) {
        feas = infeasible(["insufficientTime"]);
        explanation = `need ${requiredTime}ms (carrier move ${carrierReach}+plant ${PLANT_MS}) but only ${timeRemaining}ms left`;
      } else {
        feas = feasible;
      }
```

핵심은 "스파이크를 든 사람"이 기준이라는 점입니다.
다른 네 명이 사이트에 먼저 도착해도, 스파이크 든 사람이 못 가면 설치는 없습니다.
그래서 필요한 시간은 "스파이크 소지자의 이동 시간 + 설치 4초"입니다.
나머지 인원은 동시에 모인다고 가정합니다.

다른 제약도 같은 방식입니다.

- 페이크는 살아 있는 인원이 3명 이상이어야 합니다(`notEnoughPlayers`).
- 스킬은 충전이 0이면 `missingAbility`입니다.
- 설치는 설치 가능 구역이 아니면 `blocked`, 해체는 스파이크가 있는 구역이 아니면 `outOfRange`입니다.
- 리테이크는 "모여서 이동하는 시간 + 해체 7초"가 폭발까지 남은 시간보다 길면 `insufficientTime`입니다.

## 4단계: 가능한 것을 평가하기

살아남은 후보에는 필요 시간, 자원 비용, 위험도, 기대 효용, 그리고 근거 문장 목록이 붙습니다.

### 위험도

```ts
// packages/action-generator/src/evaluate.ts
  let pressure = enemyPressure(targetZone);
  for (const z of spatial.visibleZonesFrom(targetZone)) {
    pressure += WEIGHTS.sightlinePressure * enemyPressure(z);
  }
  let risk = 1 - Math.exp(-WEIGHTS.riskSharpness * pressure);
  if (aliveEnemy > aliveSelf) risk += WEIGHTS.disadvantageRisk * (aliveEnemy - aliveSelf);
  return Math.max(0, Math.min(1, risk));
```

1. 목표 구역에 적이 있을 것으로 믿는 정도(압박)를 구합니다.
2. 목표 구역이 **보이는** 다른 구역들의 압박을 절반씩 더합니다. 내가 서 있을 곳을 내려다보는 자리에 적이 있으면 위험합니다.
3. `1 − exp(−1.5 × 압박)`으로 0~1 사이 값으로 만듭니다. 압박이 커질수록 위험도는 1에 가까워지지만 넘지는 않습니다.
4. 인원이 열세면 한 명당 0.12씩 더합니다.

세이브나 후퇴처럼 목표 구역이 없는 행동은 위험도 0.1로 고정입니다.
주석에 적힌 이유는 "세이브의 요점은 교전을 피하는 것"입니다.

### 기대 효용

```ts
export function expectedUtility(baseValue: number, risk: number,
  requiredTimeMs: number, timeRemainingMs: number): number {
  const timeFrac = Math.min(1, requiredTimeMs / Math.max(1, timeRemainingMs));
  return baseValue - WEIGHTS.riskPenalty * risk - WEIGHTS.timePenalty * timeFrac;
}
```

```text
효용 = 기본값 − 0.6 × 위험도 − 0.3 × (필요 시간 ÷ 남은 시간)
```

기본값은 행동 종류마다 정해져 있습니다.

| 행동 | 기본값 | 행동 | 기본값 |
| --- | --- | --- | --- |
| 설치 | 1.1 | 미드 장악 | 0.55 |
| 사이트 진입 | 1.0 | 푸시, 로테이션, 출구 킬 | 0.5 |
| 설치 후 홀드 | 0.9 | 기본 운영, 개인 홀드 | 0.45 |
| 리테이크 | 0.85 | 러커, 개인 이동 | 0.4 |
| 기본 수비 | 0.7 | 개인 피킹 | 0.35 |
| 페이크 | 0.6 | 스킬, 세이브 | 0.3 |

솔직히 말하면 이 표의 숫자들은 근거가 있는 값이 아닙니다.
"설치가 진입보다 조금 더 중요하고, 진입이 홀드보다 중요하다"는 순서를 표현한 설계 값입니다.
코드에도 그렇게 적혀 있습니다.

```ts
export const WEIGHTS = {
  riskPenalty: 0.6, timePenalty: 0.3, riskSharpness: 1.5,
  disadvantageRisk: 0.12, sightlinePressure: 0.5, verified: false,
} as const;
```

`verified: false`.
주석은 "나중에 시뮬레이션으로 보정할 값(Handoff §20.5)"이라고 말합니다.
3편의 경제 상수와 같은 표시입니다.

### 선택

가능한 후보를 효용 내림차순으로 정렬하고, 같으면 id 오름차순으로 정렬합니다.
동점일 때도 항상 같은 순서가 나오게 하려는 것입니다.
그중 가장 효용이 높은 **전략** 행동이 선택됩니다.

## 디버거: AI가 왜 그랬는지 읽기

마스터 프롬프트 29장과 34장은 의사결정 디버거를 요구합니다.
제외된 후보와 이유, 예측, 선택 이유를 보여 달라는 것입니다.
이 글을 쓰면서 시나리오 04로 직접 돌려 봤습니다.

```bash
npx tsx src/cli.ts test/fixtures/scenarios/scenario_04.json
```

시나리오 04는 "A 메인에서 8초 남았다"는 합성 상황입니다.
출력은 이렇습니다(일부 줄였습니다).

```text
# Decision Debug — scenario-04-time-pressure (scenario-04)

> ⚠️ SYNTHETIC scenario — not a real VCT match. Do not present as real data.
> 8s left at A main: a B-site rotation (distance + 4s plant) cannot complete -> infeasible candidate.

Map: ascent · Round: 1 · Time left: 8.0s

## Observed (deciding team only — DECISION-004)
- Visible enemies: none

## Generated Actions (27)
- individual: HOLD@atk1 … PEEK@atk1 … MOVE@atk1 … SAVE_RETREAT@atk1 …
- strategic: A_EXECUTE, DEFAULT, LURK, SAVE

## Validation — Excluded (5)
- B_EXECUTE — insufficientTime: need 13500ms (carrier move 9500+plant 4000) but only 8000ms left
- MID_CONTROL — insufficientTime: not enough time to contest mid
- FAKE_A_TO_B — insufficientTime: fake+rotate+plant needs 16500ms > 8000ms
- FAKE_B_TO_A — insufficientTime: fake+rotate+plant needs 9500ms > 8000ms
- PLANT@atk1 — blocked: a-main is not a plantable zone

## Prediction (feasible, top 10)
| Action    | Category   | Req. time | Risk | Utility |
| A_EXECUTE | strategic  |    6500ms | 0.00 |   0.756 |
| HOLD@atk1 | individual |       0ms | 0.00 |   0.450 |
| PEEK@atk1 | individual |     800ms | 0.00 |   0.320 |
| MOVE@atk1 | individual |    2500ms | 0.00 |   0.306 |
...

## Selected Action
A_EXECUTE
Reason: highest-utility feasible strategic action "A_EXECUTE" (utility 0.7562, risk 0.00)
```

읽어 보면 판단 과정이 그대로 보입니다.

- B로 가려면 스파이크 소지자가 9.5초를 움직이고 4초를 설치해야 하는데 8초밖에 없어서 **제외**.
- 페이크는 둘 다 시간이 모자라서 **제외**.
- A 메인은 설치 구역이 아니어서 지금 자리에서 설치하는 것도 **제외**.
- 남은 것 중 A 진입은 6.5초가 필요하고, 보이는 적이 없어서 위험도 0.
- 효용 = `1.0 − 0.6 × 0 − 0.3 × (6500 ÷ 8000)` = `1.0 − 0.244` = **0.756**.

손으로 계산한 값과 보고서 값이 같습니다.
그리고 맨 위의 경고 문구를 보세요.
"합성 시나리오이며 실제 VCT 경기가 아니다. 실제 데이터처럼 제시하지 말 것."
3편의 실데이터·합성 데이터 분리가 보고서 출력까지 따라옵니다.

디버거 테스트는 시나리오 10개를 돌립니다.
그중 4개(07 오퍼레이터 세이브, 08 궁극기 차단, 09 매치 포인트, 10의 출구 킬 가치)는 `it.todo`로 남아 있습니다.
4편에서 말한 경제 판단이 아직 의사결정 경로에 꽂혀 있지 않기 때문입니다.
통과하는 척하는 가짜 단언을 쓰는 대신 "아직 안 됨"으로 표시했고, 테스트 계획 문서도 todo는 통과로 보고하지 않는다고 적고 있습니다.

## 같은 시드, 같은 경기

마지막으로 DECISION-010, 결정론입니다.
"같은 초기 상태와 난수 시드를 사용하면 같은 경기 결과를 재현해야 한다. 랜덤 생성 순서가 달라져 결과가 변하지 않도록 난수 흐름을 관리한다."

두 번째 문장이 어렵습니다.
보통 시드 하나로 난수 생성기 하나를 쓰면, 코드 어딘가에서 난수를 한 번 더 뽑는 순간 그 뒤의 모든 난수가 밀립니다.
교전 판정에 난수 하나를 추가했을 뿐인데, 그 뒤의 구매 판단과 이동 선택이 전부 바뀌는 식입니다.
이러면 "이 수정이 결과를 바꿨나, 아니면 난수가 밀려서 바뀌었나"를 구분할 수 없습니다.

PV-3의 해법은 **스트림 분리**입니다.

```ts
// packages/simulation-core/src/rng.ts
  /** Derive a stream from a root seed and a stream name. */
  static derive(rootSeed: bigint, streamName: string): RngStream {
    // Mix the root seed and the name hash so (seed, name) → unique, well-spread state.
    const mixed = splitMix64Mix(u64(rootSeed + GOLDEN_GAMMA * fnv1a64(streamName)));
    return new RngStream(mixed);
  }
...
  stream(name: string): RngStream {
    let s = this.streams.get(name);
    if (s === undefined) {
      s = RngStream.derive(this.rootSeed, name);
      this.streams.set(name, s);
    }
    return s;
  }
```

루트 시드와 스트림 이름("combat", "policy:attack" 같은)을 섞어서 스트림마다 독립된 상태를 만듭니다.
알고리즘은 SplitMix64이고, BigInt로 구현해서 부동소수점 오차가 끼어들지 않습니다.
테스트 이름이 이 설계의 목적을 그대로 말합니다.
"adding a draw in one stream does not shift another stream's values."

핸드오프 문서는 이걸 "전역 추첨 순서를 규율로 지키는 것보다 훨씬 단순하다"고 적었습니다.
모든 코드가 난수를 뽑는 순서를 조심하는 대신, 영역마다 자기 난수열을 갖게 한 것입니다.

나머지 장치도 같은 방향입니다.

- **시계**: 정수 밀리초 틱만 씁니다.
- **이벤트 로그**: 덧붙이기만 됩니다. 순번(`seq`)은 로그가 직접 매기고, 순번이 늘지 않는 이벤트는 거부합니다. 복원한 로그가 몰래 순서를 바꿀 수 없습니다.
- **세계 상태**: 깊게 동결(deep freeze)되어 있고, 갱신은 항상 새 객체를 돌려줍니다.
- **재현 조건**: 한 라운드를 재현하는 데 필요한 것은 초기 세계 상태, 시드, 이벤트 로그 셋이라고 아키텍처 문서에 적혀 있습니다.

1편에서 "같은 시드인데 첫 머지 때는 Team Heretics가 13–11로 이겼고 지금은 NRG가 13–10으로 이긴다"고 했습니다.
이걸 "코드가 바뀌어서"라고 자신 있게 말할 수 있는 이유가 여기 있습니다.

### 한 가지 덧붙임

브리프를 만들면서 코드를 따라가다 보니 재미있는 사실이 하나 나왔습니다.
실제 경기 경로에서 팀 정책에 난수를 공급하는 것은 PV-3의 SplitMix64 스트림이 아니라, 라운드 시뮬레이터(PV-4)가 가진 별도의 시드 난수 생성기(mulberry32 기반)입니다.
공격과 수비가 각자 `policy:attack`, `policy:defense`라는 이름으로 시드를 파생해서 씁니다.
같은 "이름으로 스트림을 분리한다"는 아이디어를 두 세션이 각자 구현한 셈입니다.

둘이 충돌하지 않은 이유는 팀 정책이 구체 클래스가 아니라 인터페이스만 받기 때문입니다.

```ts
// packages/shared-types/src/decision-policy.ts
export interface RandomSource {
  nextFloat(): number;
  nextInt(minInclusive: number, maxExclusive: number): number;
}
export interface DecisionPolicy {
  decide(view: PolicyView, rng: RandomSource): PolicyDecision;
}
```

`nextFloat`와 `nextInt`만 있으면 됩니다.
이 인터페이스 덕분에 두 난수 생성기가 문제없이 공존했습니다.
이 패턴이 프로젝트 전체에서 어떻게 쓰였는지는 10편에서 다룹니다.

## 정리

이번 편의 내용을 한 문장으로 줄이면 "AI가 할 수 없는 것을 먼저 정의했다"입니다.

- 볼 수 없는 것은 타입에서 지웠습니다.
- 할 수 없는 행동은 이유와 함께 뺐습니다.
- 우연이 결과를 바꾸지 못하도록 난수를 쪼갰습니다.

그 위에 남은 것은 생각보다 단순한 산수입니다.
위험도는 지수 함수 하나, 효용은 뺄셈 두 번입니다.
가중치는 전부 임시값이고, 그걸 맞추는 일은 11편의 보정 과정에서 합니다.

다음 편에서는 이 후보 생성기 위에 올라간 팀 엔진을 봅니다.
IGL이 전략을 부르고, 다섯 명이 각자 자기 행동을 고르고, 진입 타이밍을 맞추고, 그렇게 한 라운드와 한 경기가 굴러가는 과정입니다.

## 참고 자료

- [docs/DECISION_MODEL.md](https://github.com/2rangs/Project-VM/blob/main/docs/DECISION_MODEL.md)
- [docs/ARCHITECTURE.md](https://github.com/2rangs/Project-VM/blob/main/docs/ARCHITECTURE.md)
- [docs/handoffs/PV-3-core.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-3-core.md)
- [packages/shared-types](https://github.com/2rangs/Project-VM/tree/main/packages/shared-types)
- [packages/action-generator](https://github.com/2rangs/Project-VM/tree/main/packages/action-generator)
- [packages/decision-engine](https://github.com/2rangs/Project-VM/tree/main/packages/decision-engine)
- [packages/decision-debugger](https://github.com/2rangs/Project-VM/tree/main/packages/decision-debugger)
- [packages/simulation-core](https://github.com/2rangs/Project-VM/tree/main/packages/simulation-core)
