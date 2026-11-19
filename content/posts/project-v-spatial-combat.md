---
slug: project-v-spatial-combat
title: 구역 그래프 위의 시야, 소리, 총싸움
summary: Ascent 22개 구역 그래프, 110도 시야와 구역 단위 소리, 먼저 본 쪽이 이기는 결정적 교전, 몰리와 시전 모델. 라운드 시뮬레이터를 만들며 찾은 버그들입니다.
tags: [PROJECT V, 게임 AI, 시뮬레이션]
series: PROJECT V 개발기
date: 2026-11-19T04:06:00.000Z
comment_term: blog-post-project-v-spatial-combat
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 7편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `docs/handoffs/PV-4-spatial.md`, `docs/handoffs/ROUND_EXECUTION_API.md`, `docs/research/FIRST_VALIDATION_RUN.md`와 `packages/spatial-engine`, `perception-engine`, `combat-engine`, `ability-engine`, `round-simulator`의 코드를 근거로 썼습니다.

5편과 6편은 두뇌 이야기였습니다.
이번 편은 몸과 무대 이야기입니다.
선수가 어디에 서 있고, 어디로 갈 수 있고, 무엇이 보이고 들리고, 총을 쏘면 맞는지.

이 부분을 맡은 공간 세션(PV-4)은 여섯 세션 중 가장 먼저 커밋했습니다(08:49).
그리고 연재 전체에서 가장 많은 "발견된 버그"를 남긴 세션이기도 합니다.
스폰을 관통하는 경로, 자기 얼굴에 연막을 던지는 AI, 엉뚱한 방향을 보고 서 있는 수비수, 스킬을 쓰는 순간 지는 선수.
모두 이 엔진 위에서 드러났습니다.

## 한눈에 보기

- 맵은 NavMesh가 아니라 **콜아웃 구역 그래프**입니다. Ascent 22개 구역, 32개 간선, 설치 구역 2개. 구역 좌표는 valorant-api의 실제 값이고, 간선과 시야선은 사람이 손으로 근사한 값입니다.
- 지각 엔진은 시야(110°, 45m), 소리(구역 간 감쇠), 기억(반감기 5초), 콜아웃(지연 600ms)을 모델링합니다. 소리는 정확한 좌표가 아니라 **구역 중심**으로만 위치를 알려 줍니다.
- 교전 엔진은 반응 시간 → 발사 간격 → 명중 판정 → 부위 → 거리별 피해 → 실드와 체력 순서로 타임라인을 만듭니다. 테스트로 "정보가 능력치를 이긴다"를 확인했습니다. 능력치 0.4인 선수가 먼저 보고 조준하고 있으면, 능력치 0.95인 선수를 이깁니다.
- 스킬 엔진은 연막, 섬광, 정찰, 몰리, 벽, 침묵, 대시를 효과 객체로 다룹니다. 정찰로 드러난 적 위치는 **그 순간의 사본**이라 이후 움직임이 새지 않습니다.
- 라운드 시뮬레이터는 100ms 틱, 500ms마다 팀 결정을 하는 결정적 5v5 루프입니다. 1,000라운드에 라운드당 약 20~24ms입니다.
- 오프닝 듀얼을 실측(공격 0.437)에 맞추기 위해 명중률 배율을 1.00 → 0.65 → 0.50으로 내리고, 피커 이점 210ms를 추가했습니다.

## 맵: 구역 그래프

Ascent를 엔진에 넣는 첫 번째 방법으로 PV-4는 NavMesh 대신 그래프를 택했습니다.
이유는 단순합니다.
08:49에는 아직 Blender 맵을 받을 수 없었습니다(8편에서 PV-5가 받습니다).
쓸 수 있는 것은 valorant-api의 맵 정보뿐이었습니다.

### 좌표계

valorant-api는 Ascent에 대해 콜아웃 22개의 게임 좌표 `(x, y, z)`와, 게임 좌표를 미니맵 좌표로 바꾸는 계수 네 개를 줍니다.

```json
"xMultiplier": 0.00007, "yMultiplier": -0.00007,
"xScalarToAdd": 0.813895, "yScalarToAdd": 0.573242
```

그런데 이 계수를 어떻게 적용해야 하는지는 적혀 있지 않습니다.
PV-4는 실험으로 찾았습니다.
**축을 바꿔서** 적용했을 때만 콜아웃 22개가 전부 미니맵의 [0, 1] 범위 안에 들어왔습니다.

