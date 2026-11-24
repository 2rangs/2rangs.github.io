---
slug: project-v-economy-engine
title: PROJECT V 개발기 (4) 세이브를 계산하는 경제·궁극기 엔진
summary: 세이브를 승률 임계값이 아니라 이번 라운드와 다음 라운드 가치의 비교로 정한 경제 엔진을 만들었다. 오퍼레이터와 클래식, 궁극기 1포인트 사례가 그대로 테스트가 됐다.
tags: [PROJECT V, 게임 AI, TypeScript]
series: PROJECT V 개발기
date: 2026-11-19T04:03:00.000Z
comment_term: blog-post-project-v-economy-engine
---

발로란트 경기를 보다 보면 라운드 막판에 혼자 남은 선수가 적 넷이 지키는 사이트를 포기하고 뒤로 빠지는 장면이 나온다. 해설은 "오퍼 살리네요, 좋은 판단입니다"라고 한다. 라운드를 버리는 게 좋은 판단이 되는 건 다음 라운드가 있어서다. 살아남은 선수는 들고 있던 무기를 그대로 가지고 다음 라운드를 시작하고, 4,700크레딧짜리 오퍼레이터를 살리면 그만큼 구매가 여유로워진다.

인수인계 문서의 마지막 결정인 DECISION-011이 이걸 못 박아 두었다.

> 세이브를 단순한 패배 시 행동으로 처리하지 않는다. 세이브는 현재 라운드, 다음 라운드, 장비 보존, 상대 경제, 궁극기 충전과 연관된 의사결정이다.

이 결정을 코드로 옮긴 게 `@pv/economy-engine`이다. 런타임 의존성이 없고 난수나 입출력도 쓰지 않는 결정적 TypeScript 라이브러리이고, 테스트는 31개다.

## 숫자 하나로 합치지 않는다

마스터 프롬프트 20장은 세이브 가치를 이런 개념식으로 적어 두었다.

```text
Save Value = 장비 보존 + 다음 라운드 구매 이점 + 미래 승률 + 궁극기 포인트 차단
           − 현재 라운드 기회비용 − 탈출 위험
```

엔진은 이걸 점수 하나로 뭉치지 않고, 모든 판단 함수가 같은 모양의 선택지(`EconomyOption`)를 돌려주게 했다. 행동 이름(`SAVE_WEAPON`, `PLAY_FOR_ROUND`, `fullBuy`, `EXIT_KILL` 등), 이번 라운드 가치와 미래 가치(각각 -1~1), 크레딧 기대 변화, 궁극기 포인트 기대 변화, 그리고 사람이 읽는 설명 문장이 들어간다. 항목이 나뉘어 있으면 호출하는 쪽에서 가중치를 다르게 줄 수 있다. 공격적인 IGL은 이번 라운드를, 신중한 IGL은 미래를 더 무겁게 보면 된다. 설명 문장은 의사결정 디버거(5편)에서 "왜 후퇴했는지"를 보여 주는 데 쓴다.

모듈은 경제 상수(`rules`), 구매 후보(`buy-strategy`), 다음 라운드 예측(`future-value`), 세이브 판단(`save-decision`), 궁극기(`ultimate-economy`), 출구 킬(`exit-kill`), 전후반·연장 경계(`round-boundaries`), 경기 단위 크레딧(`match-economy`), 그리고 3편의 ONNX 모델 자리인 `round-value-model`(지금은 룩업 표)로 나뉜다.

## 경제 규칙

규칙 상수는 모두 `Rule<T>{ value, verified, source }`로 감쌌다. 시작 자금 800, 최대 보유 9,000, 라운드 승리 3,000, 로스 보너스 1,900/2,400/2,900(1연패/2연패/3연패 이상), 스파이크 설치 300(진 라운드에도 지급), 킬 200이다. 방어구는 Light 400, Heavy 1,000, Regen 650이고 무기는 Vandal·Phantom 2,900, Operator 4,700, Odin 3,200, Sheriff 800이다.

로스 보너스는 1.11 패치노트가 출처다. 이 값들에는 모두 `verified: false`가 붙어 있는데, 현재 빌드(13.10)에서도 같은지 아직 확인하지 않았다는 표시다. 2편의 공식 위키 값은 "13.10 기준으로 확인됨"으로 따로 표시해 두었다.

라운드 뒤 받는 크레딧 계산에서 헷갈리기 쉬운 건 두 가지다. 로스 보너스는 이번 패배까지 포함한 연패 수로 정하고, 설치 보상은 라운드를 져도 받는다. 1편 경기 로그에서 "1라운드를 진 팀이 2, 3라운드에 포스 바이를 하고 4라운드에 풀 바이를 한다"는 흐름이 여기서 나온다.

