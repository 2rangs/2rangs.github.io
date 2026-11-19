---
slug: project-v-economy-engine
title: 세이브는 다음 라운드를 위한 투자다: 경제와 궁극기 엔진
summary: 1대4 상황에서 오퍼레이터는 살리고 클래식은 싸우는 이유를 계산하는 경제 엔진. 그리고 그 엔진이 아직 실제 경기에 꽂혀 있지 않다는 사실까지 정리합니다.
tags: [PROJECT V, 게임 AI, TypeScript]
series: PROJECT V 개발기
date: 2026-11-19T04:03:00.000Z
comment_term: blog-post-project-v-economy-engine
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 4편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `packages/economy-engine`, `docs/ECONOMY_MODEL.md`, `packages/match-runner/src/economy.ts`를 근거로 썼습니다.

발로란트를 처음 보는 사람이 가장 이해하기 어려워하는 장면이 있습니다.
라운드 막판, 혼자 남은 선수가 적 넷이 지키는 사이트를 두고 뒤로 도망칩니다.
해설은 "오퍼 살리네요, 좋은 판단입니다"라고 말합니다.

이기려고 하는 게임에서 지는 쪽을 고르는 게 좋은 판단이라니.
이유는 이 게임에 다음 라운드가 있기 때문입니다.
라운드가 끝나도 살아 있는 선수는 무기를 들고 다음 라운드로 넘어갑니다.
4,700크레딧짜리 오퍼레이터를 살리면, 다음 라운드에 팀 경제가 그만큼 숨을 쉽니다.

인수인계 문서의 마지막 결정(DECISION-011)이 바로 이것입니다.

> 세이브를 단순한 패배 시 행동으로 처리하지 않는다. 세이브는 현재 라운드, 다음 라운드, 장비 보존, 상대 경제, 궁극기 충전과 연관된 의사결정이다.

이번 편은 이 결정을 코드로 옮긴 경제·궁극기 엔진 이야기입니다.
그리고 그 엔진이 아직 경기에 다 연결되지 않았다는 이야기도 같이 합니다.

## 한눈에 보기

- `@pv/economy-engine`은 런타임 의존성이 없고, 난수도 입출력도 쓰지 않는 결정적 TypeScript 라이브러리입니다. 테스트는 31개입니다.
- 모든 판단은 같은 모양의 선택지(`EconomyOption`)를 돌려줍니다. 이번 라운드 가치, 미래 가치, 크레딧 변화, 궁극기 포인트 변화, 그리고 사람이 읽을 수 있는 설명입니다.
- 세이브는 "승률이 몇 % 이하면 도망"이 아니라, 세이브와 교전 두 선택지에 각각 점수를 매겨 비교합니다. 1대4에 오퍼레이터면 세이브(0.3 대 −0.8), 클래식이면 교전입니다.
- 전반 마지막 라운드, 24라운드, 연장전, 상대의 매치 포인트에서는 무기를 살려 봐야 쓸 곳이 없으므로 미래 가치가 0이 됩니다.
- 적이 궁극기까지 1포인트 남았을 때 죽지 않는 것의 가치, 도망가는 적을 쫓아가 무기를 부술 가치도 같은 틀로 계산합니다.
- 경제 상수(로스 보너스 1,900/2,400/2,900 등)는 전부 `verified: false`입니다. 출처는 있지만 현재 패치로 다시 확인하지 않았습니다.
- **실제 경기(match-runner)는 아직 이 엔진의 크레딧 계산만 씁니다.** 구매는 단순한 임계값 규칙이고, 세이브·구매 판단은 연결 지점만 있고 꽂혀 있지 않습니다.

## 같은 모양의 선택지

마스터 프롬프트 20장은 세이브 가치를 이런 개념식으로 적었습니다.

```text
Save Value = 장비 보존 + 다음 라운드 구매 이점 + 미래 승률 + 궁극기 포인트 차단
           − 현재 라운드 기회비용 − 탈출 위험
```

엔진은 이걸 하나의 숫자로 뭉치지 않고, 선택지마다 같은 칸을 채워 돌려줍니다.

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

이렇게 나눠 두면 쓰는 쪽에서 가중치를 다르게 줄 수 있습니다.
공격적인 IGL은 이번 라운드 가치에, 신중한 IGL은 미래 가치에 무게를 더 둘 수 있습니다.
그리고 `explanation`이 있어서, 나중에 의사결정 디버거(5편)가 "왜 도망갔나"를 문장으로 보여 줄 수 있습니다.

모듈은 이렇게 나뉩니다.

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