```ts
// packages/spatial-engine/src/coordinate.ts
  /** game (x,y[,z]) -> normalized minimap (x,y) in [0,1]. */
  toMinimap(game: Vec2 | Vec3): Vec2 {
    return {
      x: game.y * this.t.xMultiplier + this.t.xScalarToAdd,
      y: game.x * this.t.yMultiplier + this.t.yScalarToAdd,
    };
  }
  /** normalized minimap (x,y) -> game (x,y). z cannot be recovered. */
  toGame(minimap: Vec2): Vec2 {
    return {
      y: (minimap.x - this.t.xScalarToAdd) / this.t.xMultiplier,
      x: (minimap.y - this.t.yScalarToAdd) / this.t.yMultiplier,
    };
  }
```

미니맵 x에 게임 y가, 미니맵 y에 게임 x가 들어갑니다.
왕복 변환 오차는 9.1e-13입니다.
단위는 100uu = 1m로 잡았습니다(언리얼 엔진 관례).
3편에서 말한 "미니맵 좌표 때문에 공격 스폰 선수 전원이 B 메인에 서 있던" 사고는, 이 변환을 쓰지 않고 다른 방식으로 변환한 쪽에서 났습니다.

### 그래프

`ascent.source.json`을 사람이(정확히는 PV-4 세션이) 손으로 작성하고, 빌드 스크립트가 거리와 이동 시간을 계산해 `ascent.navgraph.json`을 만듭니다.

| 항목 | 값 | 출처 |
| --- | --- | --- |
| 구역 | 22개 | valorant-api 실제 좌표 |
| 간선 | 32개 | 수동 근사 |
| 설치 구역 | 2개(사각형) | 수동 근사 |
| 시야선 | 11개 | 수동 근사 |
| 소리 연결 | 6개 | 수동 근사 |
| 달리기 / 걷기 속도 | 6.75 / 3.4 m/s | 문서화된 기본 속도 / 근사 |

처음 간선 길이는 구역 중심끼리의 직선거리였습니다.
실제 경로는 벽을 돌아가야 하니 이건 하한값입니다.
공격 스폰에서 A 사이트까지 93.7m(13.9초), B 사이트까지 83.4m(12.4초).
6편의 "스파이크는 항상 가까운 B로 간다"의 뿌리가 이 숫자입니다.

### 첫 번째 버그: 스폰을 관통하는 길

v0에서 A 사이트에서 B 사이트로 가는 최단 경로가 **수비 스폰을 지나갔습니다.**
그래프상으로는 그게 가장 짧았기 때문입니다.
실제 게임에서 공격 팀은 수비 스폰에 들어갈 수 없습니다.

고친 방법은 스폰 구역에 `transit: false`를 붙이는 것입니다.
스폰은 출발지나 목적지는 될 수 있지만, 지나가는 길은 될 수 없습니다.
경로는 `A 사이트 → A 가든 → 미드 커비 → 미드 하단 → 마켓 → B 사이트`가 됐습니다.

```ts
// packages/spatial-engine/src/pathfinding.ts (발췌)
    const passable = (id: string): boolean => {
      if (id === startId || id === goalId) return true;
      if (blocked && blocked.has(id)) return false;
      return allowNonTransit || this.transit.get(id) === true;
    };
    ...
      for (const e of this.adj.get(current)!) {
        if (!passable(e.to)) continue;
        // base travel time + any hazard cost for entering e.to (0 for a non-hazard zone, and
        // never for the goal — arriving at your destination isn't "passing through" a hazard).
        const hazard = hazardCosts && e.to !== goalId ? hazardCosts.get(e.to) ?? 0 : 0;
        const tentative = g + this.edgeTimeMs(e, mode) + hazard;
        ...
      }
```

경로 탐색은 A*입니다.
간선 비용은 이동 시간이고, 휴리스틱은 목표까지의 직선 이동 시간입니다.
간선이 직선보다 짧을 수 없으니 휴리스틱이 과대평가하지 않아서 최적 경로가 보장됩니다.
노드가 22개뿐이라 열린 집합은 우선순위 큐 대신 그냥 선형 탐색합니다.
`hazardCosts`는 뒤에서 나올 몰리 이야기입니다.

## 지각: 무엇이 보이고 들리나

5편에서 "누가 누구를 볼 수 있는가는 오라클이 판단한다"고 했습니다.
그 오라클의 실제 구현이 지각 엔진입니다.

### 시야

