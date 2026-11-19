---
slug: project-v-calibration
title: PROJECT V 개발기 (11) 시뮬레이션 통계를 실제 VCT에 맞추기
summary: 시간 초과 61.8%, 공격 승률 19.7%에서 출발해, 교전 숫자는 건드리지 않고 원인을 하나씩 고쳐 판정 지표를 0/9에서 4/8까지 올린 보정 기록입니다.
tags: [PROJECT V, 게임 AI, 시뮬레이션]
series: PROJECT V 개발기
date: 2026-11-19T04:10:00.000Z
comment_term: blog-post-project-v-calibration
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 11편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `docs/WORK_HISTORY.md` 5장, `docs/research/SIM_BASELINE_2026-11-18.md`, `docs/research/HARNESS_REALISM_AUDIT.md`, `docs/research/FIRST_VALIDATION_RUN.md`와 각 수정 커밋의 diff를 근거로 썼습니다. 마지막 측정은 제가 이 글을 쓰면서 다시 돌린 결과입니다.

15:05에 main에 들어간 시뮬레이션은 경기를 끝까지 돌릴 수 있었지만, 거의 모든 라운드가 시간 초과로 끝났습니다.

이번 편은 그다음 열두 시간의 기록입니다.
3편에서 만든 채점기(`sim:batch`)로 20경기를 돌리고, 실제 VCT 통계와 비교하고, 가장 크게 벗어난 숫자의 원인을 고치고, 다시 돌리는 과정을 반복했습니다.
판정 지표 통과 수는 0/9에서 4/8까지 올라갔습니다.
한 지표를 고치면 다른 지표가 함께 움직이기 때문에, 매번 전체 지표를 다시 확인하면서 진행했습니다.

## 한눈에 보기

- 기준 스냅샷의 판정은 "0/9 judged — attacker-broken"이었습니다. 공격 승률 19.7%, 시간 초과 61.8%.
- **시간 초과**: 팀 정책이 500ms마다 모든 명령을 다시 뽑아서 4초짜리 설치가 매번 끊겼습니다. 스파이크 소지자와 해체 담당은 행동을 끝까지 유지하게 하자 61.8% → 0%가 됐고, 공격 승률은 61.7%로 올라갔습니다.
- **오프닝 듀얼**: 수비수가 결정의 약 28%에서 자리를 떠나 미리 조준하는 이점을 잃고 있었습니다. 홀드를 고정하고 입구를 겨누게 했습니다.
- **공격 61.7%의 원인**: 정책이 아니었습니다. 대본 정책끼리 붙여도 63.3%였습니다. 시나리오가 수비 5명을 사이트에 고정하고 스킬을 주지 않아서, 공격이 도착하면 국지적으로 5대2가 됐습니다.
- **스킬을 켜면**: 처음에는 공격 승률 1%였습니다. 시전 모델을 고치고 시전 빈도를 낮추자 41%가 됐습니다.
- **스파이크 폭발 0%**: 수비가 상황과 상관없이 항상 리테이크하고 있었습니다. 1대4 이상이면 포기하게 하자 0% → 9.0%(실측 8.2%).
- 보정 내내 지킨 원칙은 **라운드 통계를 맞추려고 교전 숫자를 바꾸지 않는다**는 것입니다.

## 채점표

3편에서 만든 판정 지표입니다.
실측 기준은 VCT Reference의 국제전 Ascent입니다.

| 지표 | 실측 | 허용 오차 |
| --- | --- | --- |
| 라운드 종료: 전멸 | 0.714 | ±0.04 |
| 라운드 종료: 해체 | 0.160 | ±0.04 |
| 라운드 종료: 폭발 | 0.082 | ±0.04 |
| 라운드 종료: 시간 초과 | 0.043 | ±0.04 |
| 공격 라운드 승률 | 0.509 | ±0.04 |
| 공격 측 오프닝 듀얼 승률 | 0.437 | ±0.04 |
| 구매 매치업(피스톨 대 피스톨, 풀 대 풀 등) | 칸마다 | ±0.05 |

