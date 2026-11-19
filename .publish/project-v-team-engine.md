
> **참고** 이 글은 "PROJECT V 개발기" 연재의 6편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `packages/team-engine`, `outcome-predictor`, `match-runner`의 코드와 테스트를 근거로 썼습니다. "남은 과제"의 실험 결과는 이 글을 쓰면서 직접 돌린 것입니다.

5편에서 만든 것은 "지금 할 수 있는 행동 목록과 점수"였습니다.
목록만으로는 팀이 움직이지 않습니다.
누군가 "A로 간다"를 정하고, 다섯 명이 그 안에서 각자 역할을 고르고, 진입 타이밍을 맞춰야 합니다.
라운드가 끝나면 크레딧을 계산하고, 12라운드가 지나면 공수를 바꾸고, 13승이 나올 때까지 반복해야 합니다.

이번 편에서는 이 부분을 맡은 팀 엔진과 경기 진행기, 그리고 코치가 개입하는 전술 타임아웃을 소개합니다.

## 한눈에 보기

- 팀 엔진은 IGL 전략 선택 → 역할 배정 → 선수별 행동 선택 → 팀워크(타이밍) → 확정(commit) 규칙 순서로 한 번의 결정을 만듭니다.
- 선수 행동은 5편의 후보 중에서 시드 고정 가중치 추첨으로 고릅니다. 공격성, 규율, 판단력, 팀워크 네 가지 성향이 가중치에 영향을 줍니다.
- 결과 예측기(Outcome Predictor)는 계산 예산 안에서 상위 6개 후보를 한 수 앞까지 내다봅니다.
- 경기 진행기는 피스톨 → 전반 12라운드 → 공수 교대 → 13승 선승, 연장전은 2점 차까지 진행하며 경제와 궁극기 포인트를 라운드 사이에 넘깁니다. 한 경기에 약 2초가 걸립니다.
- 전술 타임아웃(팀당 2회)과 코치 지시를 지원합니다. 지시 없이 돌리면 일반 경기와 결과가 바이트 단위로 같습니다.

## 한 번의 팀 결정

라운드 시뮬레이터(7편)는 500ms마다 팀 정책에 "지금 상황이 이런데 무엇을 할지" 묻습니다.
팀 정책(`TeamDecisionPolicy`)은 다음 순서로 답을 만듭니다.

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

1. **후보 생성**: 5편의 행동 후보 생성기를 그대로 씁니다. 팀 정책은 관측을 바탕으로 우리 팀 정보만 담은 가상의 세계를 만들어 넘기므로, 여기에도 적의 실제 위치는 없습니다.
2. **IGL 전략 선택**과 **재고려**.
3. 코치 지시가 있으면 IGL의 선택 대신 지시를 따릅니다.
4. **역할 배정**.
5. **선수별 행동 선택**.
6. **팀워크**: 진입 타이밍을 맞춥니다.
7. 다섯 가지 **확정 규칙**. 대부분 11편의 보정 과정에서 추가했습니다.

### IGL: 어디로 갈지 정하기

IGL은 먼저 적이 어느 사이트 쪽에 있는지를 계산합니다.
직접 본 적은 해당 사이트에 1점씩, 믿음 속 추정은 가중치의 절반씩 더합니다.
사이트는 구역 이름 앞글자(`a-`, `b-`)로 구분합니다.

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

수비는 스파이크가 설치됐으면 리테이크, 돈이 없으면 기본 수비, 적이 한쪽에 몰려 보이면 그쪽 보강, 그 밖에는 기본 수비와 전진을 2:1 비율로 추첨합니다.
공격은 돈이 없으면(잔고 2,000 이하) 정보 수집 위주의 기본 운영을 하고, 돈이 있으면 **수비가 적은 사이트**에 가중치를 더 줘서 추첨합니다.
적이 A에 몰려 보이면 B 진입과 "A 페이크 후 B" 전략의 가중치가 올라갑니다.

재고려(`reconsider`)는 라운드 중에 적이 한쪽으로 1명 이상 확실히 몰려 보이는 등 중요한 정보가 들어오면 전략을 바꿉니다.

