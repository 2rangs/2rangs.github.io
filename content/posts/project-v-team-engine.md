---
slug: project-v-team-engine
title: PROJECT V 개발기 (6) IGL, 다섯 명, 그리고 B에만 심기는 스파이크
summary: IGL이 전략을 부르고 다섯 명이 각자 행동을 고르는 팀 엔진과 한 경기를 굴리는 경기 진행기. 직접 실험해 보니 코치의 전략 지시는 결과를 바꾸지 못했습니다.
tags: [PROJECT V, 게임 AI, 시뮬레이션]
series: PROJECT V 개발기
date: 2026-11-19T04:05:00.000Z
comment_term: blog-post-project-v-team-engine
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 6편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `packages/team-engine`, `outcome-predictor`, `match-runner`의 코드와 테스트를 근거로 썼습니다. 글 후반의 실험은 제가 이 글을 쓰면서 직접 돌린 것입니다.

5편에서 만든 것은 "지금 할 수 있는 행동 목록과 그 점수"였습니다.
하지만 목록이 있다고 팀이 움직이지는 않습니다.
누군가 "A로 간다"를 불러야 하고, 다섯 명이 각자 그 안에서 자기 역할을 골라야 하고, 들어가는 타이밍을 맞춰야 합니다.
그리고 라운드가 끝나면 돈을 계산하고, 12라운드가 지나면 공수를 바꾸고, 13승이 나올 때까지 반복해야 합니다.

이번 편은 그 부분, 팀 엔진과 경기 진행기 이야기입니다.
그리고 이 글을 쓰다가 발견한 꽤 큰 구멍 하나에 대한 이야기입니다.

## 한눈에 보기

- 팀 엔진은 IGL(전략 호출) → 역할 배정 → 선수별 행동 선택 → 팀워크(타이밍) → 몇 가지 "확정(commit)" 규칙 순서로 한 번의 결정을 만듭니다.
- 선수 행동은 5편의 후보 중에서 시드 고정 가중치 추첨으로 고릅니다. 공격성, 규율, 판단력, 팀워크 네 가지 성향이 가중치를 바꿉니다.
- 결과 예측기(Outcome Predictor)는 계산 예산 안에서 상위 6개 후보를 한 수 앞까지 내다봅니다. 다만 **지금은 어떤 패키지에서도 쓰이지 않습니다.**
- 경기 진행기는 피스톨 → 전반 12라운드 → 공수 교대 → 13승 선승, 연장전은 2점 차까지 진행하고, 경제와 궁극기 포인트를 라운드 사이에 넘깁니다. 한 경기에 약 2초가 걸립니다.
- 사용자 요청으로 전술 타임아웃(팀당 2회)과 코치 지시가 들어갔습니다. 지시 없이 돌리면 일반 경기와 바이트 단위로 같은 결과가 나옵니다.
- **직접 실험해 보니 전략 지시(A 진입, B 진입, 미드 장악)는 경기 결과를 전혀 바꾸지 못했습니다.** 10경기 204라운드에서 스파이크는 한 번도 빠짐없이 B에만 설치됐습니다.

## 한 번의 팀 결정

라운드 시뮬레이터(7편)는 500ms마다 팀 정책에게 묻습니다.
"지금 이렇게 보이는데, 뭘 할래?"
팀 정책(`TeamDecisionPolicy`)이 답을 만드는 과정은 이렇습니다.

```ts
// packages/team-engine/src/policy.ts (decideWithTrace 발췌)
    const generation = this.candidates(view);
    const opening = selectStrategy(view, this.spatial, rng);
    const recon = reconsider(view, this.spatial, opening, rng);
    // A coach order (timeout) forces the strategy, overriding the IGL's own call. Draws from the
    // same RNG first so order-vs-no-order stays deterministic for every other decision.
    const ordered = this.order?.strategy;
    const strategy = ordered ?? recon.strategy;
    const roles = this.applyRoleOrder(assignRoles(view, strategy, this.options.profiles, rng));
    ...
      const choice = choosePlayerCommand(String(p.id), role, strategy, generation.feasible, profile, rng);
    ...
    let commands = this.commitAttackUtil(view, strategy, applyTeamwork(choices.map((c) => c.entry)));
    commands = this.commitSpikeCarrier(view, strategy, commands);
    commands = this.commitPostPlantContest(view, commands);
    commands = this.commitDefenseHold(view, strategy, commands);
    commands = this.commitDefuser(view, commands);
```

