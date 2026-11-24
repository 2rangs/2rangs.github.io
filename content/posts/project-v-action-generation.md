---
slug: project-v-action-generation
title: PROJECT V 개발기 (5) 볼 수 없는 것은 모르게, 할 수 없는 것은 빼고
summary: 선수가 보지 못한 적의 위치는 타입에서 아예 뺐고, 불가능한 행동은 이유를 붙여 후보에서 제외했다. 난수는 이름별 스트림으로 나눠 재현성을 지켰다.
tags: [PROJECT V, 게임 AI, TypeScript]
series: PROJECT V 개발기
date: 2026-11-19T04:04:00.000Z
comment_term: blog-post-project-v-action-generation
---

마스터 프롬프트 1.3절의 제목은 "개발에서 가장 먼저 해결해야 할 문제"다. 거기 적힌 건 매니지먼트 UI나 그래픽이 아니라 이 질문이다.

> 현재 경기 상태에서 선수 또는 팀이 실행할 수 있는 의미 있는 선택지를 어떻게 자동으로 생성할 것인가?

남은 시간 35초, 공격 3명, 수비 4명이라는 예시가 붙어 있다. 공격 팀은 사이트에 진입하거나, 다른 사이트로 돌거나, 페이크를 주거나, 시간을 끌 수 있다. 하지만 실제로 가능한 선택지는 스파이크를 누가 어디서 들고 있는지, 남은 시간 안에 도착할 수 있는지, 적이 어디 있다고 생각하는지에 따라 달라진다. 코어 세션(PV-3)은 이 문제를 선수가 볼 수 없는 정보를 코드에서 아예 다룰 수 없게 만드는 데서부터 풀었다.

한 번의 의사결정은 시나리오를 읽어 팀의 믿음을 만들고, 행동 후보를 생성·평가한 뒤 디버거 보고서로 내보내는 순서로 흘러간다(`docs/DECISION_MODEL.md` §1). 마스터 프롬프트 15.1절의 파이프라인(관측 → 믿음 → 목표 → 스키마 → 파라미터 → 제약 → 후보 → 결과 예측 → 효용 → 선택)을 거의 그대로 따랐다.

## 보지 못한 것은 표현할 수 없게

DECISION-004는 "AI 선수가 자신이 볼 수 없는 적의 정확한 위치를 알고 행동하는 것은 허용하지 않는다"이다. 보통 이런 규칙은 코드 리뷰에서 "여기서 `world.players` 읽으면 안 돼요"라고 지적하는 식으로 지킨다. PV-3는 리뷰 대신 타입으로 막았다.

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

관측된 적에는 현재 위치 필드가 없고, 마지막으로 본 위치와 시각만 있다. 체력도 숫자 대신 멀쩡함·다침·빈사·모름 네 단계다. 실제 게임에서도 적 체력은 대충만 알 수 있으니까.

세계 상태에서 관측을 만드는 함수는 `observeWorld` 하나뿐이고, 누가 누구를 볼 수 있는지는 오라클이 판단한다. 실제 오라클은 공간·지각 엔진(PV-4)이 제공하고(7편), 기본값인 `BLIND_ORACLE`은 아무것도 보지 못한다. 그래서 오라클 연결을 빠뜨려도 AI가 벽 너머 적을 아는 일은 없고, 그냥 적을 하나도 못 본 채 소극적으로 움직인다. 설계 문서는 이걸 "under-informs rather than leaks"라고 적었다.

이 경계는 테스트로도 한 번 더 확인한다. 팀 정책이 받는 입력(`PolicyView`)에는 세계 상태 필드가 없고, 테스트에서 `expect("world" in view).toBe(false)`로 실행 시점에도 확인한다. `belief.ts`는 `WorldState`를 import하지도 않는다. 핸드오프 문서의 표현을 빌리면 전지적 플레이는 금지된 게 아니라 표현 불가능하다.

## 보이지 않는 적은 어디에 있나

