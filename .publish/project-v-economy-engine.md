
> **참고** 이 글은 "PROJECT V 개발기" 연재의 4편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `packages/economy-engine`, `docs/ECONOMY_MODEL.md`, `packages/match-runner/src/economy.ts`를 근거로 썼습니다.

발로란트를 처음 보면 이해하기 어려운 장면이 있습니다.
라운드 막판에 혼자 남은 선수가 적 넷이 지키는 사이트를 포기하고 뒤로 빠집니다.
해설은 "오퍼 살리네요, 좋은 판단입니다"라고 말합니다.

라운드를 포기하는 게 좋은 판단인 이유는 다음 라운드가 있기 때문입니다.
살아남은 선수는 들고 있던 무기를 그대로 가지고 다음 라운드를 시작합니다.
4,700크레딧짜리 오퍼레이터를 살리면 다음 라운드 구매가 그만큼 여유로워집니다.

인수인계 문서의 마지막 결정인 DECISION-011이 이 내용입니다.

> 세이브를 단순한 패배 시 행동으로 처리하지 않는다. 세이브는 현재 라운드, 다음 라운드, 장비 보존, 상대 경제, 궁극기 충전과 연관된 의사결정이다.

이번 편에서는 이 결정을 코드로 옮긴 경제·궁극기 엔진을 소개합니다.

## 한눈에 보기

- `@pv/economy-engine`은 런타임 의존성이 없고 난수나 입출력도 쓰지 않는 결정적 TypeScript 라이브러리입니다. 테스트는 31개입니다.
- 모든 판단 함수는 같은 형태의 선택지(`EconomyOption`)를 돌려줍니다. 이번 라운드 가치, 미래 가치, 크레딧 변화, 궁극기 포인트 변화, 그리고 사람이 읽을 수 있는 설명이 들어 있습니다.
- 세이브는 "승률이 몇 % 이하면 후퇴" 같은 규칙이 아니라 세이브와 교전 두 선택지의 점수를 비교해서 정합니다. 1대4에 오퍼레이터를 들고 있으면 세이브(0.3 대 −0.8), 클래식이면 교전입니다.
- 전반 마지막 라운드, 24라운드, 연장전, 상대의 매치 포인트에서는 무기를 살려도 쓸 곳이 없으므로 미래 가치가 0입니다.
- 적 궁극기가 1포인트 남았을 때 죽지 않는 것의 가치, 도망가는 적을 쫓아가 무기를 빼앗는 가치도 같은 방식으로 계산합니다.
- 경제 상수(로스 보너스 1,900/2,400/2,900 등)에는 모두 `verified: false` 표시가 붙어 있습니다. 출처는 있지만 현재 패치 기준으로 다시 확인하지는 않았다는 뜻입니다.

## 같은 형태의 선택지

마스터 프롬프트 20장은 세이브 가치를 다음과 같은 개념식으로 정리했습니다.

```text
Save Value = 장비 보존 + 다음 라운드 구매 이점 + 미래 승률 + 궁극기 포인트 차단
           − 현재 라운드 기회비용 − 탈출 위험
```

엔진은 이 값을 숫자 하나로 합치지 않고, 선택지마다 같은 항목을 채워서 돌려줍니다.

```ts
// docs/ECONOMY_MODEL.md 의 EconomyOption
{
  action,             // "SAVE_WEAPON", "PLAY_FOR_ROUND", "fullBuy", "EXIT_KILL" ...
  currentRoundValue,  // [-1, 1] 이번 라운드에 대한 가치
  futureValue,        // [-1, 1] 다음 라운드 이후에 대한 가치
  economicDelta,      // 크레딧 기대 변화
  ultDelta,           // 궁극기 포인트 기대 변화
  explanation,        // 사람이 읽는 설명
}
```

항목을 나눠 두면 호출하는 쪽에서 가중치를 다르게 줄 수 있습니다.
공격적인 IGL은 이번 라운드 가치를, 신중한 IGL은 미래 가치를 더 무겁게 볼 수 있습니다.
`explanation`이 있으니 의사결정 디버거(5편)에서 "왜 후퇴했는지"를 문장으로 보여 줄 수도 있습니다.

모듈 구성은 다음과 같습니다.