기준 스냅샷(통합 브랜치 `482a304`, 20경기 461라운드)입니다.

| 지표 | 시뮬레이션 | 실측 |
| --- | --- | --- |
| 시간 초과 | **0.618** | 0.043 |
| 전멸 | 0.377 | 0.714 |
| 폭발 | 0.004 | 0.082 |
| 해체 | 0.000 | 0.160 |
| 공격 승률 | **0.197** | 0.509 |
| 공격 오프닝 듀얼 | 0.686 | 0.437 |

PV-2는 "공격이 첫 듀얼은 이기는데(0.686) 라운드는 진다(0.197)"고 진단했습니다.
총싸움은 이기는데 스파이크를 심지 못하고 시간을 다 쓴다는 뜻입니다.
그래서 "가장 큰 지렛대는 사이트 도달과 설치"라고 보고 여기서부터 시작했습니다.

참고로 1편의 "87%"는 2차 머지 뒤 세 경기(시드 42, 7, 99, 53라운드 중 46라운드)로 잰 값이고, 위 표의 61.8%는 20경기 배치로 잰 값입니다.
측정 방법이 달라서 이 글에서는 20경기 배치 값만 씁니다.

## 원칙: 교전 숫자는 건드리지 않는다

수정에 앞서 원칙이 정해져 있었습니다.
마스터 프롬프트 31장과 PV-4의 첫 검증 문서에 같은 내용이 있습니다.

> 교전 파라미터는 오프닝 듀얼로만 보정한다. 라운드 승률을 맞추려고 교전 파라미터를 왜곡하지 않는다.

공격 승률이 낮다고 명중률을 올리면 숫자는 빨리 맞출 수 있습니다.
하지만 공격이 지는 원인은 그대로 남고, 나중에 원인을 고치면 이번에는 공격이 너무 강해집니다.

PV-4는 7편에서 이미 이 원칙대로 작업했습니다.
대본 정책으로 첫 검증을 할 때 명중률 배율을 낮춰 오프닝 듀얼을 맞추자 공격 라운드 승률이 0.309에서 0.257로 떨어졌지만, 배율을 되돌리지 않고 원인(스파이크를 줍지 않는 정책)을 찾아 고쳤습니다.

이번 열두 시간 동안의 수정 커밋에도 메시지마다 "NO combat/engagement parameter touched."가 들어 있습니다.

## 1. 시간 초과: 500ms마다 바뀌는 행동

원인은 코어 세션(PV-3)이 찾았습니다.
팀 정책은 500ms마다 선수별 명령을 가중 추첨으로 다시 뽑습니다(6편).
스파이크 설치에는 4초가 걸리므로, 결정 여덟 번 연속으로 "설치"가 뽑혀야 설치가 끝납니다.

중간에 한 번이라도 "피킹"이나 "홀드"가 뽑히면 설치 진행도가 0으로 돌아갑니다.
로그에는 "dozens of plantStart, zero planted."가 남았습니다.
설치 시작은 수십 번인데 설치 완료는 0번이었습니다.

7초짜리 해체도 같은 이유로 끝나지 않았습니다.
처음에 스파이크 소지자만 고치자 모든 설치가 폭발로 끝났고, 경기가 공격 쪽으로 기울어 30대30 라운드 상한에 걸렸습니다.
그래서 수비 쪽도 함께 고쳤습니다.

```ts
// packages/team-engine/src/policy.ts — b739123 (commitSpikeCarrier 발췌)
    const holderId = view.spike.holderId;
    const phase = view.spike.phase;
    const canPlant = phase === "carried" || phase === "planting" || phase === "dropped";
    if (view.side !== "attack" || !holderId || !canPlant || strategy === "save") return out;

    const carrier = view.teammates.find((p) => String(p.id) === String(holderId) && p.alive);
    if (!carrier) return out;

    const carrierZone = this.spatial.nearestZone({ x: carrier.position.x, y: carrier.position.y });
    let command: ActionCommand;
    if (this.spatial.isPlantableZone(carrierZone)) {
      command = { playerId: carrier.id, kind: "plant", targetZone: carrierZone, executeAtMs: 0, sourceActionId: "carrier-commit:plant" };
    } else {
      const site = this.nearestPlantableSite(carrierZone);
      if (!site) return out;
      command = { playerId: carrier.id, kind: "move", targetZone: site, moveMode: "run", executeAtMs: 0, sourceActionId: "carrier-commit:move" };
    }
```

