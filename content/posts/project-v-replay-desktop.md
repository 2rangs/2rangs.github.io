---
slug: project-v-replay-desktop
title: PROJECT V 개발기 (9) 실제 리플레이 읽기와 안개 속 매니저 게임 화면
summary: 리눅스에서 .vrf 리플레이를 해독해 좌표 변환을 3,001/3,001로 검증하고, 그 위에 안개 뷰와 믿음 히트맵, 한국어 UI를 갖춘 Electron 매니저 게임 화면을 올렸습니다.
tags: [PROJECT V, Electron, PixiJS]
series: PROJECT V 개발기
date: 2026-11-19T04:08:00.000Z
comment_term: blog-post-project-v-replay-desktop
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 9편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `docs/handoffs/PV-6-replay.md`, `docs/research/replay-parser.md`, `docs/research/replay-kinematics.md`, `docs/research/vrf-capture-guide.md`와 `tools/replay-parser`, `packages/replay-engine`, `apps/replay-viewer`, `apps/desktop`을 근거로 썼습니다.

2편에서 위치 데이터를 구할 합법적인 길이 하나 남았다고 했습니다.
제가 직접 게임을 하고, 그 리플레이 파일을 넘기는 것입니다.
발로란트는 리플레이를 `.vrf`라는 파일로 로컬 디스크에 저장합니다.
제3자 사이트가 아니라 내 컴퓨터의 내 파일이니 약관 문제가 훨씬 적습니다.

문제는 이 파일을 읽는 공식 도구가 없다는 것입니다.
그리고 이 프로젝트는 리눅스 컨테이너에서 돌고 있었습니다.

이번 편은 리플레이 세션(PV-6)이 리눅스에서 실제 `.vrf`를 읽어 낸 이야기, 그리고 같은 세션이 그 위에 매니저 게임 화면을 올린 이야기입니다.

## 한눈에 보기

- C#/.NET 10으로 된 오픈소스 리플레이 파서를 리눅스용 단일 실행 파일로 빌드했습니다. 고친 것은 윈도우 절대 경로 한 줄이었습니다.
- 파서 저장소에 실제 `.vrf` 샘플 2개가 들어 있어서, 제 리플레이 없이도 **실데이터 해독(L3)** 을 할 수 있었습니다. 2편의 26개 소스 중 아무도 못 했던 단계입니다.
- 원본 파서에서 바라보는 방향(yaw)을 엉뚱한 필드에서 읽는 버그를 찾아 고쳤습니다.
- 위치 샘플 3,001개를 7편의 좌표 변환에 넣었더니 **3,001개 전부** 미니맵 안에 들어왔습니다. 최고 속도는 6.84m/s로, 엔진의 달리기 속도 6.75m/s와 1.3% 차이였습니다. 다만 표본은 1명, 거의 정지 상태라 일반화할 수 없습니다.
- 리플레이에 일반인의 게임 내 이름이 들어 있던 커밋은, 통합 때 squash 머지로 main 이력에서 뺐습니다.
- 실제 리플레이, 합성 데이터, 시뮬레이션 결과를 하나의 리플레이 포맷으로 담고, PixiJS 뷰어와 Electron 데스크톱 앱에서 재생합니다.
- 데스크톱 앱은 안개(fog of war) 중심의 경기 화면, 적 위치 믿음 히트맵, 경기 후 리뷰, 한국어 UI, 전술 타임아웃을 갖췄습니다.

## 리눅스에서 .vrf 읽기

### 파서 고르기

2편에서 PV-1이 리플레이 파서 다섯 개를 검토했습니다.
가장 성숙한 것은 Rust로 된 vrfkit(Parquet 테이블 13개, 리플레이 1,018개 검증)이었습니다.
PV-6는 vrfkit을 먼저 시도했는데, `cargo build`가 컨테이너의 권한 분류기에 막혔습니다.
컴파일 오류가 아니라 환경 정책이었습니다.
문서에는 이렇게 적혀 있습니다.
"성공으로 기록하지 않음."

같은 환경에서 `dotnet publish`는 허용됐습니다.
그래서 C#/.NET 10 파서(`ValorantReplayParserPlayground`의 `revamped-channel-hooks` 브랜치)로 갔습니다.