1. **후보 생성**: 5편의 행동 후보 생성기를 그대로 씁니다. 이때 팀 정책은 관측을 바탕으로 "우리 팀만 들어 있는" 가상의 세계를 다시 만들어 넘깁니다. 적의 실제 위치는 여기에도 없습니다.
2. **IGL 전략 선택**과 **재고려**.
3. 코치 지시가 있으면 IGL의 선택을 덮어씁니다.
4. **역할 배정**.
5. **선수별 행동 선택**.
6. **팀워크**: 진입 타이밍 조정.
7. 다섯 개의 **확정 규칙**. 이건 대부분 11편의 보정 과정에서 추가된 것입니다.

### IGL: 어디로 갈지 부르기

IGL은 먼저 "적이 어느 사이트 쪽에 있다고 믿는가"를 계산합니다.
본 적은 그 사이트에 1점씩, 믿음 속 가설은 가중치의 절반씩 더합니다.
사이트 구분은 구역 이름 앞글자(`a-`, `b-`)로 합니다.

```ts
// packages/team-engine/src/igl.ts
export function selectStrategy(view: PolicyView, spatial: SpatialQuery, rng: RandomSource): TeamStrategy {
  const planted = view.spike.phase === "planted";
  const bias = enemySiteBias(view, spatial);

  if (view.side === "defense") {
    if (planted) return "retake";
    if (isEco(view)) return "defaultHold";
    // Lean toward the site the enemy is showing; otherwise hold or push.
    if (bias.A > bias.B + 0.5) return "stackA";
    if (bias.B > bias.A + 0.5) return "stackB";
    return weightedPick(rng, [["defaultHold", 2], ["aggroPush", 1]] as const);
  }

  // Attack
  if (isEco(view)) return "default"; // conservative: gather info, play for picks
  // Full buy: commit. Prefer the LESS defended site; fake the more defended one.
  const aWeight = 1 + Math.max(0, bias.B - bias.A); // A looks safer when enemies lean B
  const bWeight = 1 + Math.max(0, bias.A - bias.B);
  return weightedPick(rng, [
    ["aExecute", aWeight],
    ["bExecute", bWeight],
    ["midControl", 0.8],
    ["fakeAtoB", bias.A > bias.B ? 0.9 : 0.3],
    ["fakeBtoA", bias.B > bias.A ? 0.9 : 0.3],
  ] as const);
}
```

수비는 설치됐으면 리테이크, 돈이 없으면 기본 수비, 적이 한쪽으로 쏠려 보이면 그쪽을 두껍게, 아니면 2:1 비율로 기본 수비와 공격적 전진 중에서 고릅니다.
공격은 돈이 없으면(잔고 2,000 이하) 정보 수집 위주의 기본 운영, 돈이 있으면 **덜 지켜지는 사이트**로 가중치를 더 줘서 추첨합니다.
적이 A에 쏠려 보이면 B 진입의 가중치가 오르고, A로 페이크를 줬다가 B로 가는 전략의 가중치도 오릅니다.

재고려(`reconsider`)는 라운드 중에 결정적인 정보가 들어오면 호출을 바꿉니다.
적이 한쪽으로 1명 이상 확실히 쏠려 보일 때입니다.

### 역할과 선수 성향

역할은 선수의 공격성 순서로 나눕니다.
공격은 진입(entry), 지원(support), 로테이터, 러커.
수비는 앵커와 로테이터입니다.

선수마다 성향 네 가지(0~1)가 있습니다.

| 성향 | 의미 |
| --- | --- |
| `aggression` | 피킹과 이동을 좋아하는 정도 |
| `discipline` | 팀 전략을 지키는 정도 |
| `decisionMaking` | 위험한 행동을 피하는 정도 |
| `teamwork` | 동료와 타이밍을 맞추는 정도 |

선수는 5편의 후보 중 자기 개인 행동들만 놓고 가중치 추첨을 합니다.

```text
기본 가중치 = max(0.01, 효용 + 0.3) × (1 − 위험도 × (1 − 판단력))
피킹, 이동  × (0.6 + 공격성)
홀드        × max(0.1, 1.4 − 공격성)
스킬        × 0.25   ("과하게 스킬을 쓰면 교전에서 진다")
진입 역할의 이동·피킹 × 1.6, 앵커의 홀드 × 1.6, 러커의 이동 × 1.3
```