마스터 프롬프트 17.3절은 "10초 전에 본 적의 위치를 지금 위치로 가정하지 마라. 이동 가능한 범위로 퍼뜨려라"라고 한다. Belief State(`packages/decision-engine/src/belief.ts`)가 이 일을 한다. 적을 마지막으로 본 구역에 확률 1을 두고, 시간 `t`가 지나면 그 시간 안에 달려서 갈 수 있는 구역들에 `1 − t / maxAgeMs`만큼 가중치를 준 뒤 정규화한다. 시간이 더 지나면 계속 넓히고(`advanceTeamBelief`), 그 적이 다시 보이면 한 지점으로 모은다(`observeTeamBelief`).

소리도 반영한다. 발소리나 스킬 소리가 들리면 그 구역에 "접촉"이 생기고, 가중치는 소리의 확신도에 10초 동안 선형으로 줄어드는 값을 곱해서 정한다. 이 믿음으로 구역마다 적 압박(enemy pressure)을 계산하는데, 그 구역에 있을 것으로 보는 적들의 확률 합에 소리 접촉을 더한 값이다. 라운드 시뮬레이터와 연결하면서 매 틱 호출되는 `buildBeliefState`가 추가됐고, 위협이 큰 구역 상위 8개와 확신도(적이 하나라도 보이면 0.6, 아니면 0.3)를 돌려준다. 9편의 "안개 뷰" 히트맵이 이 값이다.

## 행동 후보는 상황에서 만든다

행동 스키마의 `generate`는 상수 배열이 아니라 함수다. 상황을 받아서 거기 맞는 후보를 만든다. 사이트가 두 개인 맵에서는 `A_EXECUTE`, `B_EXECUTE`가, 세 개인 맵에서는 세 개가 나오고, 보이는 적이 있으면 적마다 출구 킬 후보가 생긴다.

공격 측은 설치 전이면 사이트마다 `X_EXECUTE`와 `MID_CONTROL`, `DEFAULT`(5초간 정보 수집), `FAKE_X_TO_Y`, `LURK`가 나오고, 설치 후면 `POST_PLANT_HOLD`와 관측된 적마다 `EXIT_KILL_<id>`가 나온다. 수비는 `DEFAULT_HOLD`, `AGGRO_PUSH`, `ROTATE_A/B`에 설치 후 `RETAKE`가 붙는다. `SAVE`는 언제나 있다. 여기에 선수 개인 행동(`HOLD`, `MOVE`, 믿음상 압박이 가장 큰 쪽으로의 `PEEK`, `ABILITY:<id>`, `PLANT`, `DEFUSE`, `SAVE_RETREAT`)이 함께 나온다. 팀은 "A로 간다"를 고르고 선수들은 그 안에서 "나는 홀드, 너는 피킹"을 고르는 구조이고, 두 층을 묶는 건 6편의 팀 엔진이다.

마스터 프롬프트 15.3절에는 "불가능한 행동은 점수만 낮추는 것이 아니라 명확하게 제외한다"는 문장이 있다. 이 차이가 꽤 크다. 불가능한 행동에 낮은 점수만 주면 다른 행동 점수가 더 낮을 때 불가능한 행동이 뽑힐 수 있고, 디버깅할 때 "점수가 낮아서 안 골랐다"와 "할 수 없어서 안 골랐다"를 구분할 수 없다. 그래서 결과 타입을 가능/불가능 둘로 나누고, 불가능에는 `noPath`, `insufficientTime`, `missingAbility`, `deadActor`, `wrongSpikeState`, `notEnoughPlayers`, `outOfRange`, `blocked` 중 이유를 붙인다.

사이트 진입 판정은 이렇게 생겼다.

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

