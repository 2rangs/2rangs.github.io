---
slug: project-v-spatial-combat
title: PROJECT V 개발기 (7) 구역 그래프로 만든 시야, 소리, 교전 엔진
summary: Ascent를 22개 구역 그래프로 표현하고, 시야·소리·기억과 먼저 본 쪽이 유리한 교전 모델을 올려 5v5 라운드 시뮬레이터를 만들고 보정한 과정입니다.
tags: [PROJECT V, 게임 AI, 시뮬레이션]
series: PROJECT V 개발기
date: 2026-11-19T04:06:00.000Z
comment_term: blog-post-project-v-spatial-combat
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 7편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `docs/handoffs/PV-4-spatial.md`, `docs/handoffs/ROUND_EXECUTION_API.md`, `docs/research/FIRST_VALIDATION_RUN.md`와 `packages/spatial-engine`, `perception-engine`, `combat-engine`, `ability-engine`, `round-simulator`의 코드를 근거로 썼습니다.

5편과 6편에서는 선수와 팀이 판단하는 부분을 다뤘습니다.
이번 편은 그 판단이 실행되는 공간과 교전을 다룹니다.
선수가 어디에 있고, 어디로 갈 수 있고, 무엇을 보고 듣는지, 총을 쏘면 맞는지를 계산하는 부분입니다.

이 부분을 맡은 공간 세션(PV-4)은 여섯 세션 중 가장 먼저 커밋했습니다(08:49).
지형, 지각, 교전, 스킬, 라운드 루프까지 다른 세션이 올라설 바닥을 만든 세션이라, 보정 과정에서 손볼 곳도 가장 많이 나왔습니다.

## 한눈에 보기

- 맵은 NavMesh가 아니라 **콜아웃 구역 그래프**입니다. Ascent 22개 구역, 32개 간선, 설치 구역 2개. 구역 좌표는 valorant-api의 실제 값이고, 간선과 시야선은 손으로 근사한 값입니다.
- 지각 엔진은 시야(110°, 45m), 소리(구역 간 감쇠), 기억(반감기 5초), 콜아웃(지연 600ms)을 모델링합니다. 소리는 정확한 좌표가 아니라 **구역 중심**으로만 위치를 알려 줍니다.
- 교전 엔진은 반응 시간 → 발사 간격 → 명중 판정 → 부위 → 거리별 피해 → 실드와 체력 순서로 타임라인을 만듭니다. 능력치 0.4인 선수가 먼저 보고 조준하고 있으면 능력치 0.95인 선수를 이긴다는 것을 테스트로 확인했습니다.
- 스킬 엔진은 연막, 섬광, 정찰, 몰리, 벽, 침묵, 대시를 효과 객체로 다룹니다. 정찰로 드러난 적 위치는 **그 순간의 사본**이라 이후 움직임은 전달되지 않습니다.
- 라운드 시뮬레이터는 100ms 틱, 500ms마다 팀 결정을 하는 결정적 5v5 루프입니다. 1,000라운드 기준 라운드당 약 20~24ms가 걸립니다.
- 오프닝 듀얼을 실측(공격 0.437)에 맞추기 위해 명중률 배율을 1.00 → 0.65 → 0.50으로 내리고, 피커 이점 210ms를 추가했습니다.

## 맵: 구역 그래프

PV-4는 Ascent를 NavMesh 대신 그래프로 표현했습니다.
08:49에는 아직 Blender 맵을 쓸 수 없었기 때문입니다(8편에서 PV-5가 받습니다).
그때 쓸 수 있는 자료는 valorant-api의 맵 정보뿐이었습니다.

### 좌표계

valorant-api는 Ascent에 대해 콜아웃 22개의 게임 좌표 `(x, y, z)`와, 게임 좌표를 미니맵 좌표로 바꾸는 계수 네 개를 줍니다.

```json
"xMultiplier": 0.00007, "yMultiplier": -0.00007,
"xScalarToAdd": 0.813895, "yScalarToAdd": 0.573242
```

계수를 어떻게 적용하는지는 문서에 없어서 PV-4가 직접 확인했습니다.
**축을 바꿔서** 적용했을 때만 콜아웃 22개가 모두 미니맵 [0, 1] 범위 안에 들어왔습니다.

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