| 모듈 | 하는 일 |
| --- | --- |
| `rules` | 경제 상수(시작 자금, 보상, 무기 가격) |
| `buy-strategy` | 풀 바이, 포스 바이, 하프 바이, 에코 후보와 점수 |
| `future-value` | 다음 라운드 잔고 예측, 무기 보존 가치 |
| `save-decision` | 세이브 대 교전 |
| `ultimate-economy` | 궁극기 포인트와 차단 가치 |
| `exit-kill` | 도망가는 적 추격 대 무기 보존 |
| `round-boundaries` | 전후반·연장·매치 포인트 경계 |
| `match-economy` | 경기 단위 크레딧 진행 |
| `round-value-model` | 3편의 ONNX 모델 자리(지금은 룩업 표) |

## 경제 규칙

규칙 상수는 모두 `Rule<T>{ value, verified, source }` 형태로 감싸 두었습니다.

| 항목 | 값 |
| --- | --- |
| 시작 자금 / 최대 보유 | 800 / 9,000 |
| 라운드 승리 | 3,000 |
| 로스 보너스(1연패 / 2연패 / 3연패 이상) | 1,900 / 2,400 / 2,900 |
| 스파이크 설치 | 300 (진 라운드에도 지급) |
| 킬 | 200 |
| 방어구 Light / Heavy / Regen | 400 / 1,000 / 650 |
| Vandal, Phantom / Operator / Odin / Sheriff | 2,900 / 4,700 / 3,200 / 800 |

로스 보너스는 1.11 패치노트를 출처로 삼았습니다.
표의 값에는 모두 `verified: false`가 붙어 있는데, 현재 빌드(13.10)에서 같은 값인지 아직 확인하지 않았다는 표시입니다.
2편의 공식 위키 값은 "13.10 기준으로 확인됨"으로 표시해 두었습니다.

라운드가 끝난 뒤 받는 크레딧은 다음과 같이 계산합니다.

```ts
// packages/economy-engine/src/match-economy.ts
export function creditAward(args: {
  readonly won: boolean;
  readonly consecutiveLossesBefore: number;
  readonly planted: boolean;
  readonly kills: number;
}): CreditAward {
  const win = args.won ? ECONOMY.roundWinReward.value : 0;
  // The loss bonus uses the streak INCLUDING this loss (1st loss -> ladder[0]); winners reset to 0.
  const lossBonus = args.won ? 0 : lossBonusFor(args.consecutiveLossesBefore + 1);
  // The plant award is paid to the planting team even if they lost the round.
  const plant = args.planted ? ECONOMY.spikePlantReward.value : 0;
  const kills = Math.max(0, args.kills) * ECONOMY.killReward.value;
  return { win, lossBonus, plant, kills, total: win + lossBonus + plant + kills };
}
```

두 줄의 주석은 헷갈리기 쉬운 규칙을 짚고 있습니다.
로스 보너스는 이번 패배까지 포함한 연패 수로 정하고, 설치 보상은 라운드를 져도 받습니다.
1편 경기 로그에서 "1라운드를 진 팀이 2, 3라운드에 포스 바이를 하고 4라운드에 풀 바이를 한다"는 흐름이 이 함수에서 나옵니다.

궁극기는 킬, 데스, 설치, 해체, 오브가 각각 1포인트이고, 오브는 맵에 2개 있습니다.
요원별 필요 포인트는 2편의 공식 위키 값을 기준으로 씁니다.
2편에서 언급한 Jett, Brimstone, Sage, Killjoy 값 차이도 여기서 카탈로그 값으로 통일했습니다.

스파이크 폭발이나 낙사처럼 적이 죽이지 않은 경우에 적 팀이 포인트를 받는지는 `nonHostileDeathGrantsEnemyPoint = false`로 두고 "패치마다 확인 필요"라고 적었습니다.

## 세이브는 임계값으로 정하지 않는다

이 엔진에서 가장 중요한 함수입니다.

```ts
// packages/economy-engine/src/save-decision.ts (발췌)
export function saveOptions(ctx: SaveContext): EconomyOption[] {
  const weaponValue = weaponPrice(ctx.survivorWeaponKey) ?? 0;
  const escapeRisk = clamp01(ctx.escapeRisk ?? Math.min(0.6, 0.15 + 0.12 * ctx.aliveEnemy));
  const survive = 1 - escapeRisk;

  const wfv = weaponFutureValue({ weaponValueCredits: weaponValue, roundNum: ctx.roundNum,
                                  matchScore: ctx.matchScore, teamIdx: ctx.teamIdx });
  const ultDenial = ctx.enemyNearUlt ? ultDenialValue(ctx.enemyNearUlt) : 0;
  const deathProbIfPlay = clamp01(1 - ctx.roundWinProb);

  const save = {
    action: "SAVE_WEAPON",
    currentRoundValue: round3(-ctx.roundWinProb), // forfeits the contest
    futureValue: round3(clamp01(wfv * survive + ultDenial * survive)),
    ...
  };
  const play = {
    action: "PLAY_FOR_ROUND",
    currentRoundValue: round3(ctx.roundWinProb),
    futureValue: round3(-(wfv * deathProbIfPlay) - (ultDenial * deathProbIfPlay)),
    ...
  };
  return [save, play];
}
```