규칙 상수는 전부 `Rule<T>{ value, verified, source }`로 감싸 있습니다.

| 항목 | 값 |
| --- | --- |
| 시작 자금 / 최대 보유 | 800 / 9,000 |
| 라운드 승리 | 3,000 |
| 로스 보너스(1연패 / 2연패 / 3연패 이상) | 1,900 / 2,400 / 2,900 |
| 스파이크 설치 | 300 (진 라운드에도 지급) |
| 킬 | 200 |
| 방어구 Light / Heavy / Regen | 400 / 1,000 / 650 |
| Vandal, Phantom / Operator / Odin / Sheriff | 2,900 / 4,700 / 3,200 / 800 |

로스 보너스의 출처는 1.11 패치노트입니다.
그리고 이 표의 모든 값이 `verified: false`입니다.
출처는 있지만 현재 빌드(13.10)에서 같은지 확인하지 않았다는 표시입니다.
2편의 공식 위키 값이 "13.10 기준으로 확인됨"이었던 것과 대조됩니다.

라운드가 끝나고 받는 크레딧은 이렇게 계산합니다.

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

주석 두 줄이 이 규칙에서 틀리기 쉬운 부분을 짚습니다.
로스 보너스는 "이번 패배를 포함한" 연패 수로 정하고, 설치 보상은 라운드를 져도 받습니다.
1편에서 본 경기 로그의 "1라운드를 진 팀이 2, 3라운드에 포스 바이를 하고 4라운드에야 풀 바이를 한다"는 흐름이 이 함수에서 나옵니다.

궁극기 쪽은 킬, 데스, 설치, 해체, 오브가 각각 1포인트이고, 오브는 맵에 2개입니다.
요원별 필요 포인트는 2편의 공식 위키 값을 정본으로 씁니다.
2편에서 말한 Jett, Brimstone, Sage, Killjoy 불일치가 여기서도 한 번 더 확인됐고, 카탈로그 값으로 정리됐습니다.

스파이크 폭발이나 낙사처럼 적이 죽이지 않은 죽음에 적 팀이 포인트를 받는지는 `nonHostileDeathGrantsEnemyPoint = false`로 두고 "패치마다 확인 필요"라고 적었습니다.

## 세이브는 임계값이 아니다

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

읽는 법은 이렇습니다.

- **탈출 위험**: 기본값은 `0.15 + 0.12 × 살아 있는 적 수`, 최대 0.6입니다. 적이 많을수록 도망가다 잡힐 확률이 높습니다.
- **무기의 미래 가치**: `가격 ÷ 4,700`입니다. 가장 비싼 오퍼레이터가 1이고, 클래식(0크레딧)은 0입니다.
- **세이브**: 이번 라운드는 포기하므로 `−승률`. 미래 가치는 살아남을 확률만큼의 무기 가치(+궁극기 차단 가치).
- **교전**: 이번 라운드는 `+승률`. 미래 가치는 죽을 확률만큼 무기를 잃는 손해(−).

두 선택지의 합계(이번 라운드 + 미래)를 비교해서 큰 쪽을 권합니다.

### 1대4, 오퍼레이터

테스트 시나리오 07을 손으로 계산해 보겠습니다.
혼자 남았고, 적은 넷, 오퍼레이터를 들고 있고, 이길 확률은 0.1입니다.

- 탈출 위험: `min(0.6, 0.15 + 0.12 × 4) = 0.6`, 생존 확률 0.4
- 무기 미래 가치: `4700 ÷ 4700 = 1`
- 세이브: `−0.1 + (1 × 0.4) = 0.3`
- 교전: `0.1 + (−1 × 0.9) = −0.8`

0.3 대 −0.8로 세이브입니다.
기대 크레딧 보존은 `4,700 × 0.4 = 1,880`입니다.

### 1대4, 클래식

같은 상황에서 무기만 클래식으로 바꾸면 미래 가치가 0이 됩니다.

- 세이브: `−0.1 + 0 = −0.1`
- 교전: `0.1 + 0 = 0.1`

이번엔 싸우는 쪽이 낫습니다.
살려 봐야 아낄 게 없으니까요.
마스터 프롬프트 20.4절이 "가치가 낮은 무기는 반드시 세이브할 필요가 없다"고 적은 사례가 그대로 테스트로 고정되어 있습니다.

이게 임계값 방식과 다른 점입니다.
"승률 20% 이하면 세이브" 같은 규칙은 클래식 든 선수도 도망가게 만듭니다.
이 엔진은 승률이 낮다는 것만으로 세이브를 강요하지 않고, 반대로 무기와 궁극기 가치가 크면 승률이 꽤 높아도 세이브를 고를 수 있습니다.
코드 주석의 표현으로는 "This is the multi-factor comparison, not a win-probability cutoff"입니다.