궁극기는 킬, 데스, 설치, 해체, 오브가 각각 1포인트이고 오브는 맵에 2개 있다. 요원별 필요 포인트는 2편의 공식 위키 값을 쓰고, 2편에서 말한 Jett, Brimstone, Sage, Killjoy 값 차이도 여기서 카탈로그 값으로 통일했다. 스파이크 폭발이나 낙사처럼 적이 죽이지 않은 경우에 적 팀이 포인트를 받는지는 `nonHostileDeathGrantsEnemyPoint = false`로 두고 "패치마다 확인 필요"라고 적어 두었다.

## 세이브는 임계값으로 정하지 않는다

엔진에서 제일 중요한 함수가 `saveOptions`다.

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

탈출 위험은 기본값이 `0.15 + 0.12 × 살아 있는 적 수`이고 최대 0.6이다. 무기의 미래 가치는 `가격 ÷ 4,700`이라 오퍼레이터가 1, 클래식(0크레딧)이 0이다. 세이브를 고르면 이번 라운드는 `−승률`이고, 미래 가치는 살아남을 확률을 곱한 무기 가치에 궁극기 차단 가치를 더한 값이다. 교전을 고르면 이번 라운드는 `+승률`, 미래 가치는 죽을 확률만큼 무기를 잃는 손해다. 두 선택지의 합을 비교해서 큰 쪽을 권한다.

테스트 시나리오 07을 손으로 계산해 봤다. 혼자 남았고 적은 넷, 오퍼레이터를 들고 있고 이길 확률은 0.1이다. 탈출 위험은 `min(0.6, 0.15 + 0.12 × 4) = 0.6`이라 생존 확률은 0.4다. 세이브는 `−0.1 + (1 × 0.4) = 0.3`, 교전은 `0.1 + (−1 × 0.9) = −0.8`이라 세이브를 고른다. 기대 크레딧 보존은 `4,700 × 0.4 = 1,880`이다.

같은 상황에서 무기만 클래식으로 바꾸면 미래 가치가 0이 돼서 세이브는 −0.1, 교전은 0.1이다. 살려도 아낄 돈이 없으니 싸우는 게 낫다. 마스터 프롬프트 20.4절의 "가치가 낮은 무기는 반드시 세이브할 필요가 없다"를 그대로 테스트로 만든 것이다.

"승률 20% 이하면 세이브" 같은 규칙이었다면 클래식을 든 선수도 후퇴했을 것이다. 이 엔진은 승률이 낮다는 이유만으로 세이브하지 않고, 거꾸로 무기와 궁극기 가치가 크면 승률이 꽤 높아도 세이브를 고를 수 있다. 코드 주석에도 "This is the multi-factor comparison, not a win-probability cutoff"라고 적혀 있다.

## 살려도 쓸 곳이 없는 라운드

무기를 살리는 가치는 다음 라운드에 그 무기를 쓸 수 있다는 전제에서 나온다. 이 전제가 깨지는 라운드가 있다. 12라운드와 24라운드는 끝나면 공수가 바뀌고 장비가 초기화된다. 연장전은 라운드마다 고정 자금으로 시작해서 무기가 이어지지 않는다. 상대가 매치 포인트일 때는 이번 라운드를 지면 경기가 끝나니 아낄 이유가 없다.

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

이때 무기 미래 가치는 0이고 세이브는 거의 선택되지 않는다. 시나리오 09(24라운드, 11대12)는 "세이브하지 않음"으로 테스트되어 있고, 설명 문자열에도 "future=0 (half/OT reset or match point)"가 찍힌다. 프로 경기에서 전반 마지막 라운드에 혼자 남은 선수가 무리해서 싸우는 게 바로 이 계산이다.

## 궁극기 1포인트, 그리고 출구 킬

적 궁극기가 1포인트 남았을 때 내가 죽으면 그 1포인트를 적에게 준다. 그러면 다음 라운드에 적 Sova의 궁극기가 사이트를 쓸어 버릴 수 있다. `ultDenialValue`는 적이 이미 충전됐으면 0, 1포인트 남았으면 0.6, 2포인트 남았으면 0.21, 그보다 멀면 0.06을 돌려준다. 이 값은 살아남으면 세이브의 미래 가치에 더해지고, 교전에서는 죽을 확률만큼 빠진다. 그래서 클래식을 들고 있어도 적 궁극기가 1포인트 남았다면 세이브 쪽으로 기울 수 있고, 시나리오 08(Neon 7/8)이 이걸 확인한다.