미니맵 x에는 게임 y가, 미니맵 y에는 게임 x가 들어갑니다.
왕복 변환 오차는 9.1e-13입니다.
단위는 언리얼 엔진 관례대로 100uu = 1m로 잡았습니다.
3편에서 언급한 "공격 스폰 선수 전원이 B 메인에 찍힌" 좌표 문제는 이 변환이 아닌 다른 변환을 쓴 쪽에서 생겼습니다.

### 그래프

PV-4 세션이 `ascent.source.json`을 직접 작성하고, 빌드 스크립트가 거리와 이동 시간을 계산해 `ascent.navgraph.json`을 만듭니다.

| 항목 | 값 | 출처 |
| --- | --- | --- |
| 구역 | 22개 | valorant-api 실제 좌표 |
| 간선 | 32개 | 수동 근사 |
| 설치 구역 | 2개(사각형) | 수동 근사 |
| 시야선 | 11개 | 수동 근사 |
| 소리 연결 | 6개 | 수동 근사 |
| 달리기 / 걷기 속도 | 6.75 / 3.4 m/s | 문서화된 기본 속도 / 근사 |

처음 간선 길이는 구역 중심 사이의 직선거리였습니다.
실제로는 벽을 돌아가야 하니 이 값은 하한입니다.
공격 스폰에서 A 사이트까지 93.7m(13.9초), B 사이트까지 83.4m(12.4초)입니다.
6편에서 스파이크가 늘 가까운 B로 가던 것도 이 거리 차이에서 나온 결과입니다.

### 경로가 수비 스폰을 지나가던 문제

v0에서는 A 사이트에서 B 사이트로 가는 최단 경로가 **수비 스폰을 지나갔습니다.**
그래프에서는 그 길이 가장 짧았지만, 실제 게임에서 공격 팀은 수비 스폰에 들어갈 수 없습니다.

스폰 구역에 `transit: false`를 붙여 해결했습니다.
스폰은 출발지나 목적지는 될 수 있지만 경유지는 될 수 없습니다.
수정 후 경로는 `A 사이트 → A 가든 → 미드 커비 → 미드 하단 → 마켓 → B 사이트`입니다.

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
간선이 직선보다 짧을 수 없으므로 휴리스틱이 과대평가하지 않고, 최적 경로가 보장됩니다.
노드가 22개뿐이라 열린 집합은 우선순위 큐 대신 선형 탐색으로 처리합니다.
`hazardCosts`는 뒤의 몰리 부분에서 설명합니다.

## 지각: 무엇이 보이고 들리나

5편에서 "누가 누구를 볼 수 있는지는 오라클이 판단한다"고 했습니다.
그 오라클을 구현한 것이 지각 엔진입니다.

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
5. 다른 구역이면 두 구역 사이에 시야선이 있고, 그 시야선이 연막으로 막혀 있지 않아야 합니다.

5번에서 시야선이 정의되지 않은 구역 쌍은 **보이지 않는 것**으로 처리합니다.
모르면 못 보는 쪽으로 처리한다는, 5편의 `BLIND_ORACLE`과 같은 원칙입니다.

현재 시야선은 11개입니다.
22개 구역에서 나오는 231쌍 중 11쌍만 서로 보인다는 뜻이고, 실제 Ascent보다 시야가 좁습니다.
8편에서 PV-5가 실제 벽 데이터로 시야를 측정한 결과를 다룹니다.

연막은 구역 단위로 근사합니다.
연막이 떨어진 곳에서 가장 가까운 구역을 찾고, 그 구역에 닿는 시야선을 모두 막습니다.
연막의 부피와 선분의 교차는 계산하지 않습니다.

### 소리

소리는 원형 반경이 아니라 그래프를 따라 퍼집니다.
소리 연결 6개마다 감쇠율이 있고(A 메인↔A 사이트 0.2, A 사이트↔A 가든 0.4 등), 한 칸 건널 때마다 `(1 − 감쇠율)`을 곱합니다.
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
걷거나 앉으면 소리가 나지 않습니다.
발로란트에서 시프트를 누르고 걷는 이유를 그대로 반영했습니다.

들린 소리는 **소리가 난 구역의 중심**으로만 위치를 알려 줍니다.
"B 메인 어딘가에서 발소리가 났다"는 알 수 있지만 정확한 좌표는 모릅니다.