```ts
// packages/perception-engine/src/vision.ts
export function canSee(observer: PlayerState, target: PlayerState, ctx: VisionContext): boolean {
  if (!target.alive || !observer.alive) return false;
  if (observer.id === target.id) return false;
  const distance = dist3(observer.position, target.position);
  if (distance > ctx.params.vision.maxViewDistanceUnits) return false;
  const angle = facingAngleTo(observer.facing, observer.position, target.position);
  const halfFovRad = (ctx.params.vision.halfFovDeg * Math.PI) / 180;
  if (angle > halfFovRad) return false;
  const zo = ctx.spatial.nearestZone(observer.position).id;
  const zt = ctx.spatial.nearestZone(target.position).id;
  if (zo === zt) {
    return ctx.params.vision.sameZoneAlwaysVisible;
  }
  return ctx.spatial.hasLineOfSight(zo, zt, { smokedPairs: ctx.smokedPairs as Array<[string, string]> });
}
```

1. 둘 다 살아 있어야 합니다.
2. 거리가 45m 이내여야 합니다.
3. 바라보는 방향에서 55° 이내(시야각 110°)여야 합니다. 바라보는 방향이 없으면 등 뒤로 취급합니다.
4. 같은 구역이면 보입니다.
5. 다른 구역이면 두 구역 사이에 시야선이 있어야 하고, 그 시야선이 연막으로 막혀 있지 않아야 합니다.

5번이 중요합니다.
시야선이 정의되지 않은 구역 쌍은 **보이지 않는 것**으로 처리합니다.
5편의 `BLIND_ORACLE`과 같은 원칙입니다.
모르면 못 보는 쪽으로.

그리고 이 원칙에는 대가가 있습니다.
시야선은 11개뿐입니다.
22개 구역 쌍 231개 중 11개만 서로 보인다는 뜻입니다.
실제 Ascent는 이보다 훨씬 많은 각도에서 서로가 보입니다.
8편에서 PV-5가 실제 벽으로 시야를 재 봤는데, 그 결과도 흥미롭습니다.

연막은 구역 단위로 근사합니다.
연막이 떨어진 곳에서 가장 가까운 구역을 찾고, 그 구역에 닿는 모든 시야선을 막습니다.
연막의 부피와 선분의 교차를 계산하지는 않습니다.

### 소리

소리는 원형 반경이 아니라 그래프로 퍼집니다.
소리 연결 6개에 각각 감쇠율이 있고(A 메인↔A 사이트 0.2, A 사이트↔A 가든 0.4 등), 한 칸 건널 때마다 `(1 − 감쇠율)`을 곱합니다.
세기가 0.1 아래로 떨어지면 들리지 않습니다.

소리마다 크기와 들리는 기준이 다릅니다.

| 소리 | 크기 | 들리는 기준 |
| --- | --- | --- |
| 총소리 | 1.0 | 0.1 |
| 발소리 | 0.8 | 0.45 |
| 설치·해체 | 0.75 | 0.25 |
| 스킬 | 0.7 | 0.3 |
| 재장전 | 0.5 | 0.6 |

발소리는 **달리는** 선수만 냅니다.
걷기, 앉기는 조용합니다.
발로란트에서 시프트를 누르고 걷는 이유가 그대로 들어가 있습니다.

그리고 들린 소리는 **소리가 난 구역의 중심**으로만 위치를 알려 줍니다.
"B 메인 어딘가에서 발소리"는 알 수 있지만, 정확한 좌표는 모릅니다.

### 기억과 콜아웃

본 적의 기억은 시간이 지나면 흐려집니다.

```text
확신도 = 0.5 ^ (경과 시간 / 5초)
```

반감기 5초, 확신도가 0.1 아래로 떨어지면 잊습니다.
계산하면 약 16.6초 뒤입니다.
기억에 남는 것은 "마지막으로 본 위치"뿐이고, 실제 위치는 절대 아닙니다.

동료에게 알리는 콜아웃은 새로 본 적만 대상이고, 팀에 전달되기까지 600ms가 걸립니다.
죽은 선수가 마지막에 남긴 콜아웃은 팀에 남습니다.

이 엔진의 테스트 17개 중 핵심은 누출 테스트입니다.
관측 결과를 JSON으로 직렬화해서, 보이지 않는 적의 좌표가 문자열로라도 들어 있는지 검사합니다.
적이 움직인 뒤에는 `lastSeenPosition`만 남아 있어야 합니다.

## 교전: 결정적이지만 미리 정하지 않은 총싸움

교전 엔진의 원칙은 두 줄입니다.

- 승자와 킬까지 걸리는 시간을 미리 정하지 않는다(DECISION-002).
- 능력치만으로 교전을 결정하지 않는다(마스터 프롬프트 29장).