각 항목은 이렇게 계산합니다.

- **탈출 위험**: 기본값은 `0.15 + 0.12 × 살아 있는 적 수`이고 최대 0.6입니다. 적이 많을수록 후퇴하다 잡힐 확률이 높습니다.
- **무기의 미래 가치**: `가격 ÷ 4,700`입니다. 가장 비싼 오퍼레이터가 1, 클래식(0크레딧)이 0입니다.
- **세이브**: 이번 라운드는 포기하므로 `−승률`입니다. 미래 가치는 살아남을 확률을 곱한 무기 가치에 궁극기 차단 가치를 더한 값입니다.
- **교전**: 이번 라운드는 `+승률`입니다. 미래 가치는 죽을 확률만큼 무기를 잃는 손해(−)입니다.

두 선택지의 합(이번 라운드 + 미래)을 비교해서 큰 쪽을 권합니다.

### 1대4, 오퍼레이터

테스트 시나리오 07을 직접 계산해 보겠습니다.
혼자 남았고, 적은 넷, 오퍼레이터를 들고 있으며, 이길 확률은 0.1입니다.

- 탈출 위험: `min(0.6, 0.15 + 0.12 × 4) = 0.6`, 생존 확률 0.4
- 무기 미래 가치: `4700 ÷ 4700 = 1`
- 세이브: `−0.1 + (1 × 0.4) = 0.3`
- 교전: `0.1 + (−1 × 0.9) = −0.8`

0.3 대 −0.8로 세이브를 고릅니다.
기대 크레딧 보존은 `4,700 × 0.4 = 1,880`입니다.

### 1대4, 클래식

같은 상황에서 무기만 클래식으로 바꾸면 미래 가치가 0이 됩니다.

- 세이브: `−0.1 + 0 = −0.1`
- 교전: `0.1 + 0 = 0.1`

이번에는 교전이 낫습니다. 살려도 아낄 돈이 없기 때문입니다.
마스터 프롬프트 20.4절의 "가치가 낮은 무기는 반드시 세이브할 필요가 없다"는 사례를 그대로 테스트로 만들었습니다.

임계값 방식과의 차이가 여기서 드러납니다.
"승률 20% 이하면 세이브" 같은 규칙이라면 클래식을 든 선수도 후퇴합니다.
이 엔진은 승률이 낮다는 이유만으로 세이브를 고르지 않고, 반대로 무기와 궁극기 가치가 크면 승률이 꽤 높아도 세이브를 고를 수 있습니다.
코드 주석에도 "This is the multi-factor comparison, not a win-probability cutoff"라고 적혀 있습니다.

## 무기를 살려도 쓸 곳이 없는 라운드

무기를 살리는 가치는 다음 라운드에 그 무기를 쓸 수 있다는 전제에서 나옵니다.
이 전제가 성립하지 않는 라운드가 있습니다.

```ts
// packages/economy-engine/src/round-boundaries.ts
export function isPreResetRound(roundNum: number): boolean {
  if (roundNum === ROUNDS_PER_HALF || roundNum === REGULATION_ROUNDS) return true;
  // In overtime each round is its own fixed-credit round, so a saved weapon doesn't carry either.
  return roundNum > REGULATION_ROUNDS;
}

export function weaponPreservationHasFuture(roundNum: number, score: MatchScore, teamIdx: TeamIdx): boolean {
  if (isPreResetRound(roundNum)) return false;
  // If the OPPONENT can clinch the map by winning this round, a save buys nothing for teamIdx.
  const opp = score[teamIdx === 0 ? 1 : 0];
  if (opp >= WIN_ROUNDS - 1 && opp >= score[teamIdx]) return false;
  return true;
}
```