### 기억과 콜아웃

본 적에 대한 기억은 시간이 지나면 흐려집니다.

```text
확신도 = 0.5 ^ (경과 시간 / 5초)
```

반감기는 5초이고, 확신도가 0.1 아래로 떨어지면 잊습니다.
약 16.6초 뒤입니다.
기억에는 "마지막으로 본 위치"만 남고, 실제 위치는 남지 않습니다.

콜아웃은 새로 본 적만 대상으로 하고, 팀에 전달되기까지 600ms가 걸립니다.
죽은 선수가 마지막에 남긴 콜아웃은 팀에 그대로 남습니다.

이 엔진의 테스트 17개 중 핵심은 누출 테스트입니다.
관측 결과를 JSON으로 직렬화한 뒤, 보이지 않는 적의 좌표가 문자열로라도 들어 있는지 검사합니다.
적이 움직인 뒤에는 `lastSeenPosition`만 남아 있어야 합니다.

## 교전: 결과를 미리 정하지 않는 결정적 교전

교전 엔진의 원칙은 두 가지입니다.

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

선수마다 **별도의 난수 스트림**을 씁니다(`deriveSeed(seed, 선수id)`).
한쪽의 명중 판정 횟수가 늘어나도 다른 쪽의 난수 순서는 바뀌지 않습니다.
5편의 스트림 분리를 교전에도 적용했습니다.
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

정리하면 다음과 같습니다.

- 기본 0.9에 조준 능력치에 따라 0.5~1.1배
- 첫 발이면 첫발 정확도에 따라 +0~0.1, 미리 조준 중이면 +0.15
- 무기의 적정 거리를 넘으면 1m마다 −0.012
- 쏘는 사람이 움직이면 0.55배 근처(무빙 능력치로 약간 회복)
- 섬광에 맞았으면 0.15배
- 표적이 엄폐 중이면 그만큼 감소
- 표적이 움직이면 트래킹 능력치에 따라 0.7~1배
- 마지막으로 보정 배율 `hitChanceScale`
- 0.05~0.98 범위로 제한

헤드샷 확률은 크로스헤어 능력치에 따라 0.05~0.45이고, 움직이면 절반, 섬광에 맞으면 0.2배입니다.
3편의 선수 능력치(조준, 첫발 정확도, 크로스헤어, 반응, 트래킹)가 쓰이는 곳이 여기입니다.
3편에서 `null`로 남긴 무빙과 무기 제어는 평균값 0.6으로 대신합니다.

### 정보가 능력치를 이긴다

몬테카를로로 확인한 결과가 핸드오프 문서에 있습니다.

| 상황 | 승률 |
| --- | --- |
| 미리 조준한 쪽 | 0.82 |
| Vandal 대 SMG, 42m | 0.91 |
| Vandal 대 SMG, 8m | 0.52 |
| 섬광에 맞은 쪽 | 0.00 |

테스트로 고정해 둔 성질도 있습니다.
**능력치 0.4인 선수가 먼저 보고 미리 조준하고 있으면, 능력치 0.95이지만 250ms 늦게 본 선수를 18m에서 절반 넘게 이긴다.**
OVR이 높은 쪽이 아니라 먼저 보고 준비한 쪽이 이기도록 만든 것입니다.
그래서 위치 선정과 시야 확보 같은 판단이 결과에 영향을 줍니다.

라이선스 관련 처리도 있습니다.
2편의 감사 결과에 따라 valorant-api에서 받은 실제 무기 수치는 커밋하지 않습니다.
테스트는 근사치 파일(`weapons.manual-approx.json`)을 쓰고, 실제 값은 `npm run fetch-weapons`로 각자 받아 gitignore된 파일에 둡니다.

## 스킬: 효과 객체

스킬 엔진은 스킬을 밀리초 단위 시간축 위에서 살아 있는 효과 객체로 다룹니다.