가장 점수 높은 행동을 그냥 고르지 않고 추첨하는 이유는 다양성입니다.
같은 상황에서 열 명이 모두 같은 행동을 하면 경기가 기계처럼 보입니다.
시드가 고정되어 있으니 추첨이어도 재현은 됩니다.

판단력 항은 처음 읽었을 때 저도 헷갈렸습니다.
`(1 − 위험도 × (1 − 판단력))`에서 판단력이 0이면 위험도만큼 가중치가 그대로 깎이고, 판단력이 1이면 위험도와 상관없이 1이 됩니다.
즉 식을 그대로 읽으면 판단력이 높을수록 위험한 행동이 **덜** 깎입니다.
"판단력이 좋은 선수는 위험한 행동도 해낼 수 있다"는 뜻으로 의도한 것인지, 부호를 거꾸로 쓴 것인지는 문서에 없습니다.
다만 지금은 3편에서 말한 대로 실제 선수 데이터가 팀 정책의 성향 값에 연결되어 있지 않아서, 모든 선수가 중립 성향(전부 0.5)으로 뜁니다.
실제 능력치(조준, 반응 등)는 교전 엔진에만 들어갑니다.
그래서 이 식이 결과에 주는 영향은 아직 작습니다.

### 팀워크: 같이 들어가기

```ts
// packages/team-engine/src/teamwork.ts
export function applyTeamwork(entries: readonly TeamworkEntry[]): ActionCommand[] {
  const entry = entries.find((e) => e.role === "entry");
  const entryZone = entry?.command.targetZone;

  return entries.map((e) => {
    const tighten = Math.max(0.3, 1.5 - e.profile.teamwork); // better teamwork → tighter timing
    const cmd = e.command;
    if (cmd.kind === "useAbility") {
      return { ...cmd, executeAtMs: 0 };
    }
    if (e.role === "entry") {
      return { ...cmd, executeAtMs: Math.round(ABILITY_LEAD_MS * tighten) };
    }
    if (e.role === "support" && cmd.kind === "move" && entryZone) {
      // Trade: follow the entry to the same zone, slightly behind.
      return { ...cmd, targetZone: entryZone, executeAtMs: Math.round(SUPPORT_TRAIL_MS * tighten) };
    }
    return { ...cmd, executeAtMs: Math.round(DEFAULT_OFFSET_MS * tighten) };
  });
}
```

스킬이 먼저(0ms), 진입이 그 뒤(800ms × 조임 계수), 지원은 진입이 간 구역을 1,200ms 뒤에 따라갑니다.
지원이 진입을 따라가는 건 트레이드를 위해서입니다.
진입이 죽으면 바로 뒤에서 그 적을 잡는 것이죠.
팀워크가 좋을수록 조임 계수가 작아져서 간격이 짧아집니다.

## 결과 예측기: 한 수 앞

마스터 프롬프트 25.2절은 "모든 미래를 탐색하지 말고, 예산 안에서 제한적으로 내다보라"고 요구합니다.
결과 예측기가 그 일을 합니다(`packages/outcome-predictor/src/predict.ts`).

1. 가능한 후보를 정적 효용으로 정렬해 상위 6개를 고릅니다.
2. 각 후보의 목표 구역에 믿음상 적이 있는지 봅니다.
3. 적이 없으면 `정적 효용 + 0.4 × 경제 가치`.
4. 적이 있으면 계산 노드 하나를 씁니다. 교전 엔진에 승률을 묻고, `정적 효용 + 0.6 × (승률 − 0.5) + 0.4 × 경제 가치`로 고칩니다. 적은 Vandal을 들고 엄폐 중이라고 가정합니다.
5. 노드 예산을 다 쓰면 정적 효용으로 돌아가고, "compute budget exceeded — heuristic fallback (§25.2)"이라는 꼬리표를 붙입니다.

깊이는 1, 즉 한 수 앞까지입니다.
테스트는 6개입니다. 예산 안에서 내다보기, 예산 초과 시 대체, 상위 K개 제한, 결정성, 경제 반영, 좋은 무기 선호.

그런데 저장소 전체를 검색해 보면 `@pv/outcome-predictor`를 import하는 곳이 없습니다.
만들어지고 테스트됐지만 팀 정책에도, 경기 진행기에도 연결되지 않았습니다.
4편의 경제 엔진과 같은 상황입니다.