기준은 스파이크 소지자다. 나머지 넷이 먼저 도착해도 소지자가 못 가면 설치할 수 없다. 그래서 필요 시간은 "소지자 이동 시간 + 설치 4초"이고, 나머지 인원은 동시에 모인다고 가정한다. 페이크는 살아 있는 인원이 3명 이상이어야 하고, 스킬 충전이 0이면 `missingAbility`, 설치 가능 구역이 아니면 설치는 `blocked`, 스파이크가 있는 구역이 아니면 해체는 `outOfRange`다. 리테이크는 "모여서 이동하는 시간 + 해체 7초"가 폭발까지 남은 시간보다 길면 `insufficientTime`이다.

## 위험도와 효용

남은 후보에는 필요 시간, 자원 비용, 위험도, 기대 효용, 근거 문장이 붙는다. 위험도는 목표 구역의 적 압박에 그 구역이 보이는 다른 구역들의 압박을 절반씩 더하는 데서 시작한다. 내가 설 자리를 내려다보는 곳에 적이 있으면 위험하니까. 이걸 `1 − exp(−1.5 × 압박)`으로 0~1 사이로 바꾸고, 인원이 적으면 한 명당 0.12를 더한다. 세이브나 후퇴처럼 목표 구역이 없는 행동은 0.1로 고정했는데, 주석에 적힌 이유는 "세이브의 요점은 교전을 피하는 것"이다.

효용은 뺄셈 두 번이다.

```text
효용 = 기본값 − 0.6 × 위험도 − 0.3 × (필요 시간 ÷ 남은 시간)
```

기본값은 설치 1.1, 사이트 진입 1.0, 설치 후 홀드 0.9, 리테이크 0.85, 기본 수비 0.7, 페이크 0.6, 미드 장악 0.55, 푸시·로테이션·출구 킬 0.5, 기본 운영·개인 홀드 0.45, 러커·개인 이동 0.4, 개인 피킹 0.35, 스킬·세이브 0.3이다. "설치가 진입보다 조금 더 중요하고, 진입이 홀드보다 중요하다"는 우선순위를 표현한 설계 값일 뿐이고, 가중치 객체에도 `verified: false`를 달아 두었다. 4편의 경제 상수와 같은 표시이고, 주석에는 "나중에 시뮬레이션으로 보정할 값(Handoff §20.5)"이라고 적혀 있다.

가능한 후보를 효용 내림차순으로, 같으면 id 오름차순으로 정렬해서 동점이어도 항상 같은 순서가 나오게 했다. 그중 효용이 가장 높은 전략 행동을 고른다.

## 디버거로 읽어 본 8초 남은 상황

마스터 프롬프트 29장과 34장은 제외된 후보와 이유, 예측, 선택 이유를 보여 주는 디버거를 요구한다. "A 메인에서 8초 남았다"는 합성 시나리오 04로 돌려 봤다.

```bash
npx tsx src/cli.ts test/fixtures/scenarios/scenario_04.json
```

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

B 진입은 소지자가 9.5초 이동하고 4초 설치해야 하는데 8초뿐이라 빠지고, 페이크 둘도 시간이 모자라 빠진다. A 메인은 설치 구역이 아니라 제자리 설치도 빠진다. 남은 A 진입은 6.5초가 필요하고 보이는 적이 없어 위험도 0이니, 효용은 `1.0 − 0.6 × 0 − 0.3 × (6500 ÷ 8000)` = 0.756이다. 손으로 계산한 값과 보고서 값이 같다. 보고서 맨 위의 "합성 시나리오이며 실제 VCT 경기가 아니다" 경고는 3편에서 정한 실데이터·합성 데이터 구분이 출력까지 이어진 것이다.

디버거 테스트는 시나리오 10개를 돌린다. 그중 경제 판단이 필요한 4개(07 오퍼레이터 세이브, 08 궁극기 차단, 09 매치 포인트, 10의 출구 킬 가치)는 4편의 경제 엔진을 의사결정 경로에 연결한 뒤 채울 예정이라 `it.todo`로 남겨 두었고, 테스트 계획 문서에도 todo는 통과로 세지 않는다고 적었다.

## 같은 시드, 같은 경기