`resolveDuel(duel, seed)`는 두 선수의 교전을 타임라인으로 펼칩니다.

1. 각자 언제 반응하는가(반응 시간)
2. 무기의 발사 간격마다 한 발씩
3. 명중 판정
4. 맞았다면 어느 부위인가(머리, 몸, 다리)
5. 거리 구간별 피해량
6. 실드 먼저, 그다음 체력
7. 탄창이 비면 재장전

선수마다 **자기만의 난수 스트림**이 있습니다(`deriveSeed(seed, 선수id)`).
한쪽의 명중 판정이 늘어나도 다른 쪽의 난수가 밀리지 않습니다.
5편의 스트림 분리가 교전 안에서도 쓰입니다.
제한 시간은 12초이고, 동시에 죽으면 먼저 정의된 쪽이 이깁니다.

### 반응 시간

```text
준비 시점 = 적을 본 시점 + 기본 반응 × 반응 배율 + 섬광 효과
기본 반응 = 조준 중이면 30ms, 아니면 260ms에서 140ms 사이(반응 능력치로 보간)
섬광      = 눈이 먼 상태면 남은 섬광 시간 + 700ms
```

미리 조준하고 있던(pre-aim) 선수는 30ms 만에 쏩니다.
그렇지 않으면 반응 능력치에 따라 140~260ms가 걸립니다.

### 명중률

```ts
// packages/combat-engine/src/skills.ts (hitChance 본문)
  let chance = p.accuracy.pointBlank;
  chance *= lerp(0.5, 1.1, shooter.skills.aim);
  if (isFirstShot) {
    chance += lerp(0, 0.1, shooter.skills.firstBulletAccuracy);
    if (shooter.posture.preAim) chance += p.accuracy.preAimFirstShotBonus;
  }
  const over = Math.max(0, distanceMeters - weaponComfortRange(shooter.weapon));
  chance -= over * p.accuracy.rangeFalloffPerMeter;
  if (shooter.posture.moving) {
    const movingMult = p.accuracy.movingPenalty + (1 - p.accuracy.movingPenalty) * shooter.skills.movement * 0.5;
    chance *= movingMult;
  }
  if (shooter.posture.flashBlindMs > 0) chance *= p.accuracy.flashedAccuracy;
  chance *= 1 - clamp(target.posture.behindCover, 0, 1);
  if (target.posture.moving) chance *= lerp(0.7, 1, shooter.skills.tracking);
  chance *= cal.hitChanceScale ?? 1;
  return clamp(chance, p.accuracy.minHitChance, p.accuracy.maxHitChance);
```

풀어 쓰면 이렇습니다.

- 기본 0.9에 조준 능력치에 따라 0.5~1.1배
- 첫 발이면 첫발 정확도에 따라 +0~0.1, 미리 조준 중이면 +0.15
- 무기의 적정 거리를 넘으면 1m마다 −0.012
- 쏘는 사람이 움직이면 0.55배 근처(무빙 능력치로 약간 회복)
- 섬광에 맞았으면 0.15배
- 표적이 엄폐 중이면 그만큼 깎임
- 표적이 움직이면 트래킹 능력치에 따라 0.7~1배
- 마지막으로 보정 배율 `hitChanceScale`
- 0.05~0.98로 자름

헤드샷 확률은 크로스헤어 능력치에 따라 0.05~0.45, 움직이면 절반, 섬광이면 0.2배입니다.
3편의 선수 능력치(조준, 첫발 정확도, 크로스헤어, 반응, 트래킹)가 들어가는 곳이 바로 여기입니다.
그리고 3편에서 "알 수 없다"고 `null`로 남긴 무빙과 무기 제어는 여기서 평균값 0.6으로 대신합니다.

### 정보가 능력치를 이긴다

몬테카를로로 확인한 결과가 핸드오프 문서에 남아 있습니다.

| 상황 | 승률 |
| --- | --- |
| 미리 조준한 쪽 | 0.82 |
| Vandal 대 SMG, 42m | 0.91 |
| Vandal 대 SMG, 8m | 0.52 |
| 섬광에 맞은 쪽 | 0.00 |

그리고 테스트로 고정된 것이 하나 있습니다.
**능력치 0.4인 선수가 먼저 보고 미리 조준하고 있으면, 능력치 0.95인데 250ms 늦게 본 선수를 18m에서 절반 넘게 이긴다.**
"OVR이 높으면 이긴다"가 아니라 "먼저 보고 준비된 쪽이 이긴다"가 엔진의 기본 성질이라는 뜻입니다.
이 성질 때문에 위치와 시야, 즉 판단이 의미를 갖습니다.