### 역할과 선수 성향

역할은 선수의 공격성 순서로 나눕니다.
공격은 진입(entry), 지원(support), 로테이터, 러커이고, 수비는 앵커와 로테이터입니다.

선수마다 0~1 사이의 성향 네 가지가 있습니다.

| 성향 | 의미 |
| --- | --- |
| `aggression` | 피킹과 이동을 선호하는 정도 |
| `discipline` | 팀 전략을 따르는 정도 |
| `decisionMaking` | 위험한 행동을 피하는 정도 |
| `teamwork` | 동료와 타이밍을 맞추는 정도 |

선수는 5편의 후보 중 자기 개인 행동만 놓고 가중치 추첨을 합니다.

```text
기본 가중치 = max(0.01, 효용 + 0.3) × (1 − 위험도 × (1 − 판단력))
피킹, 이동  × (0.6 + 공격성)
홀드        × max(0.1, 1.4 − 공격성)
스킬        × 0.25   ("과하게 스킬을 쓰면 교전에서 진다")
진입 역할의 이동·피킹 × 1.6, 앵커의 홀드 × 1.6, 러커의 이동 × 1.3
```

점수가 가장 높은 행동을 바로 고르지 않고 추첨하는 이유는 다양성입니다.
같은 상황에서 열 명이 모두 같은 행동을 하면 경기가 기계적으로 보입니다.
시드가 고정되어 있어서 추첨이어도 결과는 재현됩니다.

현재는 3편에서 설명한 대로 실제 선수 데이터를 성향 값에 연결하지 않아서 모든 선수가 중립 성향(전부 0.5)으로 뛰고, 조준이나 반응 같은 실제 능력치는 교전 엔진에서만 씁니다.

### 팀워크: 함께 진입하기

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

스킬이 먼저(0ms), 진입이 그다음(800ms × 조임 계수)이고, 지원은 진입이 향한 구역을 1,200ms 뒤에 따라갑니다.
지원이 진입을 따라가는 이유는 트레이드입니다.
진입이 쓰러지면 바로 뒤에서 그 적을 잡습니다.
팀워크가 좋을수록 조임 계수가 작아져 간격이 짧아집니다.

### 확정 규칙: 스파이크 설치를 끝까지

팀 정책은 500ms마다 명령을 새로 뽑습니다.
그대로 두면 4초가 걸리는 설치가 중간에 계속 끊기기 때문에, `commitSpikeCarrier`는 스파이크 소지자의 명령을 고정합니다.

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

설치 가능 구역에 있으면 설치하고, 아니면 가장 가까운 설치 가능 사이트로 달려갑니다.
11편에서 다룰 시간 초과 문제를 해결한 수정으로, 이 규칙을 넣은 뒤 시간 초과 비율이 61.8%에서 0%가 됐습니다.

## 결과 예측기: 한 수 앞 내다보기

마스터 프롬프트 25.2절은 "모든 미래를 탐색하지 말고, 예산 안에서 제한적으로 내다보라"고 요구합니다.
결과 예측기가 이 역할을 합니다(`packages/outcome-predictor/src/predict.ts`).

1. 가능한 후보를 정적 효용으로 정렬해 상위 6개를 고릅니다.
2. 각 후보의 목표 구역에 적이 있다고 보는지 확인합니다.
3. 적이 없으면 `정적 효용 + 0.4 × 경제 가치`입니다.
4. 적이 있으면 계산 노드 하나를 써서 교전 엔진에 승률을 묻고, `정적 효용 + 0.6 × (승률 − 0.5) + 0.4 × 경제 가치`로 고칩니다. 적은 Vandal을 들고 엄폐 중이라고 가정합니다.
5. 노드 예산을 다 쓰면 정적 효용을 그대로 쓰고 "compute budget exceeded — heuristic fallback (§25.2)" 표시를 붙입니다.

탐색 깊이는 1, 즉 한 수 앞까지입니다.
테스트는 예산 안에서 내다보기, 예산 초과 시 대체, 상위 K개 제한, 결정성, 경제 반영, 좋은 무기 선호까지 6개입니다.