1. 컨테이너에 .NET SDK가 없어서 `dotnet-install.sh --channel 10.0`으로 10.0.404를 설치했습니다.
2. `dotnet publish -r linux-x64 --self-contained /p:PublishSingleFile=true`
3. 종료 코드 0, 74MB 단일 실행 파일.

고친 곳은 한 줄이었습니다.
`Program.cs`에 출력 경로가 `C:\Users\…\channels.jsonl`로 하드코딩되어 있었습니다.
환경 변수를 먼저 보고, 없으면 현재 폴더에 쓰도록 바꿨습니다.
문서는 "upstream에 올린다면 이 한 줄이 리눅스 호환의 전부"라고 적었습니다.
이 수정은 로컬 클론에만 했고 저장소에는 커밋하지 않았습니다.

### 샘플이 이미 있었다

진짜 행운은 그다음이었습니다.
파서 저장소 안에 **실제 `.vrf` 샘플 두 개**가 들어 있었습니다(410KB, 562KB).

| 샘플 | 파싱 시간 | 결과 |
| --- | --- | --- |
| 첫 번째 | 409ms | 이동 샘플 3,001개, 게임 단계 23개, 스파이크 상태 470개, 플레이어 1명 |
| 두 번째 | 553ms | 세리머니 장면이라 이동 샘플 0개. 충돌 없이 "위치 0개"로 처리 |

제가 커스텀 게임을 하기 전에, 파이프라인 전체를 실데이터로 검증할 수 있었습니다.
2편의 레지스트리에서 "실제 재현(L3)"은 0개였는데, 여기서 처음으로 L3가 나왔습니다.

### upstream 버그

원본 저장소에는 파서 출력을 JSON으로 바꾸는 스크립트가 같이 있었는데, 실제 덤프에 돌려 보니 바라보는 방향이 전부 0이었습니다.
원본은 방향을 `RotationInput.Z`에서 읽었는데, 실제 값은 `mv.Yaw`(도 단위)에 있었습니다.

```js
// tools/replay-parser/src/extract.mjs
// Differences vs the upstream extract-stream.mjs (intentional, documented):
//   1. Facing: upstream read `mv.RotationInput.Z` which is 0 in real dumps; the
//      real per-move yaw lives in `mv.Yaw` (degrees). We prefer `mv.Yaw`, then
//      fall back to RotationInput.Z, so facing is actually populated.
...
        // Prefer decoded degrees (mv.Yaw); fall back to RotationInput.Z.
        let yaw = 0;
        if (typeof mv.Yaw === 'number') yaw = mv.Yaw;
        else if (mv.RotationInput && typeof mv.RotationInput.Z === 'number') yaw = mv.RotationInput.Z;
```

첫 샘플의 방향은 142.06°였습니다.
합성 테스트만 있었다면 절대 못 찾았을 버그입니다.

### 리플레이에 없는 것

파서를 평가하면서 `.vrf`에 **없는** 것도 확인했습니다.
체력, 방어구, 무기, 탄약, KDA, 킬 귀속, 크레딧.
위치와 방향과 게임 단계는 있지만, 누가 살아 있는지는 없습니다.

그래서 정규화된 데이터에서 생존 여부는 `null`입니다.

```js
// tools/replay-parser/src/normalize.mjs
      profileName: redactProfileNames ? null : (p.ProfileName ?? null),
...
    positions.push({
      roundNum: rr.roundNum,
      actorGuid: s[1],
      sourceTimestamp: s[0],                 // 128Hz round-reset tick (verbatim)
      matchTimeMs,
      roundTimeMs: matchTimeMs === null ? null : matchTimeMs - rr.startTimeMs,
      worldPos: { x: s[2], y: s[3], z: s[4] }, // game units (uu ≈ cm), Z-up
      facingDeg: s[5],
      alive: null, // NOT in .vrf — see provenance.notes
    });
```

인수인계 문서의 규칙은 "절대 false로 날조하지 말 것"입니다.
`false`로 채우면 "죽어 있다"는 거짓 정보가 되고, `true`로 채우면 "살아 있다"는 거짓 정보가 됩니다.
모르면 `null`입니다.

몇 가지 설계 결정이 더 있습니다.