## 한 경기를 굴리는 법

경기 진행기(`@pv/match-runner`)는 통합 직후인 15:00에 생긴 패키지입니다.
라운드 엔진은 PV-4가, 팀 정책은 PV-3가, 경제는 PV-2가 만들었으니, 이걸 엮어 24라운드짜리 한 경기로 만드는 접착제입니다.

한 라운드마다 이런 순서로 돕니다.

1. 13라운드면 전반 초기화: 모두 800크레딧, 연패 초기화, 궁극기 포인트는 유지. 연장전은 라운드마다 5,000크레딧(임시값).
2. 공격 팀 결정: A 팀이 1~12라운드, B 팀이 13~24라운드, 연장은 번갈아.
3. 팀 단위 구매(4편에서 본 단순 규칙). 코치의 경제 지시가 있으면 그걸 따릅니다.
4. 코치 지시를 양 팀 정책에 넣습니다.
5. 라운드 실행. 시드는 `deriveSeed(경기 시드, "${matchId}:round:${n}")`로 라운드마다 파생합니다.
6. 지시를 지웁니다. 주석은 "다음 라운드로 새지 않게"라고 말합니다.
7. 크레딧 정산(경제 엔진), 궁극기 포인트 += 킬 + 설치.
8. 라운드 기록과 리플레이 저장.

```ts
// packages/match-runner/src/match.ts
export function attackerFor(roundNumber: number): TeamSlot {
  if (roundNumber <= ROUNDS_PER_HALF) return "A";
  if (roundNumber <= REGULATION_ROUNDS) return "B";
  // OT: round 25 → A, 26 → B, 27 → A, ...
  return (roundNumber - REGULATION_ROUNDS) % 2 === 1 ? "A" : "B";
}
```

승리 조건은 "13라운드 이상 이기고 2점 이상 앞설 것"입니다.
이 한 줄로 정규 시간(13대11)과 연장(15대13)이 함께 처리됩니다.
안전장치로 최대 60라운드 제한이 있습니다.

라운드마다 시드를 파생하는 방식에는 의미가 있습니다.
5라운드의 시드는 1~4라운드에서 무슨 일이 있었든 같습니다.
그래서 4라운드의 행동을 바꾸는 수정을 하더라도, 5라운드의 난수열 자체는 그대로입니다.
5편의 스트림 분리를 라운드 단위로도 적용한 셈입니다.

### 스킬은 기본으로 꺼져 있다

경기 설정에 `enableAbilities` 옵션이 있고, 기본값은 `false`입니다.
주석에는 이유가 적혀 있습니다.
공격 측 유틸 조율이 들어가기 전에 스킬을 켜면 "수비가 압도적이 된다(공격 승률 약 0.02)".
1편의 경기 로그가 연막도 섬광도 없는 총싸움이었던 이유입니다.
스킬을 켰을 때의 이야기는 11편에 있습니다.

## 전술 타임아웃과 코치 지시

통합 다음 날 새벽, 제가 두 가지를 요청했습니다.
한국어 UI(9편), 그리고 "타임아웃(상대 포함 총 4번) 때 지시"입니다.
매니저 게임에서 감독이 경기에 개입하는 가장 자연스러운 순간이 타임아웃이기 때문입니다.

결과물은 `createMatchSession`입니다.

```ts
const s = createMatchSession(config, { aiTeams: ["B"] });
while (!s.isFinished()) {
  if (/* 3연패 했다면 */) {
    s.callTimeout("A");
    s.setOrders("A", { strategy: "bExecute", economy: "force", durationRounds: 2 });
  }
  s.playNextRound();
}
const result = s.result(); // result.timeoutLog 에 타임아웃 기록
```

- 팀당 2회(합계 4회), 라운드 사이 구매 전에만 부를 수 있습니다.
- 지시는 전략(공격: A 진입, B 진입, 미드 장악, 기본, 스플릿 / 수비: 기본 수비, A 스택, B 스택, 전진), 경제(세이브, 포스, 풀), 템포, 역할 지정(진입, 러커), 지속 라운드 수로 이루어집니다.
- 타임아웃 없이 지시를 내리거나, 남은 타임아웃이 없는데 부르면 예외가 납니다.
- AI 팀도 타임아웃을 부릅니다. 3연패를 하거나 상대가 매치 포인트(12점)에 오르면, 돈이 2,000 미만이면 세이브, 아니면 포스를 지시하고 공격이면 기본 운영, 수비면 전진을 부릅니다. 난수를 쓰지 않는 결정적 규칙입니다.