## 살려도 쓸 곳이 없는 라운드

무기를 살리는 가치는 "다음 라운드에 그 무기를 쓸 수 있다"는 전제 위에 있습니다.
그 전제가 깨지는 순간들이 있습니다.

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

- **12라운드와 24라운드**: 전반이 끝나면 공수가 바뀌고 장비가 초기화됩니다. 살린 무기는 사라집니다.
- **연장전**: 매 라운드 고정 자금으로 시작해서 무기가 이어지지 않습니다.
- **상대의 매치 포인트**: 이번 라운드를 지면 경기가 끝나는데 다음 라운드를 위해 아낄 이유가 없습니다.

이 경우 무기 미래 가치는 0이 되고, 세이브는 거의 항상 집니다.
시나리오 09(24라운드, 11대12)가 "세이브하지 않음"으로 테스트되어 있습니다.
설명 문자열에도 "future=0 (half/OT reset or match point)"가 찍힙니다.

프로 경기에서 전반 마지막 라운드에 혼자 남은 선수가 무모해 보이게 돌진하는 장면을 보신 적이 있다면, 바로 이 계산입니다.

## 궁극기 포인트 하나의 값

궁극기는 경제의 또 다른 축입니다.
적의 궁극기가 1포인트 남았을 때 내가 죽으면, 그 1포인트를 적에게 줍니다.
다음 라운드에 적 Sova의 궁극기가 사이트를 쓸어 버릴 수 있습니다.

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

이 값이 세이브 계산에 더해집니다.
살아남으면 세이브의 미래 가치에 더하고, 싸우다 죽을 확률만큼 교전의 미래 가치에서 뺍니다.
그래서 무기가 클래식이어도, 적 궁극기가 1포인트 남았으면 세이브 쪽으로 기울 수 있습니다.
시나리오 08은 Neon이 7/8인 상황으로 이걸 확인합니다.

솔직히 말하면 0.6, 0.35, 0.1이라는 계수는 실측에서 나온 값이 아닙니다.
3편에서 봤듯이 VCT Reference에는 라운드별 궁극기 사용 기록이 없습니다.
"1포인트 차이가 가장 중요하다"는 모양만 맞춘 설계 값입니다.

## 쫓아갈 것인가, 무기를 지킬 것인가

반대 상황도 있습니다.
라운드를 사실상 이겼는데, 적 하나가 오퍼레이터를 들고 도망칩니다.
쫓아가서 잡으면 상대 경제에 4,700크레딧짜리 구멍이 납니다.
대신 쫓아가다 죽으면 내 Vandal을 잃고, 적에게 궁극기 포인트를 줍니다.

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

이번 라운드 가치는 0입니다.
라운드는 이미 정해졌고, 이건 순전히 다음 라운드를 위한 계산이기 때문입니다.
마스터 프롬프트 22장의 "상대 무기 파괴와 출구 킬"이 이 함수입니다.

## 구매 판단

구매도 하나의 임계값이 아니라 후보 여러 개로 나옵니다.

- 풀 바이, 포스 바이, 하프 바이, 에코 후보를 만듭니다.
- 이번 라운드 가치는 `(이 구매 대 상대 구매의 실측 승률 − 0.5) × 2`입니다. 3편의 구매 매치업 표가 여기 들어갑니다.
- 미래 가치는 `다음 라운드 승률 이점 + (풀 바이 대비 아낀 금액 ÷ 20,000) × 0.2`입니다. 3편의 "에코한 팀의 다음 라운드 승률 0.598"이 여기 들어갑니다.
- 매치 포인트에서는 미래 가중치가 0입니다.

팀 비용 구간(풀 20,000, 하프 12,000, 에코 2,500)은 3편 기준선의 구매 단계 경계와 맞췄습니다.
엔진이 "풀 바이"라고 부르는 것과 기준선이 "full"이라고 부르는 것이 같은 범위를 가리키게 하려는 것입니다.

## 그런데, 경기에서는 쓰이고 있나

이 글을 쓰려고 코드를 따라가다가 확인한 사실이 있습니다.
**실제 경기를 돌리는 `match-runner`는 이 엔진의 판단 기능을 아직 쓰지 않습니다.**

구매는 이렇게 정해집니다.

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