## 한 경기를 진행하는 방법

경기 진행기(`@pv/match-runner`)는 통합 직후인 15:00에 만든 패키지입니다.
PV-4의 라운드 엔진, PV-3의 팀 정책, PV-2의 경제 엔진을 묶어 24라운드 경기로 만듭니다.

라운드마다 다음 순서로 진행합니다.

1. 13라운드에는 전반 초기화를 합니다. 모두 800크레딧으로 시작하고 연패 수는 초기화하며, 궁극기 포인트는 유지합니다. 연장전은 라운드마다 5,000크레딧(임시값)입니다.
2. 공격 팀을 정합니다. A 팀이 1~12라운드, B 팀이 13~24라운드, 연장은 번갈아 공격합니다.
3. 팀 단위로 구매합니다(4편의 간단한 규칙). 코치의 경제 지시가 있으면 그대로 따릅니다.
4. 코치 지시를 양 팀 정책에 전달합니다.
5. 라운드를 실행합니다. 시드는 `deriveSeed(경기 시드, "${matchId}:round:${n}")`로 라운드마다 파생합니다.
6. 지시를 지웁니다. 주석에 따르면 다음 라운드로 넘어가지 않게 하기 위해서입니다.
7. 크레딧을 정산하고(경제 엔진), 궁극기 포인트에 킬과 설치 수를 더합니다.
8. 라운드 기록과 리플레이를 저장합니다.

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
이 조건 하나로 정규 시간(13대11)과 연장(15대13)을 모두 처리합니다.
안전장치로 최대 60라운드 제한을 두었습니다.

라운드마다 시드를 따로 파생하므로, 5라운드의 시드는 1~4라운드에서 무슨 일이 있었든 같습니다.
4라운드 행동을 바꾸는 수정을 해도 5라운드의 난수열은 그대로입니다.
5편의 스트림 분리를 라운드 단위에도 적용했습니다.

### 스킬은 기본으로 꺼져 있습니다

경기 설정의 `enableAbilities` 옵션은 기본값이 `false`입니다.
주석에 따르면 공격 측 유틸 조율이 들어가기 전에 스킬을 켜면 수비가 지나치게 유리해집니다(공격 승률 약 0.02).
1편의 경기 로그에 연막이나 섬광 없이 총싸움만 나온 이유이고, 스킬을 켠 뒤의 이야기는 11편에서 다룹니다.

## 전술 타임아웃과 코치 지시

통합 다음 날 새벽에 두 가지 기능을 요청했습니다.
하나는 한국어 UI(9편), 다른 하나는 "타임아웃(상대 포함 총 4번) 때 지시"입니다.
매니저 게임에서 감독이 경기에 개입하기 가장 자연스러운 시점이 타임아웃이기 때문입니다.

그 결과물이 `createMatchSession`입니다.

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

- 팀당 2회(합계 4회)이고, 라운드 사이 구매 전에만 부를 수 있습니다.
- 지시는 전략(공격: A 진입, B 진입, 미드 장악, 기본, 스플릿 / 수비: 기본 수비, A 스택, B 스택, 전진), 경제(세이브, 포스, 풀), 템포, 역할 지정(진입, 러커), 지속 라운드 수로 구성됩니다.
- 타임아웃 없이 지시를 내리거나 남은 타임아웃이 없을 때 부르면 예외가 발생합니다.
- AI 팀도 타임아웃을 부릅니다. 3연패를 하거나 상대가 매치 포인트(12점)에 오르면, 돈이 2,000 미만이면 세이브, 아니면 포스를 지시하고, 공격이면 기본 운영, 수비면 전진을 지시합니다. 난수를 쓰지 않는 결정적 규칙입니다.

테스트 6개 중 가장 중요한 것은 첫 번째입니다.
**타임아웃과 지시 없이 세션으로 돌린 경기는 일반 `runMatch`와 바이트 단위로 같은 결과를 내야 합니다.**
라운드별 승자와 종료 사유를 SHA-256으로 해시해서 비교합니다.
대화형 기능을 추가했지만, 쓰지 않으면 기존 결과가 그대로 유지된다는 것을 보장합니다.