- 시간은 원본 128Hz 틱과 밀리초 변환값을 둘 다 남깁니다.
- 미니맵 좌표는 PV-4 담당이라 여기서 만들지 않고, 게임 월드 좌표만 채웁니다.
- 원본 스크립트의 valorant-api 네트워크 호출을 걷어 내서, 오프라인에서 결정적으로 돕니다.
- 실데이터는 `verificationLevel: 3`, `evidenceType: 'decoded'`로 표시합니다.

## 실데이터로 엔진 검증하기

### 좌표 변환: 3,001 / 3,001

7편에서 PV-4는 valorant-api의 계수를 "축을 바꿔서" 적용해야 한다는 것을 콜아웃 22개로 찾았습니다.
PV-6는 같은 식을 실제 이동 샘플 3,001개에 넣었습니다.

**3,001개 전부가 미니맵 [0, 1] 범위 안에 들어왔습니다.**
오버레이 이미지로 눈으로도 확인했습니다.
콜아웃 22개로 찾은 변환식이 실제 플레이 데이터에서도 맞다는 첫 교차 검증입니다.

맵 판별도 했습니다.
"미니맵 안에 들어오는가" 테스트는 Ascent, Haven, Split 셋 다 100%가 나와서 약한 신호였습니다.
결정적인 근거는 파서 로그의 `/Game/Maps/Ascent/Ascent.Ascent_C`였습니다.

이 변환은 통합 때 다시 등장합니다.
3편과 10편에서 다룬 "공격 스폰 선수 전원이 B 메인에 찍힌" 좌표 사고의 해법이 "PV-6가 실데이터로 검증한 변환을 주입한다"였습니다.

### 속도: 6.84m/s

| 지표 | 값 |
| --- | --- |
| 최고 속도 | **6.837 m/s** |
| 이동 중 p95 | 4.738 m/s |
| 이동 중 평균 | 3.848 m/s |
| 상태 비율 | 정지 86.81%, 걷기·앉기 5.91%, 달리기 7.28%, 이상값(7.5m/s 초과) 0% |
| 회전 각속도 p99 / 최대 | 85.76 / 230.4 °/s |

최고 속도 6.837m/s는 엔진이 쓰는 달리기 속도 6.75m/s보다 1.3% 높습니다.
엔진 값이 실제와 크게 어긋나지 않는다는 근거입니다.

하지만 문서는 이 표 바로 위에 굵은 글씨로 경고를 붙여 뒀습니다.
**1경기, 1명, 샘플 3,001개, 86.8%가 정지 상태, 수비 스폰 한 구역에만 머묾. 일반화 금지.**
구역 사이를 이동한 기록이 0건이라 이동 시간은 비교할 수 없었고, 걷기와 앉기는 `.vrf`에 입력 상태가 없어서 구분할 수 없었습니다.
8편의 PV-5도 이 샘플의 범위로 좌표 변환을 검증했는데, 그것도 "수비 스폰 한 곳"이라는 같은 한계를 안고 있습니다.

## 일반인의 이름

`.vrf`에는 플레이어의 게임 내 이름(`ProfileName`)이 들어 있습니다.
커스텀 게임에서는 실제 Riot ID가 그대로 남고, 경쟁전에서는 `Player N`처럼 익명화됩니다.
샘플 리플레이 속 플레이어는 프로 선수가 아닌 일반인이었습니다.

PV-6의 첫 커밋 문서 두 곳에 그 이름이 실측값으로 들어갔습니다.
두 번째 커밋(09:27)에서 익명 표기로 고쳤지만, 이름은 이미 push된 첫 커밋 이력에 남았습니다.
그리고 세션 규칙상 push된 브랜치의 이력을 다시 쓰는(rebase) 것은 금지였습니다.

해결은 통합 때 했습니다.
오케스트레이터가 정한 방식은 "`pv-replay`는 squash 머지"였습니다.
14:37 커밋(`668f372`)이 PV-6 브랜치 전체를 커밋 하나로 합쳐서 통합 브랜치에 넣었고, 그 결과 main 이력에는 원본 PV-6 커밋들이 없습니다.
머지 후 확인에서 일반인 `이름#태그`는 0건, 비밀정보도 0건이었습니다.
실데이터 스크린샷은 오케스트레이터가 익명 라벨(P1)만 있는지 직접 눈으로 확인했습니다.