라이선스 이야기도 하나 있습니다.
2편의 감사 결과에 따라, valorant-api에서 받은 실제 무기 수치는 커밋하지 않습니다.
테스트는 근사치 파일(`weapons.manual-approx.json`)을 쓰고, 실제 값은 `npm run fetch-weapons`로 각자 받아서 gitignore된 파일에 둡니다.

## 스킬: 효과 객체

스킬 엔진은 스킬을 밀리초 시계 위의 "살아 있는 효과 객체"로 다룹니다.

- **연막과 벽**: 시야선을 막습니다. 벽은 체력이 있어서, 부수면 막힘이 풀립니다.
- **섬광과 충격**: 선수별로 눈이 먼 상태가 끝나는 시각을 저장합니다. 교전 엔진의 `flashBlindMs`가 됩니다.
- **정찰과 함정**: 드러난 적 위치를 **그 순간의 사본**으로 저장합니다. 이후 적이 움직여도 갱신되지 않습니다. 정찰 화살이 "계속 추적하는 GPS"가 되는 걸 막는 장치입니다.
- **침묵**: 스킬 사용 금지 시각을 저장하고, 시뮬레이터가 그 선수의 시전을 거부합니다.
- **대시**: 범위 안의 목표 구역으로 즉시 이동합니다.
- **몰리**: 뒤에서 따로 이야기합니다.

2편의 스킬 효과 명세와 맞추는 일은 어댑터 한 곳에서 합니다.
미터를 언리얼 단위로 바꾸는 곳도 이 파일 하나뿐입니다(`UNITS_PER_METER = 100`).
효과 유형이 여러 개인 스킬은 우선순위(연막 > 벽 > 섬광 > 충격 > 정찰 > 몰리 > …)로 주 효과 하나만 실행하고 나머지는 메타데이터로만 갖고 있습니다.
알려진 한계입니다.

### 두 번째 버그: 자기 얼굴에 연막

스킬을 목표 구역에 던질 수 있게 만들기 전, 대본 정책(테스트용으로 정해진 행동만 하는 정책)은 연막을 **자기 위치에** 깔았습니다.
그 결과 공격 팀이 자기 시야를 스스로 가렸고, 스킬을 켠 대본 정책의 라운드 승률은 0.000이 됐습니다.
목표 구역(사이트)에 던지도록 고친 뒤 오프닝 듀얼 승률은 스킬을 껐을 때와 같은 0.450으로 돌아왔습니다.

## 라운드 시뮬레이터: 다 엮기

이제 다섯 부품을 한 라운드로 엮습니다.

```text
매 틱(100ms)
 1. 팀 결정        (500ms마다. 양 팀에 PolicyView를 줍니다. 세계 상태는 없습니다)
 2. 이동           (구역 중심에서 다음 구역 중심으로. 바라보는 방향은 다음 구역)
 3. 스킬
 4. 지각           (perceive)
 5. 교전           (+ 몰리 피해, 떨어진 스파이크 줍기)
 6. 설치 / 해체
 7. 종료 확인
```

기본 설정은 라운드 100초, 설치 4초, 해체 7초, 스파이크 타이머 45초입니다.

교전 규칙에는 의미 있는 제약이 있습니다.
**한 선수는 한 틱에 교전 하나만 할 수 있습니다.**
그래서 1대3이면 한 명씩 차례로 붙게 되고, 인원수가 실제로 중요해집니다.
교전마다 시드는 `deriveSeed(seed, "${tick}:${pairKey}")`로 파생합니다.
교전은 "죽거나 아무 일 없거나"이고, 맞고 살아남는 체력 손실은 아직 모델링하지 않습니다.

같은 초기 상태와 시드면 이벤트 로그가 바이트 단위로 같고, 시드가 다르면 승자와 킬 수가 달라지는 것을 테스트로 확인합니다.
성능은 1,000라운드 기준 라운드당 약 20~24ms입니다.
문서마다 19.5ms, 22.6ms, 24ms로 조금씩 다르게 적혀 있어서 범위로 적습니다.

### 세 번째 버그: 엉뚱한 곳을 보는 수비수

오프닝 듀얼을 맞추던 중에 이상한 현상이 나왔습니다.
가만히 서 있는 수비수가 들어오는 공격수를 **한 번도 먼저 보지 못했습니다.**
공격 측의 첫 발견 비율이 100%였습니다.