- **12라운드와 24라운드**: 전반이 끝나면 공수가 바뀌고 장비가 초기화되므로 살린 무기가 사라집니다.
- **연장전**: 라운드마다 고정 자금으로 시작해서 무기가 이어지지 않습니다.
- **상대의 매치 포인트**: 이번 라운드를 지면 경기가 끝나므로 다음 라운드를 위해 아낄 이유가 없습니다.

이때 무기 미래 가치는 0이고, 세이브는 거의 선택되지 않습니다.
시나리오 09(24라운드, 11대12)는 "세이브하지 않음"으로 테스트되어 있고, 설명 문자열에도 "future=0 (half/OT reset or match point)"가 찍힙니다.

프로 경기에서 전반 마지막 라운드에 혼자 남은 선수가 무리해서 싸우는 장면이 바로 이 계산과 같습니다.

## 궁극기 포인트 1점의 가치

궁극기도 경제의 한 축입니다.
적 궁극기가 1포인트 남았을 때 내가 죽으면 그 1포인트를 적에게 주게 됩니다.
그러면 다음 라운드에 적 Sova의 궁극기가 사이트를 쓸어 버릴 수 있습니다.

```ts
// packages/economy-engine/src/ultimate-economy.ts
export function ultDenialValue(enemy: UltState, ultImpact = 0.6): number {
  if (enemy.ready) return 0; // already charged — denying a point changes nothing
  if (enemy.pointsToReady === 1) return ultImpact; // one kill from their ult: denial is worth most
  if (enemy.pointsToReady === 2) return ultImpact * 0.35;
  return ultImpact * 0.1; // far from ult: small
}
```

| 적 상태 | 차단 가치 |
| --- | --- |
| 이미 충전됨 | 0 |
| 1포인트 남음 | 0.6 |
| 2포인트 남음 | 0.21 |
| 그 이상 | 0.06 |

이 값은 세이브 계산에 들어갑니다.
살아남으면 세이브의 미래 가치에 더하고, 교전의 미래 가치에서는 죽을 확률만큼 뺍니다.
그래서 클래식을 들고 있어도 적 궁극기가 1포인트 남았다면 세이브 쪽으로 기울 수 있습니다.
시나리오 08은 Neon이 7/8인 상황으로 이를 확인합니다.

0.6, 0.35, 0.1이라는 계수는 실측값이 아니라 "1포인트 차이가 가장 중요하다"는 모양에 맞춘 설계 값입니다.
3편에서 다뤘듯이 VCT Reference에는 라운드별 궁극기 사용 기록이 없기 때문입니다.

## 쫓아갈까, 무기를 지킬까

반대 상황도 있습니다.
라운드는 사실상 이겼는데 적 하나가 오퍼레이터를 들고 도망갑니다.
쫓아가서 잡으면 상대는 4,700크레딧을 잃습니다.
대신 쫓다가 죽으면 내 Vandal을 잃고 적에게 궁극기 포인트를 줍니다.

```ts
// packages/economy-engine/src/exit-kill.ts (발췌)
const chase: EconomyOption = {
  action: "EXIT_KILL",
  currentRoundValue: 0, // the round is already decided; this is purely economic/future
  futureValue: round3((enemyVal / 4700) * killP - (ownVal / 4700) * deathP - ultFeed * deathP),
  economicDelta: Math.round(enemyVal * killP - ownVal * deathP), // enemy loss minus own expected loss
  ...
};
```

라운드 결과는 이미 정해졌으므로 이번 라운드 가치는 0이고, 다음 라운드만 보고 계산합니다.
마스터 프롬프트 22장의 "상대 무기 파괴와 출구 킬"을 구현한 함수입니다.

## 구매 판단

구매도 임계값 하나로 정하지 않고 여러 후보를 만들어 비교합니다.

- 풀 바이, 포스 바이, 하프 바이, 에코 후보를 만듭니다.
- 이번 라운드 가치는 `(이 구매 대 상대 구매의 실측 승률 − 0.5) × 2`입니다. 3편의 구매 매치업 표를 씁니다.
- 미래 가치는 `다음 라운드 승률 이점 + (풀 바이 대비 아낀 금액 ÷ 20,000) × 0.2`입니다. 3편에서 구한 "에코한 팀의 다음 라운드 승률 0.598"이 들어갑니다.
- 매치 포인트에서는 미래 가중치가 0입니다.

팀 비용 구간(풀 20,000, 하프 12,000, 에코 2,500)은 3편 기준선의 구매 단계 경계와 맞췄습니다.
엔진의 "풀 바이"와 기준선의 "full"이 같은 범위를 가리키게 하기 위해서입니다.

