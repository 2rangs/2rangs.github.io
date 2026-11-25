
5편과 6편이 선수와 팀이 무엇을 할지 정하는 부분이었다면, 이번 편은 그 결정이 실제로 굴러가는 바닥이다. 선수가 어디에 있고, 어디로 갈 수 있고, 무엇을 보고 듣는지, 총을 쏘면 맞는지를 계산하는 부분이다. 이걸 맡은 공간 세션(PV-4)은 여섯 세션 중 가장 먼저 커밋했다(08:49). 지형, 지각, 교전, 스킬, 라운드 루프까지 다른 세션이 올라설 바닥을 만들었고, 그만큼 보정 과정에서 손볼 곳도 가장 많이 나왔다. 근거는 [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `docs/handoffs/PV-4-spatial.md`, `ROUND_EXECUTION_API.md`, `FIRST_VALIDATION_RUN.md`와 각 패키지 코드다.

## 맵은 NavMesh 대신 구역 그래프로

08:49에는 아직 Blender 맵을 쓸 수 없었다(8편에서 PV-5가 받는다). 쓸 수 있는 건 valorant-api의 맵 정보뿐이었다. 그래서 Ascent를 콜아웃 구역 그래프로 만들었다. 구역 22개, 간선 32개, 설치 구역 2개, 시야선 11개, 소리 연결 6개다. 구역 좌표는 valorant-api의 실제 값이고 나머지는 전부 손으로 근사했다. 달리기 속도는 6.75m/s, 걷기는 3.4m/s로 잡았다.

valorant-api는 콜아웃 22개의 게임 좌표와 미니맵 변환 계수 네 개를 주는데, 계수를 어떻게 적용하는지는 문서에 없다. PV-4가 직접 맞춰 보니 축을 바꿔서 적용했을 때만 22개가 모두 미니맵 [0, 1] 안에 들어왔다. 미니맵 x에는 게임 y가, 미니맵 y에는 게임 x가 들어간다. 왕복 변환 오차는 9.1e-13이고, 단위는 언리얼 관례대로 100uu = 1m다. 3편에서 말한 "공격 스폰 선수 전원이 B 메인에 찍힌" 문제는 이 변환이 아니라 다른 변환을 쓴 쪽에서 생겼다.

간선 길이는 처음엔 구역 중심 사이 직선거리였다. 실제로는 벽을 돌아가야 하니 하한값이다. 공격 스폰에서 A 사이트까지 93.7m(13.9초), B 사이트까지 83.4m(12.4초)가 나오는데, 6편에서 스파이크가 늘 가까운 B로 가던 것도 이 차이 때문이었다.

v0에서는 A 사이트에서 B 사이트로 가는 최단 경로가 수비 스폰을 지나갔다. 그래프상으로는 가장 짧지만 공격 팀은 수비 스폰에 못 들어간다. 스폰 구역에 `transit: false`를 붙여서 출발지나 목적지는 될 수 있어도 경유지는 못 되게 했고, 이후 경로는 `A 사이트 → A 가든 → 미드 커비 → 미드 하단 → 마켓 → B 사이트`가 됐다. 경로 탐색은 이동 시간을 비용으로, 직선 이동 시간을 휴리스틱으로 쓰는 A*다. 노드가 22개뿐이라 열린 집합은 우선순위 큐 없이 선형 탐색으로 처리한다.

## 무엇이 보이고 들리나

5편에서 "누가 누구를 볼 수 있는지는 오라클이 판단한다"고 했는데, 그 오라클이 지각 엔진이다.

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

거리 45m, 시야각 110° 안에 있고, 같은 구역이거나 두 구역 사이에 연막으로 막히지 않은 시야선이 있어야 보인다. 바라보는 방향이 없으면 등 뒤로 취급하고, 시야선이 정의되지 않은 구역 쌍은 안 보이는 것으로 처리한다. 모르면 못 보는 쪽으로 두는 건 5편의 `BLIND_ORACLE`과 같은 원칙이다. 다만 시야선이 11개뿐이라 231쌍 중 11쌍만 서로 보이고, 실제 Ascent보다 시야가 많이 좁다. 연막도 구역 단위 근사라서, 떨어진 곳에서 가장 가까운 구역에 닿는 시야선을 통째로 막는다.

소리는 반경이 아니라 그래프를 따라 퍼진다. 소리 연결마다 감쇠율이 있고(A 메인↔A 사이트 0.2, A 사이트↔A 가든 0.4 등) 한 칸 건널 때마다 `(1 − 감쇠율)`을 곱해서 0.1 아래면 안 들린다. 총소리는 크기 1.0에 기준 0.1, 발소리는 0.8에 0.45, 재장전은 0.5에 0.6처럼 소리마다 크기와 기준이 다르다. 발소리는 달리는 선수만 낸다. 시프트 걷기가 그대로 반영된다. 들린 소리는 정확한 좌표가 아니라 소리가 난 구역의 중심으로만 위치를 알려 준다.

본 적에 대한 기억은 `확신도 = 0.5 ^ (경과 시간 / 5초)`로 흐려지고 0.1 아래, 대략 16.6초 뒤에 잊는다. 기억에는 마지막으로 본 위치만 남는다. 콜아웃은 새로 본 적만 대상으로 600ms 뒤에 팀에 전달되고, 죽은 선수가 남긴 콜아웃은 그대로 남는다. 테스트 17개 중 가장 중요한 건 누출 테스트다. 관측 결과를 JSON으로 직렬화한 다음 보이지 않는 적의 좌표가 문자열로라도 들어 있는지 검사한다.

## 교전은 먼저 본 쪽이 이기게

교전 엔진은 승자와 킬 시간을 미리 정하지 않고(DECISION-002), 능력치만으로 결과를 내지도 않는다(마스터 프롬프트 29장). `resolveDuel(duel, seed)`는 반응 시간, 발사 간격마다 한 발씩 명중 판정, 맞은 부위, 거리별 피해, 실드와 체력, 재장전 순으로 교전을 타임라인으로 펼친다. 선수마다 `deriveSeed(seed, 선수id)`로 난수 스트림을 따로 써서, 한쪽의 판정 횟수가 늘어도 다른 쪽 난수 순서는 그대로다. 제한 시간은 12초다.

반응은 미리 조준하고 있었으면 30ms, 아니면 반응 능력치에 따라 140~260ms가 걸리고, 섬광에 맞았으면 남은 섬광 시간에 700ms가 더 붙는다. 명중률은 기본 0.9에서 시작해 조준 능력치(0.5~1.1배), 첫발 보너스, 미리 조준 +0.15, 적정 거리 초과 시 1m당 −0.012, 움직이며 쏘면 0.55배 근처, 섬광 0.15배, 표적의 엄폐와 움직임, 보정 배율 `hitChanceScale`을 차례로 반영하고 0.05~0.98로 자른다. 헤드샷 확률은 크로스헤어 능력치에 따라 0.05~0.45다. 3편의 선수 능력치가 실제로 쓰이는 곳이 여기고, 3편에서 `null`로 남긴 무빙과 무기 제어는 평균값 0.6으로 대신한다.

핸드오프 문서의 몬테카를로 결과로는 미리 조준한 쪽 승률이 0.82, Vandal 대 SMG가 42m에서 0.91, 8m에서 0.52, 섬광 맞은 쪽은 0.00이었다. 테스트로 고정해 둔 성질도 있다. 능력치 0.4인 선수가 먼저 보고 미리 조준하고 있으면, 능력치 0.95지만 250ms 늦게 본 선수를 18m에서 절반 넘게 이긴다. OVR보다 먼저 보고 준비한 쪽이 이기니까 위치 선정과 시야 확보 같은 판단이 결과에 의미를 갖는다.

무기 수치는 2편의 라이선스 감사 결과대로 커밋하지 않았다. 테스트는 근사치 파일(`weapons.manual-approx.json`)을 쓰고, 실제 값은 `npm run fetch-weapons`로 각자 받아 gitignore된 파일에 둔다.

스킬은 밀리초 시간축 위에 살아 있는 효과 객체다. 연막과 벽은 시야선을 막고(벽은 체력이 있어 부수면 풀린다), 섬광은 선수별로 눈이 먼 상태가 끝나는 시각을 저장해 교전 엔진의 `flashBlindMs`로 넘긴다. 정찰로 드러난 적 위치는 그 순간의 사본이라 이후 움직임은 전달되지 않는다. 침묵은 시전 금지 시각을, 대시는 범위 안 목표 구역으로의 즉시 이동을 다룬다. 효과가 여러 개인 스킬은 우선순위(연막 > 벽 > 섬광 > 충격 > 정찰 > 몰리 > …)에 따라 주 효과 하나만 실행한다.

처음엔 스킬을 목표 구역에 던지는 기능이 없어서 대본 정책이 연막을 자기 위치에 깔았다. 공격 팀이 자기 시야를 가리니 스킬을 켠 대본 정책의 라운드 승률이 0.000이 나왔다. 목표 구역에 던지도록 고치자 오프닝 듀얼 승률이 스킬을 껐을 때와 같은 0.450으로 돌아왔다.

라운드 시뮬레이터는 이 부품들을 100ms 틱으로 묶는다. 500ms마다 양 팀에 `PolicyView`를 주고 결정을 받은 뒤 이동, 스킬, 지각, 교전, 설치·해체, 종료 확인을 돈다. 라운드 100초, 설치 4초, 해체 7초, 스파이크 45초가 기본이다. 한 선수는 한 틱에 교전 하나만 할 수 있어서 1대3이면 한 명씩 차례로 붙고, 인원 차이가 결과에 그대로 반영된다. 같은 초기 상태와 시드면 이벤트 로그가 바이트 단위로 같다. 성능은 1,000라운드 기준 라운드당 약 20~24ms다. 문서마다 19.5ms, 22.6ms, 24ms로 조금씩 달라서 범위로 적었다.

## 오프닝 듀얼을 0.437에 맞추기

마스터 프롬프트 31장은 교전 파라미터를 오프닝 듀얼로만 보정하라고 정해 두었다. 라운드 승률 같은 상위 지표를 맞추려고 교전 수치를 만지는 걸 막기 위해서다. 목표는 3편의 Ascent 공격 측 오프닝 승률 0.437(95% 구간 0.420~0.454)이었다.

| 단계 | 설정 | 공격 측 오프닝 승률 |
| --- | --- | --- |
| 처음 | 명중률 배율 1.00 | 0.531 |
| 배율 탐색 | 0.80 / 0.75 / 0.65 / 0.60 | 0.469 / 0.460 / 0.453 / 0.453 → 0.65 채택 |
| 바라보는 방향 수정 후 | 0.65 → 0.50, 피커 이점 210ms | 약 0.45 |

0.65와 0.60에서 같은 값이 나온다. 배율만으로는 더 안 내려가는 지점이 있었고, 그래서 구조를 손봤다. 가만히 서 있는 수비수가 들어오는 공격수를 먼저 보는 경우가 한 번도 없었다(공격 측 첫 발견 100%). 멈춘 선수가 보는 "앵커 방향"이 적이 들어오는 길과 안 맞았던 탓이다. 명령에 `aimZone`을 추가하고, 지정이 없으면 홀드·피킹 목표 구역을, 그것도 없으면 적 시작 구역에서 내 구역으로 오는 최단 경로의 바로 앞 구역을 보게 했다.

이번엔 양쪽이 동시에 서로를 보면서 공격 측 오프닝 승률이 0.35 근처로 떨어졌고, 배율을 올려도 0.37 근처에서 멈췄다. 이 차이를 피커 이점으로 메웠다.

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

먼저 못 본 쪽은 300ms 늦게 반응하고, 서로 봤어도 나는 서 있고 상대가 움직이며 피킹 중이면 210ms 늦게 반응한다. 스킬 시전 중이면 500ms가 더 붙는다. 온라인 FPS에서 피킹하는 쪽이 먼저 보는 현상을 숫자 하나로 넣었다. 이 값들은 모든 정책에 똑같이 적용되고, 문서는 이걸 "진실은 하나(one truth)"라고 부른다.

PV-4는 3편의 검증 하네스로 자기 대본 정책도 1,000라운드 돌렸다. 처음엔 판정 0/7이었다. 공격 승률 0.309(실측 0.509), 시간 초과 0.504(실측 0.043), 폭발 0.000. 들여다보니 교전이 아니라 정책 문제였다. 공격은 첫 킬은 잘 땄는데 떨어진 스파이크를 줍지 않고 사이트에서 홀드만 하다 시간을 보냈다. 스파이크 줍기와 "적이 없으면 해체"를 넣자 4/7이 됐고, 공격 승률은 0.509로 실측과 소수점 셋째 자리까지 같아졌다. 해체 0.315(실측 0.160)와 폭발 0.000(실측 0.082)은 설치 후 홀드 행동이 없어서 남았고, 폭발 비율은 다음 날 8차 머지에서 맞춘다(11편).

이때 만든 진단 도구가 쓸모가 컸다. `traceCommands`는 선수별로 받은 명령과 실제 실행, 거부 사유(`notCarrier`, `outOfRange` 등)를 보여 준다. `engagementTrace`는 첫 교전 순간의 자세를 찍는데, 대본 정책의 수비수는 첫 교전 때 움직이는 비율이 0%, PV-3 팀 정책의 수비수는 100%였다. 엔진이 아니라 정책을 고쳐야 한다는 근거가 이걸로 나왔고, 11편의 수비 보정으로 이어진다.

## 몰리와 시전 시간

처음에 몰리는 그 구역을 아예 못 지나가게 막았다. 실제로는 피해를 입을 뿐 지나갈 수 있다. 급하면 맞고 지나가고 여유가 있으면 돌아간다. v1부터는 경로 탐색 비용으로 바꿨다. 체력 1을 잃는 걸 50ms 돌아가는 것과 같게 보고(`HAZARD_MS_PER_HP = 50`), 노출 시간은 최대 700ms로 잡는다. 갓 깔린 몰리면 `7틱 × 6 HP × 50ms = 2,100ms`라서 우회가 2.1초보다 오래 걸리면 맞고 지나가고, 짧으면 돌아간다. 꺼져 갈수록 비용은 0에 가까워진다. 목적지에는 비용을 매기지 않고, 겹친 몰리는 합이 아니라 최댓값을 쓴다. 정책은 동료가 그 구역에 있거나 볼 수 있는 몰리만 안다(`visibleHazards`). 벽은 여전히 완전히 막는다. 테스트는 다이아몬드 그래프로 한다. S→A→G가 2초, S→B→G가 3초일 때 A에 2,000ms짜리 몰리를 깔면 B로 돌고, 100ms짜리면 A를 그대로 지나간다.

11편 내용을 조금 당겨 오면, 스킬을 켜고 돌리자 스킬을 쓰는 쪽이 지는 결과가 나왔다. 코어 세션(PV-3)이 격리 실험으로 확인해 보니 스킬 시전이 500ms 결정 틱의 행동 전체를 차지하고 있었다. 연막 하나 던지는 동안 0.5초 내내 총을 못 든 것이다. 그래서 시전자는 시전 시간(`windupMs`, 카탈로그에 없으면 700ms) 동안만 무기를 못 들고, 그 사이 교전이 붙으면 미리 조준 없이 반응이 500ms 늦어지도록 바꿨다.

300시드로 멀리 던지는 정찰 스킬을 측정하니 공격 측 오프닝 승률이 아무도 시전 안 하면 0.643, 공격만 0.007, 수비만 0.987, 양쪽 다 0.643이었다. 시전 중에 교전이 붙으면 거의 지고, 양쪽이 다 시전하면 대칭이라 원래 값으로 돌아온다. 이 측정이 수정 전인지 후인지는 커밋 메시지만으로는 분명하지 않다. 다만 "시전 시간이 0이면 시전 안 한 것과 똑같이 싸운다"는 테스트(`cast-windup.test.ts`)가 있어서, 수정 후 모델에서 시전 시간 동안에만 불리해진다는 건 확인된다.

## 남은 일

이동 시간이 아직 측정 거리를 안 쓴다. 8편에서 PV-5가 실제 맵으로 간선 거리를 쟀고, 14:37에 PV-4가 그중 30개를 그래프에 넣었다(간선 총길이 952m → 1,310m). 그런데 이 값은 A* 경로 선택에만 쓰이고, 실제 이동은 `stepMovement`에서 구역 중심 직선거리를 속도로 나눠 계산한다(`dist3(fromZone.position, nextZone.position) / speed`). 공격 스폰 → A 로비가 실측 9.3초인데 시뮬레이터에서는 약 8초다. 그래프의 이동 시간을 쓰게 바꾸고 공격 승률에 어떤 영향이 있는지 볼 생각이다.

그 밖에 교전 엔진에 있는 엄폐(`behindCover`)는 라운드 루프에서 아직 0으로 들어가고, 맞고 살아남는 체력 손실도 없다. 다중 효과 스킬은 주 효과 하나만 돈다. 마스터 프롬프트 10.4절의 공간 기능 17가지 중 벽 충돌, 보행 바닥, 경로 탐색, 시야·연막 차단, 소리 전파, 설치 구역은 그래프 근사로 해 두었고, 플레이어 반경, 고저차, 문, 텔레포터, 동적 장애물은 아직이다.

다음 편은 이 그래프의 손 근사를 실제 맵 데이터로 바꾸는 이야기다.

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