- **연막과 벽**: 시야선을 막습니다. 벽은 체력이 있어서 부수면 막힘이 풀립니다.
- **섬광과 충격**: 선수별로 눈이 먼 상태가 끝나는 시각을 저장합니다. 교전 엔진의 `flashBlindMs`로 들어갑니다.
- **정찰과 함정**: 드러난 적 위치를 **그 순간의 사본**으로 저장합니다. 이후 적이 움직여도 갱신하지 않습니다. 정찰 화살이 계속 위치를 추적하는 일을 막기 위해서입니다.
- **침묵**: 스킬 사용 금지 시각을 저장하고, 시뮬레이터가 그 선수의 시전을 거부합니다.
- **대시**: 범위 안의 목표 구역으로 즉시 이동합니다.
- **몰리**: 뒤에서 따로 설명합니다.

2편의 스킬 효과 명세와 맞추는 작업은 어댑터 한 곳에서 합니다.
미터를 언리얼 단위로 바꾸는 곳도 이 파일뿐입니다(`UNITS_PER_METER = 100`).
효과 유형이 여러 개인 스킬은 우선순위(연막 > 벽 > 섬광 > 충격 > 정찰 > 몰리 > …)에 따라 주 효과 하나만 실행하고, 나머지는 메타데이터로 보관합니다.

### 연막을 목표 구역에 던지도록 수정

처음에는 스킬을 목표 구역에 던지는 기능이 없어서, 대본 정책(테스트용으로 정해진 행동만 하는 정책)이 연막을 **자기 위치에** 깔았습니다.
공격 팀이 자기 시야를 가리게 되어, 스킬을 켠 대본 정책의 라운드 승률이 0.000이 나왔습니다.
목표 구역(사이트)에 던지도록 고친 뒤에는 오프닝 듀얼 승률이 스킬을 껐을 때와 같은 0.450이 됐습니다.

## 라운드 시뮬레이터

이제 다섯 부품을 한 라운드로 묶습니다.

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

교전에는 중요한 제약이 하나 있습니다.
**한 선수는 한 틱에 교전 하나만 할 수 있습니다.**
그래서 1대3 상황이면 한 명씩 차례로 붙게 되고, 인원수 차이가 결과에 반영됩니다.
교전마다 시드는 `deriveSeed(seed, "${tick}:${pairKey}")`로 파생합니다.
교전 결과는 "죽거나 아무 일 없거나" 둘 중 하나입니다.

같은 초기 상태와 시드면 이벤트 로그가 바이트 단위로 같고, 시드가 다르면 승자와 킬 수가 달라지는 것을 테스트로 확인합니다.
성능은 1,000라운드 기준 라운드당 약 20~24ms입니다.
문서마다 19.5ms, 22.6ms, 24ms로 조금씩 달라서 범위로 적었습니다.

### 수비수의 시선 방향 조정

오프닝 듀얼을 보정하던 중, 가만히 서 있는 수비수가 들어오는 공격수를 **먼저 보는 경우가 없다**는 것을 확인했습니다.
공격 측의 첫 발견 비율이 100%였습니다.

원인은 바라보는 방향이었습니다.
이동하는 선수는 다음 구역을 보고, 멈춘 선수는 "앵커 방향"을 봅니다.
이 앵커 방향이 적이 들어오는 길과 맞지 않았습니다.

그래서 명령에 `aimZone`(어디를 겨눌지)을 추가했습니다.
지정이 없으면 홀드·피킹의 목표 구역을 보고, 그것도 없으면 "적 시작 구역에서 내 구역까지 최단 경로의 바로 앞 구역", 즉 적이 들어올 입구를 봅니다.

이번에는 양쪽이 동시에 서로를 보게 되면서 공격 측 오프닝 승률이 0.35 근처로 내려갔고, 명중률 배율을 올려도 0.37 근처에서 더 오르지 않았습니다.
실측은 0.437입니다.

이 차이를 메우기 위해 **피커 이점**을 넣었습니다.

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
- 스킬을 시전하는 중이었다면: 500ms 추가.

온라인 FPS에서 네트워크 지연 때문에 피킹하는 쪽이 먼저 보는 현상을 숫자 하나로 반영했습니다.
미리 조준(`preAim`)은 "내가 적을 보고, 적은 나를 못 보고, 나는 멈춰 있고, 시전 중이 아닐 때"만 성립합니다.

### 오프닝 듀얼 보정 과정

마스터 프롬프트 31장은 "교전 파라미터는 오프닝 듀얼로만 보정하라"고 정합니다.
라운드 승률 같은 상위 지표에 맞추려고 교전 수치를 조정하는 일을 막기 위해서입니다.
목표는 3편의 Ascent 공격 측 오프닝 듀얼 승률 0.437(95% 구간 0.420~0.454)입니다.