원인은 바라보는 방향이었습니다.
이동하는 선수는 다음 구역을 보고, 멈춘 선수는 "앵커 방향"을 봅니다.
그런데 그 앵커 방향이 실제로 적이 들어오는 길과 무관했습니다.
수비수가 벽을 보고 서 있었던 셈입니다.

고친 방법은 명령에 `aimZone`(어디를 겨누고 있을지)을 넣는 것입니다.
지정이 없으면 홀드·피킹의 목표 구역, 그것도 없으면 "적 시작 구역에서 내 구역까지 최단 경로의 바로 앞 구역", 즉 적이 들어올 입구를 봅니다.

그러자 반대 문제가 생겼습니다.
서로 동시에 보게 되면서 공격 측 오프닝 승률이 0.35 근처로 떨어졌고, 명중률 배율을 아무리 올려도 0.37 근처에서 막혔습니다.
실측은 0.437입니다.

여기서 들어간 것이 **피커 이점**입니다.

```ts
// packages/round-simulator/src/simulator.ts (toCombatant)
    const stationary = !this.isMoving(p);
    // Mid-cast: weapon not out (within the ability windup) → no pre-aim and a reaction penalty.
    const casting = (castBusyUntil.get(p.id) ?? 0) > state.elapsedMs;
    const preAim = seesEnemy && !enemySeesSelf && stationary && !casting;
    // Peeker's advantage: a stationary holder reacts late to an enemy peeking into it, even on
    // mutual sight. One who did not see first keeps the full surprise delay. A caster caught mid-
    // windup reacts slower still (weapon-unready), bounded by the windup.
    const base = !seesEnemy ? SURPRISE_DELAY_MS : stationary && opponentMoving ? this.cfg.peekerAdvantageMs : 0;
    const seesEnemyAtMs = base + (casting ? CAST_WINDUP_PENALTY_MS : 0);
```

- 먼저 못 본 쪽: 300ms 늦게 반응(기습).
- 서로 봤지만 나는 서 있고 상대는 움직이며 피킹 중: 210ms 늦게 반응(피커 이점).
- 스킬을 던지는 중이었다면: 추가로 500ms.

실제 온라인 FPS에서 피킹하는 쪽이 네트워크 지연 때문에 먼저 보는 현상을 숫자 하나로 넣은 것입니다.
그리고 미리 조준(`preAim`)은 "내가 적을 보고, 적은 나를 못 보고, 나는 멈춰 있고, 시전 중이 아닐 때"만 성립합니다.

참고로 `behindCover`(엄폐)는 라운드 루프에서 항상 0입니다.
교전 엔진에는 엄폐 계산이 있지만, 시뮬레이터가 엄폐 정보를 채워 넣지 않습니다.

### 오프닝 듀얼 보정의 역사

마스터 프롬프트 31장은 "교전 파라미터는 오프닝 듀얼로만 보정하라"고 합니다.
라운드 승률 같은 상위 지표를 맞추려고 총싸움 숫자를 비트는 것을 막기 위해서입니다.
목표는 3편의 Ascent 공격 측 오프닝 듀얼 승률 0.437(95% 구간 0.420~0.454)입니다.

| 단계 | 설정 | 공격 측 오프닝 승률 |
| --- | --- | --- |
| 처음 | 명중률 배율 1.00 | 0.531 (실패) |
| 배율 탐색 | 0.80 / 0.75 / 0.65 / 0.60 | 0.469 / 0.460 / **0.453** / 0.453 → 0.65 채택 |
| 바라보는 방향 수정 후 | 0.65 → **0.50**, 피커 이점 210ms | 약 0.45 |

0.65와 0.60이 같은 값(0.453)을 내는 것을 보세요.
배율만으로는 그 아래로 내려가지 않는 지점이 있었고, 결국 구조(방향, 피커 이점)를 바꿔야 했습니다.
이 값들은 모든 정책에 똑같이 적용됩니다.
문서의 표현으로는 "진실은 하나(one truth)"입니다.

### 첫 검증: 0/7에서 4/7

PV-4는 3편의 검증 하네스로 자기 대본 정책을 1,000라운드 돌려 봤습니다.

| 단계 | 판정 통과 | 내용 |
| --- | --- | --- |
| 처음 | 0/7 | 공격 승률 0.309(실측 0.509), 시간 초과 **0.504**(0.043), 폭발 0.000 |
| 진단 | — | 교전 문제가 아니라 **정책 문제**. 공격은 첫 킬을 오히려 너무 잘 땄다. 떨어진 스파이크를 줍지 않고, 사이트에서 서로 홀드만 하다 시간이 갔다 |
| 스파이크 줍기 + 적이 없으면 해체 | **4/7** | 공격 승률 **0.509(실측과 정확히 같음)**, 오프닝 0.453, 전멸 0.685 |
| 남은 실패 | — | 해체 0.315(0.160), 폭발 0.000(0.082). 설치 후 홀드가 없어서 |

