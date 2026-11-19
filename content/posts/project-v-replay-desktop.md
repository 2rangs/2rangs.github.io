---
slug: project-v-replay-desktop
title: PROJECT V 개발기 (9) 리플레이 파일 해독과 데스크톱 앱 만들기
summary: 리눅스에서 .vrf 리플레이를 읽어 좌표 변환과 이동 속도를 검증하고, 안개 뷰와 한국어 UI를 갖춘 Electron 데스크톱 앱을 만들었습니다.
tags: [PROJECT V, Electron, PixiJS]
series: PROJECT V 개발기
date: 2026-11-19T04:08:00.000Z
comment_term: blog-post-project-v-replay-desktop
---

> **참고** 이 글은 "PROJECT V 개발기" 연재의 9편입니다. [Project-VM 저장소](https://github.com/2rangs/Project-VM)의 `docs/handoffs/PV-6-replay.md`, `docs/research/replay-parser.md`, `docs/research/replay-kinematics.md`, `docs/research/vrf-capture-guide.md`와 `tools/replay-parser`, `packages/replay-engine`, `apps/replay-viewer`, `apps/desktop`을 근거로 썼습니다.

2편에서 위치 데이터를 합법적으로 구할 방법이 하나 남았다고 했습니다.
제가 직접 게임을 하고 그 리플레이 파일을 넘기는 것입니다.
발로란트는 리플레이를 `.vrf` 파일로 로컬 디스크에 저장합니다.
제3자 사이트가 아니라 내 컴퓨터에 있는 내 파일이니 약관 문제가 훨씬 적습니다.

다만 이 파일을 읽는 공식 도구가 없고, 프로젝트는 리눅스 컨테이너에서 돌고 있었습니다.

이번 편은 리플레이 세션(PV-6)이 리눅스에서 실제 `.vrf`를 읽은 과정과, 같은 세션이 그 위에 매니저 게임 화면을 만든 과정입니다.

## 한눈에 보기

- C#/.NET 10 오픈소스 리플레이 파서를 리눅스용 단일 실행 파일로 빌드했습니다. 수정한 곳은 윈도우 절대 경로 한 줄이었습니다.
- 파서 저장소에 실제 `.vrf` 샘플 2개가 있어서, 제 리플레이 없이도 **실데이터 해독(L3)** 까지 진행했습니다. 2편의 26개 소스 중 처음으로 L3에 도달했습니다.
- 바라보는 방향(yaw)을 올바른 필드에서 읽도록 추출 스크립트를 수정했습니다.
- 위치 샘플 3,001개를 7편의 좌표 변환에 넣어 **3,001개 모두** 미니맵 안에 들어오는 것을 확인했습니다. 최고 속도는 6.84m/s로, 엔진의 달리기 속도 6.75m/s와 1.3% 차이입니다. 표본은 1명이고 대부분 정지 상태라 참고 수준입니다.
- 리플레이에 들어 있던 일반인의 게임 내 이름은 통합 때 squash 머지로 main 이력에서 제외했습니다.
- 실제 리플레이, 합성 데이터, 시뮬레이션 결과를 하나의 리플레이 포맷에 담고, PixiJS 뷰어와 Electron 데스크톱 앱에서 재생합니다.
- 데스크톱 앱에는 안개(fog of war) 중심의 경기 화면, 적 위치 믿음 히트맵, 경기 후 리뷰, 한국어 UI, 전술 타임아웃이 있습니다.

## 리눅스에서 .vrf 읽기

### 파서 선택

2편에서 PV-1이 리플레이 파서 다섯 개를 검토했습니다.
가장 성숙한 것은 Rust로 된 vrfkit(Parquet 테이블 13개, 리플레이 1,018개 검증)이었습니다.
PV-6는 vrfkit을 먼저 시도했지만, `cargo build`가 컨테이너의 권한 정책에서 허용되지 않았습니다.
컴파일 오류가 아니라 환경 정책 문제였고, 문서에는 "성공으로 기록하지 않음"으로 남겼습니다.

같은 환경에서 `dotnet publish`는 허용됐습니다.
그래서 C#/.NET 10 파서(`ValorantReplayParserPlayground`의 `revamped-channel-hooks` 브랜치)를 썼습니다.

1. 컨테이너에 .NET SDK가 없어서 `dotnet-install.sh --channel 10.0`으로 10.0.404를 설치했습니다.
2. `dotnet publish -r linux-x64 --self-contained /p:PublishSingleFile=true`
3. 종료 코드 0, 74MB 단일 실행 파일.

수정은 한 줄이었습니다.
`Program.cs`에 출력 경로가 `C:\Users\…\channels.jsonl`로 하드코딩되어 있어서, 환경 변수를 먼저 보고 없으면 현재 폴더에 쓰도록 바꿨습니다.
문서에는 "upstream에 올린다면 이 한 줄이 리눅스 호환의 전부"라고 적혀 있습니다.
이 수정은 로컬 클론에만 했고 저장소에는 커밋하지 않았습니다.

### 저장소에 있던 샘플

파서 저장소 안에 **실제 `.vrf` 샘플 두 개**(410KB, 562KB)가 들어 있었습니다.

| 샘플 | 파싱 시간 | 결과 |
| --- | --- | --- |
| 첫 번째 | 409ms | 이동 샘플 3,001개, 게임 단계 23개, 스파이크 상태 470개, 플레이어 1명 |
| 두 번째 | 553ms | 세리머니 장면이라 이동 샘플 0개. 오류 없이 "위치 0개"로 처리 |

덕분에 제가 커스텀 게임을 하기 전에 파이프라인 전체를 실데이터로 검증할 수 있었습니다.
2편의 레지스트리에서 "실제 재현(L3)"은 0개였는데, 여기서 처음으로 L3가 나왔습니다.

### 방향 필드 수정

원본 저장소에는 파서 출력을 JSON으로 바꾸는 스크립트가 함께 있었는데, 실제 덤프에 돌려 보니 바라보는 방향이 모두 0이었습니다.
원본은 방향을 `RotationInput.Z`에서 읽었고, 실제 값은 `mv.Yaw`(도 단위)에 있었습니다.

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

수정 후 첫 샘플의 방향은 142.06°였습니다.
실데이터로 돌려 봤기 때문에 확인할 수 있었던 부분입니다.

### 리플레이에 없는 정보

파서를 평가하면서 `.vrf`에 **없는** 정보도 정리했습니다.
체력, 방어구, 무기, 탄약, KDA, 킬 귀속, 크레딧입니다.
위치, 방향, 게임 단계는 있지만 누가 살아 있는지는 없습니다.

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
`false`로 채우면 죽었다는 잘못된 정보가 되고, `true`로 채우면 살아 있다는 잘못된 정보가 됩니다.
모르면 `null`로 둡니다.

설계 결정이 몇 가지 더 있습니다.

- 시간은 원본 128Hz 틱과 밀리초 변환값을 둘 다 남깁니다.
- 미니맵 좌표는 PV-4 담당이라 여기서는 게임 월드 좌표만 채웁니다.
- 원본 스크립트의 valorant-api 네트워크 호출을 제거해 오프라인에서 결정적으로 동작하게 했습니다.
- 실데이터는 `verificationLevel: 3`, `evidenceType: 'decoded'`로 표시합니다.

## 실데이터로 엔진 검증

### 좌표 변환: 3,001 / 3,001

7편에서 PV-4는 콜아웃 22개로 valorant-api 계수를 "축을 바꿔서" 적용해야 한다는 것을 찾았습니다.
PV-6는 같은 식을 실제 이동 샘플 3,001개에 적용했습니다.

**3,001개 모두 미니맵 [0, 1] 범위 안에 들어왔고**, 오버레이 이미지로도 확인했습니다.
콜아웃 22개로 찾은 변환식이 실제 플레이 데이터에서도 맞는다는 첫 교차 검증입니다.

맵 판별도 했습니다.
"미니맵 안에 들어오는가" 테스트는 Ascent, Haven, Split 모두 100%가 나와 판별력이 약했습니다.
최종 근거는 파서 로그의 `/Game/Maps/Ascent/Ascent.Ascent_C`였습니다.

이 변환은 통합 때 다시 쓰입니다.
3편과 10편에서 다룬 "공격 스폰 선수 전원이 B 메인에 찍힌" 좌표 문제를, PV-6가 실데이터로 검증한 변환을 주입해 해결했습니다.

### 속도: 6.84m/s

| 지표 | 값 |
| --- | --- |
| 최고 속도 | **6.837 m/s** |
| 이동 중 p95 | 4.738 m/s |
| 이동 중 평균 | 3.848 m/s |
| 상태 비율 | 정지 86.81%, 걷기·앉기 5.91%, 달리기 7.28%, 이상값(7.5m/s 초과) 0% |
| 회전 각속도 p99 / 최대 | 85.76 / 230.4 °/s |

최고 속도 6.837m/s는 엔진의 달리기 속도 6.75m/s보다 1.3% 높습니다.
엔진 값이 실제와 크게 다르지 않다는 근거입니다.

문서에는 이 표의 범위도 굵은 글씨로 적혀 있습니다.
**1경기, 1명, 샘플 3,001개, 86.8%가 정지 상태, 수비 스폰 한 구역에만 머묾. 일반화 금지.**
구역 사이를 이동한 기록이 없어 이동 시간은 비교하지 않았고, 걷기와 앉기는 `.vrf`에 입력 상태가 없어 구분하지 않았습니다.
8편에서 PV-5가 이 샘플로 좌표 변환을 검증한 것도 같은 범위(수비 스폰 한 곳) 안의 결과입니다.

## 일반인 이름 처리

`.vrf`에는 플레이어의 게임 내 이름(`ProfileName`)이 들어 있습니다.
커스텀 게임에서는 실제 Riot ID가 그대로 남고, 경쟁전에서는 `Player N`처럼 익명화됩니다.
샘플 리플레이 속 플레이어는 프로 선수가 아닌 일반인이었습니다.

PV-6의 첫 커밋 문서 두 곳에 그 이름이 측정값으로 들어갔습니다.
두 번째 커밋(09:27)에서 익명 표기로 바꿨지만, 이미 push된 첫 커밋 이력에는 이름이 남아 있었습니다.
세션 규칙상 push된 브랜치의 이력을 다시 쓰는(rebase) 것은 금지였습니다.

그래서 통합 단계에서 처리했습니다.
오케스트레이터는 `pv-replay` 브랜치를 squash 머지하기로 정했습니다.
14:37 커밋(`668f372`)이 PV-6 브랜치 전체를 커밋 하나로 합쳐 통합 브랜치에 넣었고, main 이력에는 원본 PV-6 커밋들이 없습니다.
머지 후 확인에서 일반인 `이름#태그`는 0건, 비밀정보도 0건이었습니다.
실데이터 스크린샷에 익명 라벨(P1)만 있는지도 오케스트레이터가 직접 확인했습니다.

프로 선수는 다르게 다룹니다.
VCT 프로 선수와 팀 이름은 제가 허용했습니다(출시 전 내부 개발 단계이고, 출시 전에 초상권·상표를 다시 검토한다는 전제).
일반인은 계속 `player_N`으로 표기합니다.

## 하나의 리플레이 포맷

`@pv/replay-engine`은 세 가지 출처를 하나의 포맷에 담습니다.

```ts
type ReplaySource = 'real' | 'synthetic' | 'simulated';
type PlayerState = 'alive' | 'dead' | 'unknown';   // 실제 .vrf는 'unknown'
```

보간 규칙을 한 곳에 모아 두어서, 뷰어는 데이터 출처와 상관없이 재생할 수 있습니다.

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

핵심은 두 가지입니다.

- **배속은 상태를 바꾸지 않습니다.** 배속은 `stateAt()`을 얼마나 자주 호출하는지만 바꿉니다. "화면 배속과 경기 판정은 서로 독립"이라는 DECISION-010을 리플레이에도 적용했습니다.
- **각도는 짧은 쪽으로 보간합니다.** 350°에서 10°로 갈 때 −340°가 아니라 +20° 돕니다. 이렇게 하지 않으면 선수가 화면에서 한 바퀴 도는 장면이 나옵니다.

이후 이 포맷에 팀별 **지각 트랙**이 추가됐습니다.
특정 시점에 그 팀이 본 적, 적 위치에 대한 믿음(구역별 확률), 들은 소리를 담습니다.
실제 위치(`tracks`)와는 **별도 필드**입니다.
5편의 DECISION-004 "실제 상태와 인지 상태를 분리한다"를 리플레이 포맷에도 적용했습니다.

## 뷰어에서 데스크톱 앱으로

### PixiJS 뷰어

`apps/replay-viewer`는 미니맵 위에 선수 점과 시야선을 그리고, 타임라인 탐색, 0.5~4배속, 라운드 이동, 파일 끌어다 놓기를 지원합니다.
미니맵 이미지는 실행할 때 valorant-api에서 받아 오고 저장소에는 넣지 않았습니다.
역시 Riot 자산의 라이선스 때문입니다.

### Electron 앱

`apps/desktop`은 DECISION-007(Electron 기반 PC 게임)을 구현한 앱입니다.

- **보안**: `contextIsolation: true`, `nodeIntegration: false`, 화이트리스트 preload(`window.pv`), CSP.
- **프로세스 분리**: 시뮬레이션은 Electron의 `utilityProcess`로 별도 프로세스에서 돕니다. "경기 연산과 렌더링 분리"라는 DECISION-006입니다. 요청은 메시지가 아니라 fork 인자로 넘겨 메시지 경쟁 조건을 없앴습니다.
- **재사용**: 뷰어 코드를 복사하지 않고 `src/lib/`로 라이브러리화해 함께 씁니다.
- **E2E**: Playwright의 `_electron.launch`를 가상 디스플레이(xvfb)와 소프트웨어 렌더러(SwiftShader) 위에서 실행합니다.

처음에는 가짜 시뮬레이터(StubRunner)로 화면을 만들었습니다.
통합 후에는 `RealMatchRunner`가 같은 `SimulationRunner` 인터페이스로 실제 라운드 시뮬레이터를 실행합니다.
교체할 자리를 처음부터 인터페이스로 만들어 두어서, 실제 엔진이 들어올 때 화면 코드는 거의 바뀌지 않았습니다.

### 매니저 게임 장르를 따르되 특정 게임을 복제하지 않기

UI 방향에 대한 결정이 하나 기록되어 있습니다.
"매니저 게임(FM/OOTP) 장르의 관례를 따르되, 특정 게임의 외형을 복제하지 않는다."
경기일 화면, 경제·궁극기 운영, 코치 메모 같은 장르의 기본 요소는 가져오고, PROJECT V만의 중심은 **정보전(안개)** 으로 잡았습니다.
클럽 운영 화면은 경기 엔진을 먼저 만든다는 DECISION-001에 따라 "준비 중"으로 두었습니다.

### 안개 뷰와 믿음 히트맵

경기 중 화면은 아군 시점입니다.
실제 적 위치는 그리지 않습니다.

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
- 지금 보이는 적은 꽉 찬 점으로, 마지막으로 본 위치는 속이 빈 점으로 그리고, 본 지 얼마나 지났는지도 표시합니다.

감독이 보는 정보가 선수들이 아는 정보와 같습니다.
감독은 "저기 적이 있을 것 같다"는 히트맵을 보고 타임아웃 때 지시를 내립니다.

### 경기 후 리뷰

경기가 끝나면 리뷰 탭이 열립니다.
라운드 결과 띠, 경제 흐름 그래프(SVG), IGL 결정 추적 카드, MVP가 있습니다.
실제 위치를 모두 보는 전체 시점은 **경기가 끝난 뒤에만** 열리고, 화면에 "경기 후 전체 시점" 라벨이 붙습니다.

시뮬레이션은 `atk1`~`def5` 같은 슬롯으로 돌고, 리뷰 화면은 이 슬롯을 결정적 해시로 실제 선수 핸들에 짝지어 보여 줍니다.
그래서 화면에 "synthetic attribution" 표시를 붙였습니다.
리뷰의 MVP는 실제 선수의 기록이 아니라 시뮬레이션 성적에 선수 이름을 붙인 것입니다.

### 한국어

다음 날 새벽 제 요청으로 한국어를 기본 언어로 바꿨습니다(한국어/영어 전환 지원).
용어집(`GLOSSARY_KO.md`, 131줄)의 원칙은 이렇습니다.

- 일반 UI는 한국어로 옮깁니다.
- 요원, 맵, 무기, 선수 핸들, 팀 이름은 음차하지 않고 원어 그대로 둡니다.
- 엔진의 전략 ID(`A_EXECUTE`)는 번역 키로 한국어 라벨에 연결하고, 키가 없으면 원래 ID를 보여 줍니다.

리뷰 과정에서 세 가지를 다듬었습니다.

1. 라운드 종료 사유 `elimination`의 번역을 "제압"에서 발로란트 한국어판 용어인 **"전멸"** 로 바꿨습니다.
2. 결정 카드의 전략 이름이 한 글자씩 줄바꿈되던 것을 앱 전체 `word-break: keep-all`과 `min-width: 0`으로 고쳤습니다. 한국어 UI를 만들어 봤다면 익숙한 작업입니다.
3. UI 문자열에 있던 내부 세션 이름(PV-n)을 지웠습니다. `git grep -nE 'PV-[0-9]' apps/desktop/src/renderer` 결과가 비어 있는 것으로 확인했습니다.

### 타임아웃과 코치 지시

6편의 `createMatchSession`은 데스크톱 앱에서 오래 유지되는 자식 프로세스(`scripts/match-session.mts`)로 실행되고, 화면과 줄 단위 JSON으로 통신합니다.
경기일 화면에서 타임아웃을 부르면 지시 패널이 열리고, 전략·경제·템포·역할을 고를 수 있습니다.
E2E 테스트는 2라운드에 내린 지시가 엔진에 도달했는지를 리뷰 화면의 타임아웃 기록으로 확인합니다.
지시가 경기 진행에 반영되는 부분은 6편의 "남은 과제"에서 다룹니다.

## 남은 과제

- **5대5 Ascent 리플레이 확보.** 10명의 궤적, 구역 간 이동 시간, 첫 움직임까지의 시간을 이 파일로 검증할 예정입니다. 캡처 가이드(`vrf-capture-guide.md`)에는 파일 위치(`%LOCALAPPDATA%\VALORANT\Saved\Demos\`), 커스텀 게임 권장, 세리머니 직후 캡처는 이동 데이터가 비어 있을 수 있다는 점이 정리되어 있습니다. 로컬 `.vrf` 파싱에 대한 Riot의 명시적 조항은 찾지 못했다는 점(UNVERIFIED)과, 본인 커스텀 게임만 쓰고 공개 배포는 하지 않는다는 정책도 함께 적혀 있습니다.
- vrfkit 빌드(권한 정책 허용 후), 킬·사망 추론, `.vrf` 헤더로 맵 자동 판별.
- 실제 리플레이에서 플레이어와 팀 연결(현재 팀 정보는 `null`).
- 통합이 끝난 세션 브랜치 정리.

## 정리

PV-6는 이 프로젝트에서 처음으로 실제 경기 데이터를 읽어 낸 세션입니다.
2편의 판정표가 "확인 불가"와 "사용 금지"로 채워져 있었다면, 여기서 처음으로 "실제로 읽었다"는 결과가 나왔습니다.
그리고 그 데이터로 다른 세션들이 세운 가정(좌표 변환, 달리기 속도)을 검증했습니다.

같은 세션이 사용자가 실제로 보게 될 화면도 만들었습니다.
안개 뷰는 DECISION-004를 게임 디자인으로 옮긴 결과입니다.
AI가 못 보는 것은 감독도 못 보게 해서, 엔진의 정보 경계가 그대로 게임의 재미 요소가 될 수 있게 했습니다.

다음 편에서는 여섯 세션의 작업을 하나로 합친 과정을 다룹니다.
충돌 없이 끝난 머지와, 통합 후 확인한 F1부터 F6까지의 항목입니다.

## 참고 자료

- [docs/handoffs/PV-6-replay.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-6-replay.md)
- [docs/research/replay-parser.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/replay-parser.md)
- [docs/research/replay-kinematics.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/replay-kinematics.md)
- [docs/research/vrf-capture-guide.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/vrf-capture-guide.md)
- [tools/replay-parser](https://github.com/2rangs/Project-VM/tree/main/tools/replay-parser)
- [packages/replay-engine](https://github.com/2rangs/Project-VM/tree/main/packages/replay-engine)
- [apps/replay-viewer](https://github.com/2rangs/Project-VM/tree/main/apps/replay-viewer)
- [apps/desktop](https://github.com/2rangs/Project-VM/tree/main/apps/desktop)