| 단계 | 설정 | 공격 측 오프닝 승률 |
| --- | --- | --- |
| 처음 | 명중률 배율 1.00 | 0.531 (범위 밖) |
| 배율 탐색 | 0.80 / 0.75 / 0.65 / 0.60 | 0.469 / 0.460 / **0.453** / 0.453 → 0.65 채택 |
| 바라보는 방향 수정 후 | 0.65 → **0.50**, 피커 이점 210ms | 약 0.45 |

0.65와 0.60에서 같은 값(0.453)이 나옵니다.
배율만으로는 더 내려가지 않는 지점이 있어서, 바라보는 방향과 피커 이점처럼 구조를 바꾸는 쪽으로 갔습니다.
이 값들은 모든 정책에 똑같이 적용됩니다.
문서에서는 이를 "진실은 하나(one truth)"라고 부릅니다.

### 첫 검증: 0/7에서 4/7

PV-4는 3편의 검증 하네스로 자기 대본 정책을 1,000라운드 돌렸습니다.

| 단계 | 판정 통과 | 내용 |
| --- | --- | --- |
| 처음 | 0/7 | 공격 승률 0.309(실측 0.509), 시간 초과 **0.504**(0.043), 폭발 0.000 |
| 진단 | — | 교전이 아니라 **정책 쪽 원인**. 공격은 첫 킬은 잘 땄지만, 떨어진 스파이크를 줍지 않고 사이트에서 홀드만 하다 시간이 흘렀다 |
| 스파이크 줍기 + 적이 없으면 해체 | **4/7** | 공격 승률 **0.509(실측과 같음)**, 오프닝 0.453, 전멸 0.685 |
| 남은 항목 | — | 해체 0.315(0.160), 폭발 0.000(0.082). 설치 후 홀드 행동이 아직 없음 |

이 단계에서 공격 승률이 실측과 소수점 셋째 자리까지 같아졌습니다.
폭발 비율은 다음 날 8차 머지에서 맞춥니다(11편).

이때 진단 도구도 함께 만들었습니다.

- `traceCommands`: 선수별로 어떤 명령을 받았고 실제로 어떻게 실행됐는지, 거부됐다면 그 이유(`notCarrier`, `outOfRange` 등)
- `engagementTrace`: 첫 교전 순간의 자세. 대본 정책의 수비수는 첫 교전 때 움직이는 비율이 0%였고, PV-3 팀 정책의 수비수는 100%였습니다. 이 차이가 엔진이 아니라 정책을 조정해야 한다는 근거가 됐고, 11편의 수비 보정으로 이어집니다.

## 몰리: 통과 금지에서 통과 비용으로

처음에는 몰리(화염 장판)가 그 구역을 **지날 수 없게** 막았습니다.
실제 게임에서 몰리는 피해를 입을 뿐 지나갈 수 있습니다.
급하면 맞으면서 지나가고, 여유가 있으면 돌아갑니다.

v1부터 몰리는 경로 탐색 비용으로 바뀌었습니다.

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

체력 1을 잃는 것을 50ms 돌아가는 것과 같게 봅니다.
갓 깔린 몰리의 비용은 `7틱 × 6 HP × 50ms = 2,100ms`입니다.
우회가 2.1초보다 오래 걸리면 맞고 지나가고, 그보다 짧으면 돌아갑니다.
몰리가 꺼져 갈수록 비용은 0에 가까워집니다.

규칙이 몇 가지 더 있습니다.

- 목적지에는 비용을 매기지 않습니다. 목적지에 도착하는 것은 통과가 아니기 때문입니다.
- 몰리가 겹치면 비용은 합이 아니라 최댓값입니다. 피해도 구역을 중복 제거해서 한 번만 들어가도록 했습니다.
- 정책은 동료가 그 구역에 있거나 볼 수 있는 몰리만 압니다(`visibleHazards`).
- 벽은 계속 완전히 막습니다.

테스트는 다이아몬드 모양 그래프로 합니다.
S→A→G가 2초, S→B→G가 3초일 때, A에 비용 2,000ms 몰리를 깔면 B로 돌아가고, 100ms짜리를 깔면 A를 그대로 지나갑니다(2.1초).