DECISION-010은 "같은 초기 상태와 난수 시드를 사용하면 같은 경기 결과를 재현해야 한다. 랜덤 생성 순서가 달라져 결과가 변하지 않도록 난수 흐름을 관리한다"이다. 어려운 건 뒷문장이다. 시드 하나로 난수 생성기 하나를 쓰면, 어딘가에서 난수를 한 번 더 뽑는 순간 그 뒤가 전부 밀린다. 교전 판정에 난수 하나를 추가했을 뿐인데 이후의 구매와 이동이 다 바뀌고, 결과가 바뀐 게 수정 때문인지 난수가 밀려서인지 알 수 없게 된다.

PV-3는 스트림을 나눠서 풀었다.

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

루트 시드와 스트림 이름("combat", "policy:attack" 등)을 섞어서 스트림마다 독립된 상태를 만든다. 알고리즘은 SplitMix64이고 BigInt로 구현해서 부동소수점 오차가 없다. 테스트 이름이 목적을 그대로 말해 준다. "adding a draw in one stream does not shift another stream's values." 핸드오프 문서는 이 방식이 전역 추첨 순서를 규율로 지키는 것보다 훨씬 단순하다고 설명한다.

나머지 장치도 같은 방향이다. 시계는 정수 밀리초 틱만 쓴다. 이벤트 로그는 추가만 되고, 순번(`seq`)은 로그가 직접 매기며 순번이 증가하지 않는 이벤트는 거부한다. 세계 상태는 deep freeze되어 있어서 갱신하면 늘 새 객체가 나온다. 아키텍처 문서에 따르면 한 라운드를 재현하는 데 필요한 건 초기 세계 상태, 시드, 이벤트 로그 세 가지다. 1편에서 "같은 시드인데 첫 머지 때는 Team Heretics가 13–11로 이겼고 지금은 NRG가 13–10으로 이긴다"고 했는데, 그 차이를 코드 변경 탓으로 볼 수 있는 근거가 이것들이다.

실제 경기 경로에서 팀 정책에 난수를 주는 건 이 SplitMix64 스트림이 아니라 라운드 시뮬레이터(PV-4)의 시드 난수 생성기(mulberry32 기반)다. 공격과 수비가 각각 `policy:attack`, `policy:defense`라는 이름으로 시드를 파생한다. 이름으로 스트림을 나눈다는 같은 아이디어를 두 세션이 각자 구현했다. 둘이 같이 돌아가는 건 팀 정책이 구체 클래스가 아니라 `nextFloat`와 `nextInt`만 있는 `RandomSource` 인터페이스를 받기 때문이다. 이 패턴이 프로젝트 전체에서 어떻게 쓰였는지는 10편에서 다시 다룬다.

돌아보면 이 부분은 AI가 할 수 없는 것부터 정의한 작업이었다. 볼 수 없는 정보는 타입에서 뺐고, 할 수 없는 행동은 이유와 함께 제외했고, 난수가 결과를 흔들지 않게 스트림을 나눴다. 그 위의 계산은 지수 함수 하나와 뺄셈 두 번으로 단순하고, 가중치는 전부 임시값이라 11편의 보정 과정에서 다시 맞춘다.

## 참고 자료

- [docs/DECISION_MODEL.md](https://github.com/2rangs/Project-VM/blob/main/docs/DECISION_MODEL.md)
- [docs/ARCHITECTURE.md](https://github.com/2rangs/Project-VM/blob/main/docs/ARCHITECTURE.md)
- [docs/handoffs/PV-3-core.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-3-core.md)
- [packages/shared-types](https://github.com/2rangs/Project-VM/tree/main/packages/shared-types)
- [packages/action-generator](https://github.com/2rangs/Project-VM/tree/main/packages/action-generator)
- [packages/decision-engine](https://github.com/2rangs/Project-VM/tree/main/packages/decision-engine)
- [packages/decision-debugger](https://github.com/2rangs/Project-VM/tree/main/packages/decision-debugger)
- [packages/simulation-core](https://github.com/2rangs/Project-VM/tree/main/packages/simulation-core)