스파이크 소지자 한 명의 명령만 덮어씁니다.
설치 구역에 있으면 설치하고, 아니면 가장 가까운 설치 구역으로 달립니다.
나머지 네 명의 추첨은 그대로 둡니다.
에코 라운드에 혼자 설치하러 가지 않도록 `save` 전략일 때는 적용하지 않습니다.
해체 쪽(`commitDefuser`)도 같은 구조입니다.

결과(20경기, 428라운드)입니다.

| 지표 | 수정 전 | 수정 후 | 실측 |
| --- | --- | --- | --- |
| 시간 초과 | 61.8% | **0%** | 4.3% |
| 전멸 | — | 61.7% | 71.4% |
| 해체 | 0% | 38.3% | 16.0% |
| 폭발 | 0.4% | 0% | 8.2% |
| 공격 승률 | 19.7% | **61.7%** | 50.9% |
| 공격 오프닝 듀얼 | 68.6% | 75.0% | 43.7% |
| 판정 통과 | 0/9 | 2/8 | — |

시간 초과는 해결됐고, 이번에는 공격 승률이 실측보다 높아졌습니다.
또 모든 라운드에서 설치가 일어나고 폭발은 0이 됐습니다.
폭발 비율은 5절에서 다시 다룹니다.
설치 사이트가 B로 쏠리는 문제는 6편에서 다뤘습니다.

## 2. 오프닝 듀얼: 자리를 지키지 않는 수비수

다음으로 크게 벗어난 지표는 오프닝 듀얼(공격 75.0%, 실측 43.7%)이었습니다.

교전 엔진은 멈춰 있는 수비수에게 미리 조준하는 이점을 줍니다(7편).
`preAim = 적을 봤고 && 적은 나를 못 봤고 && 멈춰 있음`.
PV-4가 만든 진단 도구(`engagementTrace`)로 첫 교전 순간의 자세를 보니, 대본 정책의 수비수는 첫 교전 때 움직이고 있는 비율이 0%였고 PV-3 팀 정책의 수비수는 100%였습니다.

원인은 이번에도 추첨이었습니다.
설치 전 결정의 약 28%에서 수비수가 "이동"이나 "세이브"를 뽑아 앵커 자리를 떠났습니다.
자리를 지키는 대본 정책은 공격 오프닝을 0.45 정도로 막았고, 팀 정책은 0.75를 내줬습니다.

수정은 세 단계로 들어갔습니다.

1. `630e01c`: 홀드 계열 전략(기본 수비, A 스택, B 스택)이고 설치 전이면, 수비수의 이동·세이브를 홀드로 바꿉니다. "전진(aggroPush)"은 의도적인 푸시이므로 추첨에 맡깁니다.
2. `0e4f82d`: 홀드하는 수비수는 입구를 `aimZone`으로 겨눕니다(7편의 바라보는 방향 수정을 사용).
3. `bc5bc88`: 7편의 피커 이점(210ms)이 들어간 뒤로는 피킹하는 수비수가 움직이는 쪽이 되어 불리해졌습니다. 그래서 피킹도 홀드로 바꿨습니다.

```diff
// git show bc5bc88 -- packages/team-engine/src/policy.ts
-      // Hold the angle: a move/save off the anchor trades away the pre-aim edge. Peeks (stationary
-      // info) and ability use are kept. ...
-      if (c.kind !== "move" && c.kind !== "save") return c;
+      // Hold the angle: move/save/peek off the anchor all trade away the pre-aim edge, and under
+      // the peeker-advantage calibration a peeking defender becomes the worse-positioned mover, so
+      // convert them to a hold. Ability use is kept. `aimZone` faces the defender at the entry choke
+      // for the pre-aim first-contact edge (a targetZone would face them at their own zone).
+      if (c.kind !== "move" && c.kind !== "save" && c.kind !== "peek") return c;
```