## 시전: 행동 전체가 아니라 손이 묶이는 시간만

11편 내용을 조금 먼저 다룹니다.
스킬을 켜고 돌리자 **스킬을 쓰는 쪽이 지는** 결과가 나왔습니다.
코어 세션(PV-3)이 격리 실험으로 확인해 보니, 스킬 시전이 500ms 결정 틱의 행동 전체를 차지하고 있었습니다.
연막 하나를 던지는 동안 0.5초 내내 총을 들 수 없던 것입니다.

수정한 모델은 이렇습니다.
시전자는 스킬의 시전 시간(`windupMs`, 카탈로그에 없으면 700ms) 동안만 무기를 들 수 없습니다.
그 사이에 교전이 붙으면 미리 조준이 없고 반응이 500ms 늦습니다.
시전 시간이 지나면 정상으로 돌아옵니다.
패널티는 양쪽에 똑같이 적용됩니다.

300시드로 측정한 결과입니다(멀리 던지는 정찰 스킬 기준).

| 누가 시전하나 | 공격 측 오프닝 승률 |
| --- | --- |
| 아무도 | 0.643 |
| 공격만 | 0.007 |
| 수비만 | 0.987 |
| 양쪽 다 | 0.643 |

시전 중에 교전이 붙으면 시전한 쪽이 거의 집니다.
양쪽이 모두 시전하면 대칭이라 원래 값으로 돌아옵니다.
이 측정이 수정 전인지 후인지는 커밋 메시지만으로는 분명하지 않습니다.
다만 "시전 시간이 0이면 시전하지 않은 것과 똑같이 싸운다"는 테스트(`cast-windup.test.ts`)가 있어서, 수정 후 모델에서는 시전 시간 동안에만 불리해진다는 점을 확인할 수 있습니다.

## 남은 과제

- **이동 시간에 측정 거리 반영.** 8편에서 PV-5가 실제 맵으로 간선 거리를 측정했고, 14:37에 PV-4가 그중 30개를 그래프에 반영했습니다(간선 총길이 952m → 1,310m). 지금은 이 값이 A*의 경로 선택에 쓰이고, 실제 이동 시간은 `stepMovement`에서 구역 중심 사이 직선거리를 속도로 나눠 계산합니다(`dist3(fromZone.position, nextZone.position) / speed`). 예를 들어 공격 스폰 → A 로비는 실측 9.3초, 시뮬레이터에서는 약 8초입니다. 그래프의 이동 시간을 쓰도록 바꾸고 공격 승률에 미치는 영향을 확인할 예정입니다.
- **엄폐와 부분 피해.** 교전 엔진에는 엄폐(`behindCover`) 계산이 있지만, 라운드 루프에서는 아직 0으로 들어갑니다. 맞고 살아남는 체력 손실도 다음 단계입니다.
- **다중 효과 스킬.** 지금은 주 효과 하나만 실행합니다.
- **공간 기능 확장.** 마스터 프롬프트 10.4절의 17가지 공간 기능 중 벽 충돌, 보행 가능 바닥, 경로 탐색, 시야 차단, 연막 차단, 소리 전파, 설치 구역은 그래프 근사로 구현했습니다. 플레이어 반경, 고저차, 문, 텔레포터, 동적 장애물은 이후 과제입니다.

## 정리

PV-4는 구역 그래프 하나 위에 지각, 교전, 스킬, 라운드 루프를 올려 결정적으로 도는 5v5 라운드를 만들었습니다.
수치를 맞추는 과정에서 고친 항목 대부분은 엔진 자체보다 정책이 엔진을 쓰는 방식에 있었습니다.
첫 킬은 잘 땄지만 스파이크를 줍지 않았고, 명중률은 맞았지만 수비수가 적이 오는 방향을 보지 않았습니다.
`traceCommands`와 `engagementTrace` 같은 진단 도구가 있어서 둘을 구분할 수 있었습니다.

다음 편에서는 이 그래프의 수동 근사를 실제 맵 데이터로 바꾸는 작업을 다룹니다.
3억 2천만 바이트짜리 Blender 파일에서 바닥을 뽑고, Recast NavMesh 대신 직접 만든 격자로 구역을 연결한 과정입니다.

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