## 테스트

글을 쓰는 시점에 루트에서 테스트를 돌리면 14개 파일에서 133개 통과, 4개 todo입니다(약 3초).
경기 진행기는 따로 돌리며 19개가 통과합니다(경기 13, 세션 6, 약 22초).
통합 E2E 테스트는 같은 시나리오를 대본 정책과 팀 정책으로 각각 20라운드씩 돌려서, 두 경우 모두 라운드가 정상적으로 끝나는지 확인합니다.

```text
[E2E scripted] attackWin=13/20 {"elimination":17,"spikeDefused":3}
[E2E team]     attackWin=12/20 {"spikeDefused":4,"elimination":13,"spikeDetonation":3}
```

## 남은 과제

**전략 지시와 설치 사이트 연결.** 스파이크 소지자는 확정 규칙에 따라 항상 가장 가까운 사이트로 가고, Ascent 공격 스폰에서는 B가 가장 가깝습니다.
그래서 현재는 IGL의 사이트 선택이나 코치의 전략 지시(A 진입, B 진입, 미드 장악)가 설치 위치를 바꾸지 않습니다. 경제 지시와 역할 지시는 결과에 반영됩니다.
시드 42와 7 경기에서 4라운드 직전에 지시를 바꿔 돌린 결과는 다음과 같습니다.

| 지시 | 시드 42 점수 | 시드 7 점수 | R4~6 설치 |
| --- | --- | --- | --- |
| 없음 | 10-13 | 13-4 | B, B, B |
| A 진입 / B 진입 / 미드 장악 | 10-13 (변화 없음) | 13-4 (변화 없음) | B, B, B |
| 세이브 | 9-13 | 13-4 (라운드 결과 변화) | -, B, B |
| 진입 역할을 atk5로 | 9-13 | 13-4 (변화 없음) | B, B, B |

시드 1~10, 204라운드로 넓혀 봐도 설치가 있었던 151라운드는 모두 B 사이트였습니다.
수정 방향은 스파이크 소지자를 고정할 때 전략이 A나 B 진입이면 그 사이트를, 페이크면 페이크의 최종 목표 사이트를 고르게 하는 것입니다.
수정 후 판정 지표가 어떻게 움직이는지 확인하고, 지시에 따라 결과가 달라지는지 보는 테스트도 보강할 예정입니다.

그 밖에 이어서 할 작업입니다.

- 지시의 `tempo`(느리게, 보통, 빠르게)는 아직 팀 엔진에 반영하지 않습니다.
- 경기 진행기가 쌓는 상대 기억(`OpponentMemory`: 피스톨 승패, 승패 수)을 IGL 판단에 쓰는 것은 다음 단계입니다. 1편 경기 로그 끝의 "Opponent memory (IGL)"가 이 데이터입니다.
- 결과 예측기는 패키지와 테스트까지 완성된 상태이고, 팀 정책과 경기 진행기에 연결하는 작업이 남아 있습니다.
- 선수 데이터를 성향 값에 연결합니다.

## 정리

팀 엔진의 구조는 마스터 프롬프트 24장의 "코치 → IGL → 분대 → 개인"을 거의 그대로 따랐습니다.
경기 진행기가 이 구조를 24라운드 경기로 이어 주고, 타임아웃 세션은 그 위에서 코치가 개입할 수 있게 해 줍니다.

다음 편에서는 이 판단들이 실제로 실행되는 공간·지각·교전 엔진을 다룹니다.

## 참고 자료

- [packages/team-engine](https://github.com/2rangs/Project-VM/tree/main/packages/team-engine)
- [packages/outcome-predictor](https://github.com/2rangs/Project-VM/tree/main/packages/outcome-predictor)
- [packages/match-runner](https://github.com/2rangs/Project-VM/tree/main/packages/match-runner)
- [docs/handoffs/PV-3-core.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-3-core.md)
- [docs/DECISION_MODEL.md](https://github.com/2rangs/Project-VM/blob/main/docs/DECISION_MODEL.md)