공격 승률이 실측과 소수점 셋째 자리까지 같아진 순간이 있었습니다.
그리고 "폭발 0"은 이때부터 문제로 기록되어, 하루 뒤 8차 머지에서야 풀립니다(11편).

진단 도구도 이때 생겼습니다.

- `traceCommands`: 선수별로 "어떤 명령을 받았고 실제로 어떻게 실행됐는지", 거부됐다면 이유(`notCarrier`, `outOfRange` 등)
- `engagementTrace`: 첫 교전 순간의 자세. 대본 정책의 수비수는 첫 교전 때 움직이는 비율이 0%였는데, PV-3 팀 정책의 수비수는 100%였습니다. 이 한 줄이 "엔진이 아니라 정책을 고쳐야 한다"는 근거가 됐고, 11편의 수비 보정으로 이어집니다.

## 몰리: 막는 벽에서 아픈 바닥으로

처음 몰리(화염 장판)는 그 구역을 **지날 수 없게** 막았습니다.
하지만 실제 몰리는 지나갈 수 있습니다.
아플 뿐입니다.
급하면 맞으면서 지나가고, 여유가 있으면 돌아갑니다.

v1에서 몰리는 경로 탐색 비용이 됐습니다.

```ts
// packages/round-simulator/src/simulator.ts
const HAZARD_MS_PER_HP = 50;
const HAZARD_EXPOSURE_MS = 700;
...
  private hazardCostMap(abilityEngine: AbilityEngine, nowMs: number): ReadonlyMap<string, number> {
    const m = new Map<string, number>();
    for (const h of activeAreaDenials(abilityEngine, nowMs)) {
      const exposureMs = Math.min(h.remainingMs, HAZARD_EXPOSURE_MS);
      const ticks = Math.ceil(exposureMs / this.cfg.tickMs);
      const cost = ticks * this.cfg.mollyDamagePerTick * HAZARD_MS_PER_HP;
      m.set(h.zoneId, Math.max(m.get(h.zoneId) ?? 0, cost)); // overlapping mollies: one hazard, max cost
    }
    return m;
  }
```

"체력 1을 잃는 것은 50ms를 돌아가는 것과 같다"는 환율입니다.
갓 깔린 몰리는 `7틱 × 6 HP × 50ms = 2,100ms`의 비용이 됩니다.
2.1초 이상 돌아가야 하면 그냥 맞고 지나가고, 그보다 덜 돌아가면 우회합니다.
몰리가 꺼져 갈수록 비용은 0으로 줄어듭니다.

몇 가지 규칙이 더 있습니다.

- 목적지에는 비용을 매기지 않습니다. 목적지에 도착하는 것은 "지나가는 것"이 아니기 때문입니다.
- 몰리가 겹치면 합이 아니라 최댓값입니다. 같은 구역에 몰리 두 개가 겹쳐 피해가 두 번 들어가던 버그가 있었고, 구역을 중복 제거해서 고쳤습니다.
- 정책은 동료가 그 구역에 있거나 볼 수 있는 몰리만 압니다(`visibleHazards`).
- 벽은 여전히 완전히 막습니다.

테스트는 다이아몬드 모양 그래프로 합니다.
S→A→G가 2초, S→B→G가 3초일 때, A에 비용 2,000ms 몰리를 깔면 B로 돌아가고, 100ms짜리를 깔면 A로 맞고 지나갑니다(2.1초).

## 시전: 행동 전체가 아니라 손이 바쁜 시간만

11편의 이야기를 조금 미리 합니다.
스킬을 켜고 돌리자 이상한 결과가 나왔습니다.
**스킬을 쓰는 쪽이 진다.**
코어 세션(PV-3)이 격리 실험으로 원인을 찾았는데, 스킬 시전이 그 500ms 결정 틱의 행동 전체를 차지하고 있었습니다.
연막 하나 던지는 동안 0.5초 내내 총을 못 드는 셈이었습니다.

고친 모델은 이렇습니다.
시전자는 스킬의 시전 시간(`windupMs`, 카탈로그에 없으면 700ms) 동안만 무기를 못 듭니다.
그 사이에 교전이 붙으면 미리 조준이 없고 반응이 500ms 늦습니다.
시전 시간이 지나면 정상입니다.
패널티는 양쪽에 대칭입니다.