## 경기 진행기와의 연결

경기 진행기(`match-runner`)는 라운드가 끝난 뒤 크레딧 정산(`advanceTeamEconomy`)에 이 엔진을 씁니다.
승리 보상, 로스 보너스, 설치 보상, 킬 보상이 모두 여기서 계산됩니다.

구매는 현재 팀 단위의 간단한 규칙으로 정합니다.

```ts
// packages/match-runner/src/economy.ts
export function decideBuy(credits: number, isPistol: boolean): BuyDecision {
  if (isPistol) {
    if (credits >= priceOf("ghost") + LIGHT_ARMOR) {
      return { tier: "pistol", weapon: "Ghost", weaponKey: "ghost", cost: priceOf("ghost") + LIGHT_ARMOR };
    }
    return { tier: "pistol", weapon: "Classic", weaponKey: "classic", cost: 0 };
  }
  const fullCost = priceOf("vandal") + HEAVY_ARMOR;
  const forceCost = priceOf("spectre") + LIGHT_ARMOR;
  if (credits >= fullCost) return { tier: "full", weapon: "Vandal", weaponKey: "vandal", cost: fullCost };
  if (credits >= forceCost) return { tier: "force", weapon: "Spectre", weaponKey: "spectre", cost: forceCost };
  return { tier: "eco", weapon: "Classic", weaponKey: "classic", cost: 0 }; // save
}
```

돈이 충분하면 Vandal과 헤비 아머, 부족하면 Spectre와 라이트 아머, 그것도 안 되면 에코입니다.
1편 경기 로그에서 구매가 Classic, Spectre, Vandal 세 가지로 나온 이유입니다.
코치가 타임아웃 때 "세이브", "포스", "풀"을 지시하면 그 지시를 따릅니다(6편).

행동 후보 생성기(5편)에는 `EconomyEvaluator`를 받는 자리가 있습니다.
여기에 경제 엔진을 넘기면 세이브와 출구 킬 후보의 가치를 이 엔진으로 계산하고, 넘기지 않으면 임시 고정값을 씁니다.

연결 과정에서 패키지 설정도 하나 맞췄습니다.
경제 엔진은 독립 패키지로 먼저 만들어져서 `package.json`이 빌드 결과물인 `./dist`를 가리키고 있었습니다.
다른 `@pv/*` 패키지처럼 `./src/index.ts`를 직접 가리키도록 19:37 커밋(`8aab3e1`)에서 바꾼 뒤 경기 진행기에서 크레딧 API를 쓰기 시작했습니다.

## 남은 과제

- 현재 경기 진행기는 크레딧 정산만 이 엔진을 쓰고, 세이브·구매·출구 킬 판단 연결은 다음 단계입니다. 경기용 팀 정책(`packages/match-runner/src/setup.ts`)에 `EconomyEvaluator`를 넘기면 됩니다.
- 경제 상수를 현재 패치 기준으로 확인해서 `verified` 표시를 갱신합니다.
- 궁극기 차단 계수(0.6, 0.35, 0.1)는 데이터가 생기면 다시 맞춥니다.

## 정리

경제 엔진은 마스터 프롬프트의 설계가 가장 그대로 코드로 옮겨진 부분입니다.
개념식은 함수가 됐고, 프롬프트에 적힌 사례(오퍼레이터 보존, 클래식, 전반 마지막 라운드, 궁극기 1포인트)는 테스트가 됐습니다.

다음 편에서는 의사결정 코어를 다룹니다.
선수가 무엇을 알고 무엇을 모르는지, 그 상황에서 어떤 행동이 가능한지를 만드는 부분입니다.

## 참고 자료

- [packages/economy-engine](https://github.com/2rangs/Project-VM/tree/main/packages/economy-engine)
- [docs/ECONOMY_MODEL.md](https://github.com/2rangs/Project-VM/blob/main/docs/ECONOMY_MODEL.md)
- [packages/match-runner/src/economy.ts](https://github.com/2rangs/Project-VM/blob/main/packages/match-runner/src/economy.ts)
- [packages/action-generator/src/generate.ts](https://github.com/2rangs/Project-VM/blob/main/packages/action-generator/src/generate.ts)
- [README.md 19~22장 (경제, 세이브, 궁극기, 출구 킬)](https://github.com/2rangs/Project-VM/blob/main/README.md)