0.6, 0.35, 0.1이라는 계수는 실측값이 아니다. "1포인트 차이가 가장 중요하다"는 모양에 맞춘 설계 값이다. 3편에서 다뤘듯이 VCT Reference에는 라운드별 궁극기 사용 기록이 없다.

반대 상황도 있다. 라운드는 사실상 이겼는데 적 하나가 오퍼레이터를 들고 도망간다. 쫓아가서 잡으면 상대는 4,700크레딧을 잃지만, 쫓다가 죽으면 내 Vandal을 잃고 적에게 궁극기 포인트를 준다. 마스터 프롬프트 22장의 "상대 무기 파괴와 출구 킬"을 구현한 `exit-kill`은 라운드 결과가 이미 정해졌다고 보고 이번 라운드 가치를 0으로 둔 채, 적 무기 가치 × 킬 확률에서 내 무기 가치와 궁극기 헌납을 죽을 확률만큼 뺀 값으로 판단한다.

구매도 같은 방식이다. 풀 바이, 포스 바이, 하프 바이, 에코 후보를 만들고, 이번 라운드 가치는 3편의 구매 매치업 표에서 `(이 구매 대 상대 구매의 실측 승률 − 0.5) × 2`로 구한다. 미래 가치는 `다음 라운드 승률 이점 + (풀 바이 대비 아낀 금액 ÷ 20,000) × 0.2`이고, 여기에 3편에서 구한 "에코한 팀의 다음 라운드 승률 0.598"이 들어간다. 매치 포인트에서는 미래 가중치가 0이다. 팀 비용 구간(풀 20,000, 하프 12,000, 에코 2,500)은 3편 기준선의 구매 단계 경계와 맞춰서, 엔진의 "풀 바이"와 기준선의 "full"이 같은 범위를 가리키게 했다.

## 경기 진행기에는 아직 일부만 연결했다

경기 진행기(`match-runner`)는 라운드가 끝난 뒤 크레딧 정산(`advanceTeamEconomy`)에만 이 엔진을 쓴다. 승리 보상, 로스 보너스, 설치 보상, 킬 보상이 여기서 계산된다. 구매는 아직 팀 단위의 간단한 규칙이다. 돈이 충분하면 Vandal과 헤비 아머, 부족하면 Spectre와 라이트 아머, 그것도 안 되면 에코다(피스톨 라운드는 Ghost 또는 Classic). 1편 경기 로그의 구매가 Classic, Spectre, Vandal 세 가지뿐인 이유다. 코치가 타임아웃 때 세이브·포스·풀을 지시하면 그걸 따른다(6편).

행동 후보 생성기(5편)에는 `EconomyEvaluator`를 받는 자리가 있다. 경제 엔진을 넘기면 세이브와 출구 킬 후보의 가치를 이 엔진으로 계산하고, 안 넘기면 임시 고정값을 쓴다. 지금 경기용 팀 정책(`packages/match-runner/src/setup.ts`)은 이걸 넘기지 않는다. 세이브·구매·출구 킬 판단을 경기에 연결하는 게 다음 단계다.

연결하면서 패키지 설정도 하나 고쳤다. 경제 엔진은 독립 패키지로 먼저 만들어져서 `package.json`이 빌드 결과물인 `./dist`를 가리키고 있었다. 다른 `@pv/*` 패키지처럼 `./src/index.ts`를 직접 가리키도록 19:37 커밋(`8aab3e1`)에서 바꾼 뒤에야 경기 진행기에서 크레딧 API를 쓸 수 있었다.

그 밖에 경제 상수를 현재 패치 기준으로 확인해서 `verified` 표시를 갱신하는 일, 궁극기 차단 계수를 데이터가 생기면 다시 맞추는 일이 남아 있다. 마스터 프롬프트의 설계가 가장 그대로 코드가 된 곳이 이 엔진이다. 프롬프트에 적힌 사례(오퍼레이터 보존, 클래식, 전반 마지막 라운드, 궁극기 1포인트)가 전부 테스트로 들어가 있다.

## 참고 자료

- [packages/economy-engine](https://github.com/2rangs/Project-VM/tree/main/packages/economy-engine)
- [docs/ECONOMY_MODEL.md](https://github.com/2rangs/Project-VM/blob/main/docs/ECONOMY_MODEL.md)
- [packages/match-runner/src/economy.ts](https://github.com/2rangs/Project-VM/blob/main/packages/match-runner/src/economy.ts)
- [packages/action-generator/src/generate.ts](https://github.com/2rangs/Project-VM/blob/main/packages/action-generator/src/generate.ts)
- [README.md 19~22장 (경제, 세이브, 궁극기, 출구 킬)](https://github.com/2rangs/Project-VM/blob/main/README.md)