세 번째 단계는 엔진 쪽(PV-4)에서 피커 이점을 넣은 결과, 정책 쪽(PV-3)의 선택을 다시 조정한 경우입니다.
실제 발로란트에서도 수비수가 먼저 피킹하면 불리하니, 현실과도 맞는 방향입니다.

4차 머지(20:00) 뒤의 숫자입니다(20경기, 445라운드).

| 지표 | 기준 | 현재 | 실측 | 판정 |
| --- | --- | --- | --- | --- |
| 전멸 | 0.377 | 0.710 | 0.714 | 통과 |
| 시간 초과 | 0.618 | 0.034 | 0.043 | 통과 |
| 풀 대 풀 | 0.237 | 0.487 | 0.500 | 통과 |
| 공격 승률 | 0.197 | 0.587 | 0.509 | 실패 |
| 공격 오프닝 듀얼 | 0.686 | 0.575 | 0.437 | 실패 |
| 해체 | 0.000 | 0.256 | 0.160 | 실패 |
| 폭발 | 0.004 | 0.000 | 0.082 | 실패 |

판정 3/8입니다.
전멸 비율 0.710은 실측 0.714와 거의 같아졌습니다.
5차 머지 이후(피커 이점 재보정 포함) 오프닝 듀얼은 0.474로 내려와 통과했습니다.

## 3. 공격 승률 62%의 원인 찾기

5차 머지(20:44) 뒤에도 공격 승률은 0.619로, 실측 0.509보다 11%p 높았습니다.
PV-3는 원인을 좁히기 위해 **팀 정책을 빼고 대본 정책끼리 붙여 봤고**, 결과는 0.633이었습니다.

정책을 바꿔도 공격 승률이 같으니 원인은 정책 밖에 있었습니다.
PV-2가 하네스 현실성 감사(`HARNESS_REALISM_AUDIT.md`)로 원인을 정리했습니다.

- 시나리오가 수비 5명을 처음부터 사이트에 고정 배치했습니다(A에 2명, B에 2명, 미드에 1명).
- 경기 진행기가 스킬 없이 라운드를 돌렸습니다. 연막, 섬광, 몰리가 모두 없었습니다.
- 그래서 공격 5명이 한 사이트에 도착하면 그곳 수비는 2명이었습니다. **국지적 5대2**입니다.

감사의 결론은 "엔진이나 정책의 버그가 아니라 하네스 현실성의 공백"이었습니다.
측정 정의도 함께 점검했는데, 공격 승률, 종료 사유 분류, 첫 킬 정의는 실측과 1:1로 같았습니다.
정의는 같고 조건(스킬, 수비 배치)이 다르다는 뜻입니다.

그래서 보고 규칙을 하나 정했습니다.

> 스킬이 켜지고 수비 셋업이 다양해지기 전까지, sim-batch 수치는 "기준 대비 추세"로만 읽는다. 실측에 보정된 값으로 읽지 않는다.

이 연재의 숫자도 같은 방식으로 읽어야 합니다.
4/8은 실제 VCT와 절반이 일치한다는 뜻이 아니라, 처음보다 네 개 지표가 실측 범위 안으로 들어왔다는 뜻입니다.

PV-2는 수비 셋업 데이터를 세 가지(`standard-2-1-2`(가중치 2), `a-stack-3-1-1`, `mid-control-2-2-1`) 만들고, 라운드마다 시드로 결정적으로 고르게 했습니다.
이 셋업은 스킬을 켰을 때만 적용합니다.

## 4. 스킬을 켜면

스킬을 켜면 반대로 수비가 크게 유리해졌습니다.
6편에서 소개한 경기 진행기 주석에도 "스킬을 켜면 수비가 압도적이 된다(공격 승률 약 0.02)"라고 적혀 있고, 처음 측정값은 약 1%였습니다.

### 시전 모델