테스트 6개 중 가장 마음에 드는 것은 첫 번째입니다.
**타임아웃도 지시도 없이 세션으로 돌린 경기가, 일반 `runMatch`와 바이트 단위로 같은 결과를 내야 한다.**
라운드별 승자와 종료 사유를 SHA-256으로 해시해서 비교합니다.
대화형 기능을 덧붙였지만 아무것도 안 하면 아무것도 바뀌지 않는다는 보증입니다.

## 실험: 지시는 정말 경기를 바꾸는가

여기까지 쓰고 나서, 직접 확인해 보고 싶어졌습니다.
1편의 그 경기(Team Heretics 대 NRG, 시드 42)에서 Team Heretics는 1~3라운드를 내리 집니다.
4라운드 직전에 타임아웃을 부르고 지시를 내리면 무엇이 달라질까요?

작은 스크립트를 짰습니다.
지시를 여섯 가지로 바꿔 가며 같은 경기를 돌리고, 결과 전체의 해시와 4~6라운드에 스파이크가 설치된 사이트를 찍었습니다.
시드 7 경기도 같이 돌렸습니다.

```text
seed 지시                                  점수   R4-6 설치     결과 해시
42   없음                                  10-13  B, B, B       efd292a681
42   A 진입 (3라운드)                      10-13  B, B, B       efd292a681
42   B 진입 (3라운드)                      10-13  B, B, B       efd292a681
42   미드 장악 (3라운드)                   10-13  B, B, B       efd292a681
42   세이브                                 9-13  -, B, B       2877620083
42   진입 역할을 atk5로 (3라운드)           9-13  B, B, B       2c234d5de7
7    없음                                  13-4   B, B, B       5f46cc90e2
7    A 진입 (3라운드)                      13-4   B, B, B       5f46cc90e2
7    B 진입 (3라운드)                      13-4   B, B, B       5f46cc90e2
7    미드 장악 (3라운드)                   13-4   B, B, B       5f46cc90e2
7    세이브                                13-4   -, B, B       25d77d6ec1
7    진입 역할을 atk5로 (3라운드)          13-4   B, B, B       5f46cc90e2
```

경제 지시(세이브)와 역할 지시는 경기를 바꿉니다.
세이브를 지시하면 4라운드에 실제로 에코를 하고 설치도 못 하고, 최종 점수가 9대13으로 바뀝니다.

그런데 **전략 지시 셋은 결과가 지시 없음과 해시까지 똑같습니다.**
"A로 가라"고 해도 스파이크는 B에 설치됩니다.

혹시 이 경기만 그런가 싶어서 시드 1~10, 10경기 204라운드의 설치 위치를 전부 셌습니다.

```text
{ none: 53, 'b-site': 151 }
```

설치가 있었던 151라운드가 **전부 B 사이트**입니다.
A 사이트에는 한 번도 설치되지 않았습니다.

### 원인

코드를 따라가니 원인은 확정 규칙 중 하나, `commitSpikeCarrier`였습니다.

```ts
// packages/team-engine/src/policy.ts
    const carrierZone = this.spatial.nearestZone({ x: carrier.position.x, y: carrier.position.y });
    let command: ActionCommand;
    if (this.spatial.isPlantableZone(carrierZone)) {
      command = { playerId: carrier.id, kind: "plant", targetZone: carrierZone, ... };
    } else {
      const site = this.nearestPlantableSite(carrierZone);
      ...
      command = { playerId: carrier.id, kind: "move", targetZone: site, moveMode: "run", ... };
    }
```

스파이크 소지자는 전략과 상관없이 **가장 가까운 설치 가능 사이트로 달려갑니다.**
Ascent 공격 스폰에서 달리기 시간으로 가장 가까운 사이트가 B라서, 스파이크는 항상 B로 갑니다.
IGL이 A 진입을 부르면 나머지 네 명은 A 쪽으로 움직이겠지만, 스파이크는 혼자 B로 가서 설치됩니다.
그리고 이번 실험에서는 그 결과 경기 전체가 지시 없음과 똑같이 흘러갔습니다.