대조되는 결정도 있습니다.
VCT 프로 선수와 팀 이름은 제가 허용했습니다(출시 전 내부 개발 단계, 출시 전 초상권·상표 재검토 전제).
일반인은 끝까지 `player_N`입니다.

## 하나의 리플레이 포맷

`@pv/replay-engine`은 세 가지 출처를 한 포맷에 담습니다.

```ts
type ReplaySource = 'real' | 'synthetic' | 'simulated';
type PlayerState = 'alive' | 'dead' | 'unknown';   // 실제 .vrf는 'unknown'
```

보간 규칙을 한 곳에 모아 둬서, 뷰어는 데이터가 어디서 왔는지 몰라도 재생할 수 있습니다.

```ts
// packages/replay-engine/src/engine.ts
/**
 * Replay engine: load/validate, interpolate, seek. Pure and deterministic —
 * playback speed never changes the computed state, only how often stateAt() is
 * called (DECISION-010: speed and judgement are independent).
 *
 * INTERPOLATION RULES (single source of truth for real + simulated replays):
 *   position : linear between the two bracketing keyframes.
 *   facing   : shortest-arc angular lerp (so 350°→10° turns +20°, not −340°).
 *   state    : step / carry-forward (hold the last keyframe's state).
 */
export function lerpAngleDeg(a: number, b: number, t: number): number {
  let d = (((b - a) % 360) + 360) % 360; // 0..359
  if (d > 180) d -= 360;                 // shortest arc; exact 180 stays +180
  const r = a + d * t;
  return ((r % 360) + 360) % 360;
}
```

두 가지가 눈에 띕니다.

- **배속은 상태를 바꾸지 않습니다.** 배속은 `stateAt()`을 얼마나 자주 부르는지만 바꿉니다. DECISION-010의 "화면 배속과 경기 판정은 서로 독립"이 리플레이에도 적용됩니다.
- **각도 보간은 짧은 쪽으로.** 350°에서 10°로 갈 때 −340°가 아니라 +20° 돕니다. 이걸 빼먹으면 선수가 화면에서 한 바퀴 빙글 도는 장면이 나옵니다.

나중에 이 포맷에 팀별 **지각 트랙**이 추가됐습니다.
특정 시점에 그 팀이 본 적, 적 위치에 대한 믿음(구역별 확률), 들은 소리입니다.
실제 위치(`tracks`)와는 **별도 필드**입니다.
5편의 DECISION-004, "실제 상태와 인지 상태를 분리한다"가 리플레이 포맷까지 내려온 것입니다.

## 뷰어에서 데스크톱 앱으로

### PixiJS 뷰어

`apps/replay-viewer`는 미니맵 위에 선수 점과 시야선을 그리고, 타임라인을 끌어 넘기고, 0.5~4배속, 라운드 점프, 파일 끌어다 놓기를 지원합니다.
미니맵 이미지는 실행할 때 valorant-api에서 받아 오고, 저장소에는 넣지 않았습니다.
역시 Riot 자산의 라이선스 때문입니다.

### Electron 앱

`apps/desktop`은 DECISION-007(Electron 기반 PC 게임)의 구현입니다.

- **보안**: `contextIsolation: true`, `nodeIntegration: false`, 화이트리스트 preload(`window.pv`), CSP.
- **프로세스 분리**: 시뮬레이션은 Electron의 `utilityProcess`로 별도 프로세스에서 돕니다. DECISION-006의 "경기 연산과 렌더링 분리"입니다. 요청은 메시지가 아니라 fork 인자로 넘겨서 메시지 경쟁 조건을 없앴습니다.
- **재사용**: 뷰어 코드를 복사하지 않고 `src/lib/`로 라이브러리화해서 같이 씁니다.
- **E2E**: Playwright의 `_electron.launch`를 가상 디스플레이(xvfb)와 소프트웨어 렌더러(SwiftShader) 위에서 돌립니다.