300시드로 측정한 결과입니다(멀리 던지는 정찰 스킬 기준).

| 누가 시전하나 | 공격 측 오프닝 승률 |
| --- | --- |
| 아무도 | 0.643 |
| 공격만 | 0.007 |
| 수비만 | 0.987 |
| 양쪽 다 | 0.643 |

시전하는 쪽은 그 순간 교전이 붙으면 거의 무조건 집니다.
양쪽이 다 시전하면 대칭이라 원래대로 돌아옵니다.
이 측정이 수정 전 값인지 후 값인지는 커밋 메시지에서 분명하지 않습니다.
다만 "시전 시간이 0이면 시전하지 않은 것과 똑같이 싸운다"는 테스트(`cast-windup.test.ts`)가 있어서, 수정 후의 모델이 시전 시간 동안에만 손해를 보게 만든다는 점은 확인됩니다.

## 6편과 이어지는 관찰 하나

8편에서 PV-5가 실제 맵으로 간선 거리를 측정했고, 14:37에 PV-4가 그중 30개를 그래프에 반영했습니다.
간선 총길이가 952m에서 1,310m로 늘었습니다.
그런데 이 글을 쓰면서 코드를 보니, 라운드 시뮬레이터가 선수를 실제로 움직일 때는 그래프의 이동 시간을 쓰지 않습니다.

```ts
// packages/round-simulator/src/simulator.ts (stepMovement)
    const speed = p.moveMode === "run" ? RUN_UNITS_PER_SEC : WALK_UNITS_PER_SEC;
    const edgeMs = (dist3(fromZone.position, nextZone.position) / speed) * 1000;
```

구역 중심 사이의 직선거리를 속도로 나눕니다.
측정된 거리는 A*가 **어느 길을 고를지**에는 반영되지만, 그 길을 **얼마나 오래 걸어가는지**에는 반영되지 않습니다.
공격 스폰에서 A 로비까지 실측은 9.3초인데, 시뮬레이터 안에서는 직선 기준 약 8초 만에 도착합니다.
문서 어디에도 이 차이는 적혀 있지 않았습니다.
공격이 너무 강한 이유 중 하나일 수도 있습니다. 실제보다 빨리 사이트에 도착하니까요.
다만 확인해 보지는 않았습니다.

## 정리

PV-4의 엔진은 마스터 프롬프트 10.4절의 17가지 공간 기능 중 상당수를 "그래프 근사"로 해결했습니다.
벽 충돌, 보행 가능 바닥, 경로 탐색, 시야 차단, 연막 차단, 소리 전파, 설치 구역은 있고, 플레이어 반경, 고저차, 문, 텔레포터, 동적 장애물은 아직 없습니다.

그리고 숫자를 맞추는 과정에서 버그를 하나씩 찾아냈습니다.
흥미로운 점은 그 버그들 대부분이 "엔진은 맞는데 정책이 엔진을 잘못 쓰는" 경우였다는 것입니다.
교전 엔진은 첫 킬을 너무 잘 줬고, 문제는 스파이크를 줍지 않는 정책이었습니다.
명중률은 맞았고, 문제는 벽을 보고 서 있는 수비수였습니다.
`traceCommands`와 `engagementTrace` 같은 진단 도구가 그 구분을 가능하게 했습니다.

다음 편은 이 그래프의 "수동 근사"를 실제 맵 데이터로 바꾸려던 시도입니다.
3억 2천만 바이트짜리 Blender 파일에서 바닥을 뽑아내고, 그 바닥이 왜 27%만 이어졌는지에 대한 이야기입니다.

## 참고 자료

- [docs/handoffs/PV-4-spatial.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-4-spatial.md)
- [docs/handoffs/ROUND_EXECUTION_API.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/ROUND_EXECUTION_API.md)
- [docs/research/FIRST_VALIDATION_RUN.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/FIRST_VALIDATION_RUN.md)
- [docs/research/spatial-sources.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/spatial-sources.md)
- [packages/spatial-engine](https://github.com/2rangs/Project-VM/tree/main/packages/spatial-engine)
- [packages/perception-engine](https://github.com/2rangs/Project-VM/tree/main/packages/perception-engine)
- [packages/combat-engine](https://github.com/2rangs/Project-VM/tree/main/packages/combat-engine)
- [packages/ability-engine](https://github.com/2rangs/Project-VM/tree/main/packages/ability-engine)
- [packages/round-simulator](https://github.com/2rangs/Project-VM/tree/main/packages/round-simulator)