7편에서 다룬 내용입니다.
PV-3가 시전 효과만 분리해 측정해 보니(300시드, 멀리 던지는 정찰 스킬), 공격만 시전하면 공격 오프닝 0.007, 수비만 시전하면 0.987이었습니다.
스킬 시전이 결정 틱의 행동 전체를 차지하고 있었기 때문입니다.
PV-4가 시전 모델을 "시전 시간(windup) 동안만 무기를 못 든다"로 바꿨습니다(`782030d`).

### 시전 빈도 조정

다음은 정책 쪽 조정입니다(`61b6d70`).

```ts
// packages/team-engine/src/player-policy.ts (61b6d70)
  // Casting occupies the weapon (windup) — over-casting loses duels. Keep stochastic ability use
  // RARE so it reads as opportunistic; coordinated execute/retake utility goes through the policy's
  // commitAttackUtil/defender paths, not this draw.
  if (kind === "individual.useAbility") w *= 0.25;
```

1. 선수 개인 추첨에서 스킬 가중치를 0.25배로 줄여, 아무 때나 스킬을 쓰지 않게 했습니다.
2. 진입 유틸은 추첨 대신 팀 정책의 확정 경로(`commitAttackUtil`)로 조율합니다. 진입 시점 기준 3.5초, 7초 창 안에, 2편의 전술 지식 베이스에서 가져온 연막 목표(`SMOKE_TARGETS`)를 씁니다.
3. 설치 후에는 3초 안에 닿는 공격수들이 스파이크 구역을 겨누고 홀드합니다(`commitPostPlantContest`).

결과(20경기, 스킬 켬): 공격 0.197 → **0.411**, 해체 0 → 0.160 **통과**.
오프닝은 0.647로 아직 높았고, 폭발은 0이었습니다.

### 스파이크 소지자 바꾸기

`1867674`에서는 역할 배치를 조정했습니다.
스킬을 켰을 때 스파이크를 컨트롤러(atk1, Omen)가 들고 있었는데, 1절의 수정으로 스파이크 소지자는 곧바로 설치하러 가기 때문에 진입 연막을 칠 수 없었습니다.

그래서 스킬을 켰을 때는 센티넬(atk4)이 스파이크를 들게 하고, 진입 연막 목표에 앞쪽 입구를 추가했습니다(A 사이트는 A 메인·래프터·와인, B 사이트는 B 메인·보트하우스).
결과는 오프닝 0.453 통과, 해체 0.23, 공격 0.269였습니다.

### 6차 머지 시점의 상태

6차 머지(21:03) 시점의 정리입니다.

| 설정 | 공격 승률 | 비고 |
| --- | --- | --- |
| 스킬 끔 (기본값) | 0.619 | 판정 3/8 |
| 스킬 켬, 셋업 끔 | 0.41 | |
| 스킬 켬, 셋업 켬 | 0.25 | 오프닝 0.469 통과 |

목표는 "공격 승률 0.45~0.56과 판정 3/8 이상을 동시에" 만족하는 것이었고, 이 시점에는 아직 달성하지 못했습니다.
셋업 가중치, 유틸 위력, 진입 유틸을 함께 조정해야 하는 과제로 남겼고, 스킬은 지금도 기본값이 꺼짐입니다.

이 과정에서 지킨 규칙이 하나 있습니다.
**스킬 켬 경로의 변경은 스킬 끔 결과를 바이트 단위로 바꾸지 않는다.**
커밋마다 "abilities-off byte-unchanged"를 확인했기 때문에, 스킬 쪽 실험을 계속해도 기본 시뮬레이션의 3/8은 그대로 유지됐습니다.

## 5. 스파이크 폭발 비율 맞추기

남은 큰 차이는 폭발이었습니다.
실측에서는 라운드의 8.2%가 스파이크 폭발로 끝나는데, 시뮬레이션은 스킬 설정이나 정책과 관계없이 **0**이었습니다.