처음에는 가짜 시뮬레이터(StubRunner)로 화면을 만들었습니다.
통합 후 `RealMatchRunner`가 같은 `SimulationRunner` 인터페이스로 실제 라운드 시뮬레이터를 돌리게 됐습니다.
갈아 끼울 자리를 처음부터 만들어 둔 덕분에, 진짜 엔진이 들어오는 날 화면 코드는 거의 바뀌지 않았습니다.

### 매니저 게임, 하지만 특정 게임처럼은 아니게

UI 방향에 대해서는 결정이 하나 기록되어 있습니다.
"매니저 게임(FM/OOTP) 장르의 관례를 따르되, 특정 게임의 외형을 복제하지 않는다."
경기일 화면, 경제·궁극기 운영, 코치 메모 같은 장르 문법은 가져오고, PROJECT V만의 중심은 **정보전(안개)** 으로 잡았습니다.
클럽 운영 화면은 "준비 중"으로 남겨 뒀습니다. DECISION-001(경기 엔진 우선)입니다.

### 안개 뷰와 믿음 히트맵

경기 중 화면은 아군 시점입니다.
실제 적의 위치는 그리지 않습니다.

```ts
// apps/replay-viewer/src/lib/PixiStage.ts (renderPerception 발췌)
    if (opts.povTeamIdx == null) return; // Dev / ground-truth view: no fog overlays
    const t = replay.meta.coordinateTransform;
    this.dotLayer.removeChildren(); // fog: we don't reveal real positions
    ...
    // belief heatmap (zone probability → translucent blob)
    if (opts.showBelief && perc) {
      for (const b of perc.beliefZones) {
        const p = at(b.zone); if (!p) continue;
        const radius = 24 + b.p * 36;
        this.heatLayer.addChild(new Graphics().circle(p.mx, p.my, radius)
          .fill({ color: ENEMY_COLOR, alpha: 0.08 + b.p * 0.32 }));
      }
    }
    // observed enemies — solid when visible now, hollow ghost (with staleness) when last-seen
```

- 실제 선수 점 레이어를 지웁니다.
- 대신 5편의 Belief State를 반투명한 원으로 그립니다. 확률이 높을수록 원이 크고 진합니다.
- 지금 보이는 적은 꽉 찬 점, 마지막으로 본 위치는 속이 빈 "유령" 점으로 그리고, 얼마나 오래됐는지도 표시합니다.

감독이 보는 화면이 선수들이 아는 것과 같다는 뜻입니다.
"저기 적이 있을 것 같다"는 히트맵을 보고 타임아웃 때 지시를 내리게 됩니다.

### 경기 후 리뷰

경기가 끝나면 리뷰 탭이 열립니다.
라운드 결과 띠, 경제 흐름 그래프(SVG), IGL 결정 추적 카드, MVP가 있습니다.
**경기가 끝난 뒤에만** 실제 위치를 보는 전체 시점이 허용되고, 화면에 "경기 후 전체 시점"이라는 라벨이 붙습니다.

하나 솔직하게 적어 둘 것이 있습니다.
시뮬레이션은 `atk1`~`def5` 같은 슬롯으로 돌고, 리뷰 화면은 이 슬롯을 실제 선수 핸들에 결정적인 해시로 짝지어 보여 줍니다.
그래서 화면에 "synthetic attribution"이라는 표시가 붙어 있습니다.
리뷰의 MVP는 실제 그 선수의 기록이 아니라, 시뮬레이션 성적에 실명을 붙인 것입니다.

### 한국어

다음 날 새벽 제 요청으로 한국어가 기본 언어가 됐습니다(한국어/영어 전환).
용어집(`GLOSSARY_KO.md`, 131줄)의 원칙은 이렇습니다.

- 일반 UI는 한국어로 옮깁니다.
- 요원, 맵, 무기, 선수 핸들, 팀 이름은 원어 그대로 둡니다. 음차하지 않습니다.
- 엔진의 전략 ID(`A_EXECUTE`)는 번역 키로 한국어 라벨에 연결하고, 키가 없으면 원래 ID를 보여 줍니다.

리뷰 과정에서 세 가지를 고쳤습니다.