돈이 되면 Vandal과 헤비 아머, 안 되면 Spectre와 라이트 아머, 그것도 안 되면 에코.
선수 개인이 아니라 팀 단위이고, 무기는 세 종류뿐입니다.
1편의 경기 로그에서 구매가 Classic, Spectre, Vandal 셋만 나왔던 이유입니다.
코치가 타임아웃 때 "세이브" "포스" "풀" 지시를 내리면 그걸 따르지만(6편), 그 외에는 이 규칙대로 삽니다.

경제 엔진이 실제로 쓰이는 곳은 라운드가 끝난 뒤의 크레딧 계산(`advanceTeamEconomy`)입니다.
승리 보상, 로스 보너스, 설치 보상, 킬 보상이 이 엔진에서 나옵니다.

세이브와 출구 킬 판단은 어떨까요?
행동 후보 생성기(5편)에는 `EconomyEvaluator`를 받는 자리가 있고, 주면 세이브와 출구 킬 후보의 가치를 이 엔진으로 계산합니다.
주지 않으면 "임시 휴리스틱"이라는 꼬리표를 단 고정값을 씁니다.
그리고 지금 경기를 돌리는 팀 정책은 이 자리를 비워 둔 채로 만들어집니다.

```ts
// packages/match-runner/src/setup.ts
this.inner = new TeamDecisionPolicy(sq, abilityEffect ? { abilityEffect } : {});
```

즉 이번 편에서 설명한 세이브 계산, 궁극기 차단, 출구 킬, 구매 후보는 **테스트로 검증된 라이브러리로 존재하지만, 시뮬레이션 경기에는 아직 꽂혀 있지 않습니다.**
1대4 오퍼레이터 상황에서 도망가는 선수는, 지금 엔진에서는 아직 볼 수 없습니다.

이렇게 된 데는 이유가 있습니다.
경제 엔진은 데이터 세션(PV-2)이 독립 패키지로 먼저 만들었고, 통합 단계에서는 "시뮬레이션 가능한 초안을 최대한 빨리"가 우선이었습니다.
가장 먼저 연결된 것이 크레딧 계산이었고, 그 다음 우선순위는 시간 초과 87% 같은 더 급한 불이었습니다.

연결도 한 번 막혔습니다.
경제 엔진의 `package.json`이 한 번도 빌드되거나 커밋된 적 없는 `./dist`를 가리키고 있어서, 다른 패키지에서 import하면 모듈을 찾지 못했습니다.
다른 `@pv/*` 패키지들은 처음부터 `./src/index.ts`를 직접 가리키는 빌드 없는 구조였는데, 경제 엔진만 독립 패키지로 시작한 흔적이 남아 있었던 것입니다.
19:37 커밋(`8aab3e1`)에서 다른 패키지와 같은 방식으로 바꾸고 나서야 경기 진행기가 크레딧 API를 쓸 수 있게 됐습니다.

## 정리

경제 엔진은 이 프로젝트에서 가장 "설계대로" 만들어진 부분입니다.
마스터 프롬프트의 개념식이 그대로 함수가 됐고, 프롬프트에 적힌 사례(오퍼레이터 보존, 클래식, 전반 마지막 라운드, 궁극기 1포인트)가 그대로 테스트가 됐습니다.

동시에 "만들어진 것"과 "경기에서 쓰이는 것"이 다른 대표적인 사례이기도 합니다.
여섯 세션이 동시에 부품을 만들면 부품은 빨리 쌓이지만, 꽂는 일은 마지막에 한꺼번에 몰립니다.
그리고 그 시점에는 늘 더 급한 문제가 있습니다.
다음 작업 목록(`docs/NEXT_TASKS.md`)에 이 연결이 들어가야 할 이유입니다.

다음 편부터는 엔진의 두뇌로 들어갑니다.
선수가 무엇을 알고, 무엇을 모르고, 그 상황에서 어떤 행동이 가능한지를 만들어 내는 의사결정 코어입니다.

## 참고 자료

- [packages/economy-engine](https://github.com/2rangs/Project-VM/tree/main/packages/economy-engine)
- [docs/ECONOMY_MODEL.md](https://github.com/2rangs/Project-VM/blob/main/docs/ECONOMY_MODEL.md)
- [packages/match-runner/src/economy.ts](https://github.com/2rangs/Project-VM/blob/main/packages/match-runner/src/economy.ts)
- [packages/action-generator/src/generate.ts](https://github.com/2rangs/Project-VM/blob/main/packages/action-generator/src/generate.ts)
- [README.md 19~22장 (경제, 세이브, 궁극기, 출구 킬)](https://github.com/2rangs/Project-VM/blob/main/README.md)