6차 머지 뒤에는 "정책이 아니라 시뮬레이터 구조(설치 후 스파이크 타이머 대 리테이크 타이밍) 문제로 추정. 다음 스프린트 1순위(PV-4)"라고 기록했습니다.
실제 원인은 정책 쪽, 1절의 `commitDefuser`였습니다.
해체가 끊기지 않도록 해체 담당을 고정했는데, 이 규칙이 상황과 관계없이 **항상** 리테이크를 하게 만들었습니다.
수비가 항상 해체하러 가면 설치 라운드는 해체 성공이나 수비 전멸로만 끝나고, 폭발은 나올 수 없습니다.

실제 프로 경기에서 스파이크가 터지는 라운드는 대부분 수비가 리테이크를 **포기한** 라운드입니다.
1대4로 남은 수비수는 해체하러 가지 않고 무기를 지키며 물러납니다.
4편의 세이브 계산이 다루는 상황이 바로 이것입니다.

수정(`b00eaa2`, 8차 머지)은 리테이크 가능성 판단입니다.

```ts
// packages/team-engine/src/policy.ts (b00eaa2)
   * Threshold sweep (sim-batch, 20 matches, Ascent): 1v3+ → 12.8% detonations, 1v4+ → 9.0%,
   * down-3 → 24%; real 8.2%, so the lone-defender 1v4+ rule is used.
   */
  private retakeViable(view: PolicyView, defendersAlive: number, defuserTravelMs: number): boolean {
    const timer = view.spike.detonationInMs;
    if (timer != null && defuserTravelMs + DEFUSE_DURATION_MS > timer) return false;
    const attackers = view.knownEnemyAliveCount;
    if (attackers == null) return true;
    return !(defendersAlive <= 1 && attackers >= LONE_SAVE_MIN_ATTACKERS);
  }
```

아래 조건 중 하나라도 맞으면 해체를 포기하고 수비 스폰으로 물러납니다.

- (a) 해체 담당이 스파이크까지 가는 시간 + 해체 7초가 폭발까지 남은 시간보다 길 때.
- (b) 수비 1명 대 공격 4명 이상일 때.

난수를 쓰지 않는 결정적 규칙이고, 결정마다 다시 평가합니다.
물러나다 킬을 따서 인원이 바뀌면 다시 리테이크를 갑니다.

(b)의 임계값은 `sim:batch`로 세 가지 후보를 돌려 보고 실측에 가장 가까운 것을 골랐습니다.

| 포기 조건 | 폭발 비율 |
| --- | --- |
| 1대3 이상 | 12.8% |
| **1대4 이상** | **9.0%** |
| 3명 이상 열세 | 24% |
| 실측 | 8.2% |

규칙 후보를 몇 개 만들고, 같은 20경기에 돌리고, 실측에 가까운 것을 고르는 것이 3편에서 채점기를 만든 목적이었습니다.

결과(20경기, 410라운드): 폭발 0.000 → **0.090 통과**, 판정 3/8 → **4/8**.
공격 승률은 0.617로 거의 그대로였고, 시간 초과·오프닝·피스톨은 통과를 유지했습니다.
스킬을 켠 경우는 1/8 → 2/9가 됐습니다.

## 지금 숫자

이 글을 쓰면서 저장소를 새로 받아 같은 명령을 돌렸습니다.

```bash
pnpm sim:batch --matches 20
```

```text
sim:batch summary (20 matches, 410 rounds, 2 to OT, 13.7s)
  attack round win rate : 61.7%  (253/410)
  pistol attack win rate: 47.5%  (19/40)
  round-end reasons     :
     elimination      312  (76.1%)
     spikeDefused     42  (10.2%)
     spikeDetonation  37  (9.0%)
     timeExpired      19  (4.6%)

4/8 judged metrics passed; 39 reported-only.
```

| 지표 | 시뮬레이션 | 실측 | 판정 |
| --- | --- | --- | --- |
| 전멸 | 0.761 | 0.714 | 실패 |
| 폭발 | 0.090 | 0.082 | 통과 |
| 해체 | 0.102 | 0.160 | 실패 |
| 시간 초과 | 0.046 | 0.043 | 통과 |
| 공격 승률 | 0.617 | 0.509 | 실패 |
| 공격 오프닝 듀얼 | 0.463 | 0.437 | 통과 |
| 피스톨 대 피스톨 | 0.475 | 0.500 | 통과 |
| 풀 대 풀 | 0.614 | 0.500 | 실패 |