1. 라운드 종료 사유 `elimination`이 "제압"으로 번역되어 있던 것을 **"전멸"** 로 바로잡았습니다. 발로란트 한국어판의 용어입니다.
2. 결정 카드의 전략 이름이 한 글자씩 줄바꿈되던 문제를 앱 전체 `word-break: keep-all`과 `min-width: 0`으로 고쳤습니다. 한국어 UI를 만들어 본 분이라면 익숙한 문제입니다.
3. UI 문자열에 남아 있던 내부 세션 이름(PV-n)을 지웠습니다. `git grep -nE 'PV-[0-9]' apps/desktop/src/renderer`의 결과가 비어 있는 것으로 확인했습니다.

### 타임아웃과 코치 지시

6편의 `createMatchSession`은 데스크톱에서 오래 살아 있는 자식 프로세스(`scripts/match-session.mts`)에 올라가 있고, 화면과는 줄 단위 JSON으로 통신합니다.
경기일 화면에서 타임아웃을 부르면 지시 패널이 열리고, 전략·경제·템포·역할을 고를 수 있습니다.
E2E 테스트는 "2라운드에 내린 지시가 엔진에 도달했는가"를 리뷰 화면의 타임아웃 기록으로 확인합니다.

그리고 6편에서 확인했듯이, 지금 엔진에서는 그 지시 중 전략과 템포가 경기에 효과를 내지 못합니다.
화면에서 지시가 들어가고 기록되는 것까지는 테스트됐지만, 지시가 경기를 바꾸는지는 테스트되지 않았습니다.

## 남은 일

- **5대5 Ascent 리플레이가 아직 없습니다.** 10명의 궤적, 구역 간 이동 시간, 첫 움직임까지의 시간이 모두 이 파일을 기다립니다. 캡처 가이드(`vrf-capture-guide.md`)는 준비되어 있고, 파일 위치(`%LOCALAPPDATA%\VALORANT\Saved\Demos\`), 커스텀 게임 권장, 세리머니 직후 캡처는 이동 데이터가 비어 있을 수 있다는 주의까지 적혀 있습니다. 로컬 `.vrf` 파싱에 대한 Riot의 명시적 조항은 찾지 못했다는 점(UNVERIFIED)과, 본인 커스텀 게임만 쓰고 공개 배포는 하지 않는다는 정책도 함께 적혀 있습니다.
- vrfkit 빌드(권한 차단 해제 후), 킬·사망 추론, `.vrf` 헤더에서 맵 자동 판별.
- 실제 리플레이에서 플레이어와 팀을 잇지 못해 팀 정보가 `null`입니다.
- 작업 브랜치 정리(통합이 끝난 세션 브랜치들).

## 정리

PV-6의 작업은 이 프로젝트에서 "데이터가 실재한다"는 것을 처음 증명한 작업입니다.
2편의 판정표가 "확인 불가"와 "사용 금지"로 가득했다면, 여기서 처음으로 "실제로 읽었다"가 나왔습니다.
그리고 그 실데이터가 다른 세션들의 가정(좌표 변환, 달리기 속도)을 검증했습니다.

동시에 이 세션은 사용자가 실제로 보게 될 화면을 만들었습니다.
안개 뷰는 DECISION-004를 게임 디자인으로 바꾼 결과물입니다.
"AI가 못 보는 것은 감독도 못 본다."
이 원칙 하나 덕분에, 엔진의 정보 경계가 그대로 게임의 재미가 될 가능성이 생겼습니다.

다음 편은 여섯 세션의 작업을 하나로 합친 이야기입니다.
충돌 0건으로 끝난 머지와, 그 뒤에 숨어 있던 F1부터 F6까지의 문제들입니다.

## 참고 자료

- [docs/handoffs/PV-6-replay.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-6-replay.md)
- [docs/research/replay-parser.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/replay-parser.md)
- [docs/research/replay-kinematics.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/replay-kinematics.md)
- [docs/research/vrf-capture-guide.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/vrf-capture-guide.md)
- [tools/replay-parser](https://github.com/2rangs/Project-VM/tree/main/tools/replay-parser)
- [packages/replay-engine](https://github.com/2rangs/Project-VM/tree/main/packages/replay-engine)
- [apps/replay-viewer](https://github.com/2rangs/Project-VM/tree/main/apps/replay-viewer)
- [apps/desktop](https://github.com/2rangs/Project-VM/tree/main/apps/desktop)