이 규칙은 11편에서 다룰 "시간 초과 87%" 문제를 고친 수정입니다.
원래는 팀 정책이 500ms마다 모든 명령을 다시 뽑아서 4초짜리 설치가 계속 끊겼는데, 스파이크 소지자만큼은 설치를 끝까지 하도록 고정한 것입니다.
그 수정 덕분에 시간 초과는 61.8%에서 0%가 됐습니다.
다만 고정할 때 "어느 사이트로"를 전략에서 읽지 않고 "가장 가까운 곳"으로 정했고, 그 부작용으로 IGL의 사이트 선택과 코치의 전략 지시가 스파이크에 닿지 않게 됐습니다.

이 사실은 저장소의 어떤 문서에도 적혀 있지 않았습니다.
판정 지표(라운드 종료 사유, 공격 승률, 오프닝 듀얼, 구매 매치업)에는 "어느 사이트에 설치했나"가 없기 때문입니다.
채점표에 없는 것은 망가져도 보이지 않습니다.

그 밖에 확인한 것들도 적어 둡니다.

- 지시의 `tempo`(느리게, 보통, 빠르게)는 팀 엔진 어디에서도 읽지 않습니다. 받기만 하고 효과가 없습니다.
- 경기 진행기는 상대에 대한 기억(`OpponentMemory`: 피스톨 승패, 승패 수)을 쌓지만, 코드 주석대로 아직 아무도 이걸 쓰지 않습니다. 1편 경기 로그 끝에 찍힌 "Opponent memory (IGL)"가 그것입니다.

고치는 방법 자체는 어렵지 않아 보입니다.
스파이크 소지자를 고정할 때, 전략이 A나 B 진입이면 그 사이트를, 페이크면 페이크의 최종 목표 사이트를 고르면 됩니다.
다만 그렇게 고치면 판정 지표 4/8이 어떻게 움직일지는 돌려 봐야 압니다.
이건 이 연재의 범위를 넘어서 다음 작업으로 남겨 둡니다.

## 테스트

글을 쓰는 시점에 루트에서 테스트를 돌리면 14개 파일, 133개 통과, 4개 todo입니다(약 3초).
경기 진행기는 따로 돌리고, 19개 통과입니다(경기 13, 세션 6, 약 22초).
통합 E2E 테스트는 같은 시나리오를 대본 정책과 팀 정책으로 각각 20라운드 돌려서 둘 다 라운드가 정상적으로 끝나는지 봅니다.

```text
[E2E scripted] attackWin=13/20 {"elimination":17,"spikeDefused":3}
[E2E team]     attackWin=12/20 {"spikeDefused":4,"elimination":13,"spikeDetonation":3}
```

이 테스트들은 모두 통과합니다.
그리고 위의 "전략 지시가 효과 없음"도 이 테스트들 사이로 빠져나갔습니다.
지시를 내릴 수 있는지, 지시가 기록되는지, 지시 없을 때 결과가 같은지는 테스트했지만, **지시했을 때 결과가 달라지는지**를 확인하는 테스트는 세이브 지시 하나뿐이었습니다.

## 정리

팀 엔진의 구조는 마스터 프롬프트 24장의 "코치 → IGL → 분대 → 개인"을 거의 그대로 따랐습니다.
그리고 경기 진행기 덕분에 그 구조가 실제로 24라운드를 끝까지 굴러갑니다.

하지만 이번 편에서 가장 중요한 교훈은 마지막 실험입니다.
지표 하나(시간 초과)를 고치는 수정이, 지표에 잡히지 않는 다른 기능(사이트 선택, 코치 지시)을 조용히 무력화했습니다.
AI 세션 여섯이 숫자를 보면서 빠르게 고쳐 나가는 구조에서는, 숫자에 없는 것을 사람이 직접 확인하는 단계가 따로 필요하다는 것을 배웠습니다.
12편의 회고에서 이 이야기를 다시 하겠습니다.

다음 편은 이 모든 판단이 실제로 벌어지는 무대, 공간·지각·교전 엔진입니다.

## 참고 자료

- [packages/team-engine](https://github.com/2rangs/Project-VM/tree/main/packages/team-engine)
- [packages/outcome-predictor](https://github.com/2rangs/Project-VM/tree/main/packages/outcome-predictor)
- [packages/match-runner](https://github.com/2rangs/Project-VM/tree/main/packages/match-runner)
- [docs/handoffs/PV-3-core.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-3-core.md)
- [docs/DECISION_MODEL.md](https://github.com/2rangs/Project-VM/blob/main/docs/DECISION_MODEL.md)