8차 머지 때 기록된 숫자와 정확히 같습니다.
결정론 덕분에 다른 컴퓨터에서 하루 뒤에 돌려도 같은 결과가 나옵니다.

참고용 지표(reported-only) 중에는 **5대3 상황 공격 승률 0.981**이 있습니다.
설치 후 리테이크 교전에서 공격 우위가 크다는 신호로 보이고, 해체 비율이 실측보다 낮은 것(0.102 대 0.160)과 같은 방향입니다.
3편에서 말한 대로 실측에는 인원 우위 승률 데이터가 없어서 이 값은 판정하지 않습니다.

## 정리

열두 시간 동안의 주요 수정은 다섯 개입니다.

| 수정 | 대상 지표 |
| --- | --- |
| 스파이크 소지자 고정 | 시간 초과 |
| 해체 담당 고정 | 시간 초과 |
| 수비 홀드 고정 | 오프닝 듀얼 |
| 스킬 켬일 때 센티넬이 스파이크 | 스킬 켬 진입 |
| 리테이크 포기 규칙 | 폭발 |

다섯 개 중 네 개는 500ms마다 다시 추첨하는 선수의 행동을 특정 상황에서 고정하는 규칙입니다.
6편의 팀 엔진은 매 순간 행동을 새로 고르는 구조인데, 실제 경기에서는 한번 정한 행동을 끝까지 하는 경우가 많습니다.
그 차이를 확정 규칙으로 하나씩 메웠습니다.

보정 내내 지킨 원칙은 다음과 같습니다.

1. 라운드 통계를 맞추려고 교전 숫자를 바꾸지 않는다.
2. 보정값은 모든 정책에 하나("one truth").
3. 실험 경로(스킬 켬)는 기본 결과를 바이트 단위로 바꾸지 않는다.
4. 새 규칙은 난수를 쓰지 않아서 기존 난수열을 보존한다.
5. 정의가 같아도 조건이 다르면 "추세로만" 읽는다.

이 원칙 덕분에 4/8은 숫자를 억지로 맞춘 결과가 아니라, 원인을 하나씩 고친 결과입니다.

## 남은 과제

- **의도를 유지하는 정책.** 확정 규칙들을, 한번 A 진입을 부르면 진입이 끝날 때까지 계획을 유지하고 진입수 사망이나 적 로테이션 같은 사건이 있을 때만 다시 고르는 구조로 바꿉니다. 6편의 설치 사이트 쏠림도 이 작업으로 함께 풀 계획입니다.
- **나머지 판정 지표 넷.** 공격 승률, 전멸, 해체, 풀 대 풀. 해체 비율은 위의 리테이크 교전 공격 우위부터 살펴볼 계획입니다.
- **스킬 기본값 켜기.** 공격 승률 0.45~0.56과 판정 3/8 이상을 동시에 만족시키는 것이 목표입니다.

다음 편이 마지막입니다.
AI 세션 여섯에게 게임 엔진을 맡겨 보고 배운 것을 정리합니다.

## 참고 자료

- [docs/WORK_HISTORY.md 5장 (main 머지 기록)](https://github.com/2rangs/Project-VM/blob/main/docs/WORK_HISTORY.md)
- [docs/research/SIM_BASELINE_2026-11-18.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/SIM_BASELINE_2026-11-18.md)
- [docs/research/HARNESS_REALISM_AUDIT.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/HARNESS_REALISM_AUDIT.md)
- [docs/research/FIRST_VALIDATION_RUN.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/FIRST_VALIDATION_RUN.md)
- [docs/VALIDATION_BASELINES.md](https://github.com/2rangs/Project-VM/blob/main/docs/VALIDATION_BASELINES.md)
- [packages/team-engine/src/policy.ts](https://github.com/2rangs/Project-VM/blob/main/packages/team-engine/src/policy.ts)
- [tools/data-validator/scripts/sim-batch.mts](https://github.com/2rangs/Project-VM/blob/main/tools/data-validator/scripts/sim-batch.mts)
