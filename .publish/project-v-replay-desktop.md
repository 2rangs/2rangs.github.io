
2편에서 위치 데이터를 합법적으로 구할 방법이 하나 남았다고 했다. 내가 직접 게임을 하고 그 리플레이 파일을 넘기는 것이다. 발로란트는 리플레이를 `.vrf` 파일로 로컬 디스크에 저장한다. 제3자 사이트가 아니라 내 컴퓨터에 있는 내 파일이라 약관 문제가 훨씬 적다. 다만 이 파일을 읽는 공식 도구가 없고, 프로젝트는 리눅스 컨테이너에서 돌고 있었다. 리플레이 세션(PV-6)은 리눅스에서 실제 `.vrf`를 읽어 냈고, 그 위에 매니저 게임 화면까지 올렸다. 아래 내용은 `docs/handoffs/PV-6-replay.md`와 관련 연구 문서, 코드를 근거로 했다.

## 리눅스에서 .vrf 읽기

2편에서 PV-1이 리플레이 파서 다섯 개를 검토했고, 가장 성숙한 건 Rust로 된 vrfkit(Parquet 테이블 13개, 리플레이 1,018개 검증)이었다. PV-6도 vrfkit부터 시도했지만 `cargo build`가 컨테이너 권한 정책에서 막혔다. 컴파일 오류가 아니라 환경 정책 문제였고, 문서에는 "성공으로 기록하지 않음"으로 남겼다. 같은 환경에서 `dotnet publish`는 허용됐기 때문에 C#/.NET 10 파서(`ValorantReplayParserPlayground`의 `revamped-channel-hooks` 브랜치)로 방향을 틀었다. `dotnet-install.sh --channel 10.0`으로 SDK 10.0.404를 설치하고 `dotnet publish -r linux-x64 --self-contained /p:PublishSingleFile=true`를 돌리니 74MB짜리 단일 실행 파일이 나왔다.

고친 곳은 한 줄이었다. `Program.cs`에 출력 경로가 `C:\Users\…\channels.jsonl`로 박혀 있어서, 환경 변수를 먼저 보고 없으면 현재 폴더에 쓰게 바꿨다. 문서에는 "upstream에 올린다면 이 한 줄이 리눅스 호환의 전부"라고 적혀 있다. 이 수정은 로컬 클론에만 했고 저장소에는 넣지 않았다.

운 좋게도 파서 저장소 안에 실제 `.vrf` 샘플 두 개(410KB, 562KB)가 들어 있었다. 첫 번째는 409ms 만에 이동 샘플 3,001개, 게임 단계 23개, 스파이크 상태 470개, 플레이어 1명이 나왔다. 두 번째는 세리머니 장면이라 이동 샘플이 0개였는데, 오류 없이 "위치 0개"로 처리됐다(553ms). 덕분에 내가 커스텀 게임을 하기 전에 파이프라인 전체를 실데이터로 검증할 수 있었다. 2편의 레지스트리에서 "실제 재현(L3)"은 0개였는데, 여기서 처음으로 L3가 나왔다.

실데이터로 돌려 보니 바로 버그 하나가 보였다. 원본 저장소의 JSON 추출 스크립트로 뽑은 바라보는 방향이 전부 0이었다. 원본은 방향을 `RotationInput.Z`에서 읽었는데, 실제 값은 `mv.Yaw`(도 단위)에 있었다. `mv.Yaw`를 먼저 읽고 없으면 `RotationInput.Z`로 돌아가게 고쳤고, 수정 후 첫 샘플의 방향은 142.06°였다.

`.vrf`에 없는 정보도 정리해 뒀다. 체력, 방어구, 무기, 탄약, KDA, 킬 귀속, 크레딧이 없다. 위치, 방향, 게임 단계는 있는데 누가 살아 있는지는 모른다. 그래서 정규화 데이터에서 생존 여부는 `null`이다.

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

인수인계 문서의 규칙은 "절대 false로 날조하지 말 것"이다. `false`로 채우면 죽었다는, `true`로 채우면 살아 있다는 잘못된 정보가 된다. 시간은 원본 128Hz 틱과 밀리초 변환값을 둘 다 남기고, 미니맵 좌표는 PV-4 담당이라 게임 월드 좌표만 채운다. 원본 스크립트의 valorant-api 호출은 빼서 오프라인에서 결정적으로 돌게 했고, 실데이터에는 `verificationLevel: 3`, `evidenceType: 'decoded'`를 붙인다.

## 실데이터로 엔진 가정 확인하기

7편에서 PV-4는 콜아웃 22개로 valorant-api 계수를 축을 바꿔 적용해야 한다는 걸 찾았다. PV-6가 같은 식을 실제 이동 샘플 3,001개에 넣었더니 3,001개 모두 미니맵 [0, 1] 안에 들어왔고, 오버레이 이미지로도 확인했다. 콜아웃 22개로 찾은 변환식이 실제 플레이 데이터에서도 맞는다는 첫 교차 검증이다. 맵 판별은 "미니맵 안에 들어오는가"로는 Ascent, Haven, Split 모두 100%가 나와 쓸모가 없었고, 결국 파서 로그의 `/Game/Maps/Ascent/Ascent.Ascent_C`가 근거가 됐다. 이 변환은 통합 때 다시 쓰인다. 3편과 10편의 "공격 스폰 선수 전원이 B 메인에 찍힌" 문제를 이 변환을 주입해서 풀었다.

속도도 쟀다. 최고 속도 6.837m/s, 이동 중 p95 4.738m/s, 이동 중 평균 3.848m/s였다. 상태 비율은 정지 86.81%, 걷기·앉기 5.91%, 달리기 7.28%, 7.5m/s 넘는 이상값 0%이고, 회전 각속도는 p99 85.76°/s, 최대 230.4°/s다. 최고 속도는 엔진의 달리기 속도 6.75m/s보다 1.3% 높아서, 엔진 값이 크게 틀리지 않았다는 근거 정도는 된다.

다만 문서는 범위를 굵게 적어 뒀다. 1경기, 1명, 샘플 3,001개, 86.8%가 정지 상태, 수비 스폰 한 구역에만 머묾, 일반화 금지. 구역 사이를 이동한 기록이 없어서 이동 시간은 비교하지 않았고, `.vrf`에 입력 상태가 없어서 걷기와 앉기도 구분하지 않았다. 8편에서 PV-5가 이 샘플로 좌표 변환을 검증한 것도 같은 범위 안의 결과다.

## 리플레이 속 일반인 이름

`.vrf`에는 플레이어의 게임 내 이름(`ProfileName`)이 들어 있다. 커스텀 게임에서는 실제 Riot ID가 그대로 남고, 경쟁전에서는 `Player N`처럼 익명화된다. 샘플 속 플레이어는 프로가 아닌 일반인이었다.

PV-6의 첫 커밋 문서 두 곳에 그 이름이 측정값으로 들어갔다. 두 번째 커밋(09:27)에서 익명 표기로 바꿨지만 이미 push된 첫 커밋 이력에는 남아 있었고, 세션 규칙상 push된 브랜치 이력을 다시 쓰는 건 금지였다. 그래서 통합 단계에서 처리했다. 오케스트레이터가 `pv-replay` 브랜치를 squash 머지하기로 했고, 14:37 커밋(`668f372`)이 PV-6 브랜치 전체를 커밋 하나로 합쳐 넣었다. main 이력에는 원본 PV-6 커밋이 없다. 머지 후 확인에서 일반인 `이름#태그`는 0건, 비밀정보도 0건이었고, 실데이터 스크린샷에 익명 라벨(P1)만 있는지도 오케스트레이터가 직접 봤다.

VCT 프로 선수와 팀 이름은 내가 허용했다. 출시 전 내부 개발 단계이고 출시 전에 초상권·상표를 다시 검토한다는 전제다. 일반인은 계속 `player_N`으로 쓴다.

## 하나의 리플레이 포맷

`@pv/replay-engine`은 실제 리플레이, 합성 데이터, 시뮬레이션 결과를 하나의 포맷에 담는다. 출처는 `'real' | 'synthetic' | 'simulated'`, 선수 상태는 `'alive' | 'dead' | 'unknown'`이고 실제 `.vrf`는 `'unknown'`이 된다. 보간 규칙은 한 곳에 모았다. 위치는 선형, 방향은 짧은 쪽 호, 상태는 마지막 값을 유지한다. 방향을 짧은 쪽으로 보간하지 않으면 350°에서 10°로 갈 때 −340°를 돌아서 선수가 화면에서 한 바퀴 돈다. 배속은 `stateAt()`을 얼마나 자주 부르는지만 바꾸고 계산된 상태는 바꾸지 않는다. 화면 배속과 경기 판정은 독립이라는 DECISION-010을 리플레이에도 적용했다.

나중에 이 포맷에 팀별 지각 트랙이 붙었다. 그 시점에 팀이 본 적, 적 위치에 대한 믿음(구역별 확률), 들은 소리를 담는데, 실제 위치(`tracks`)와는 별도 필드다. 5편의 DECISION-004 "실제 상태와 인지 상태를 분리한다"가 리플레이 포맷까지 내려왔다.

## 뷰어에서 데스크톱 앱으로

`apps/replay-viewer`는 PixiJS로 미니맵 위에 선수 점과 시야선을 그리고, 타임라인 탐색, 0.5~4배속, 라운드 이동, 파일 끌어다 놓기를 지원한다. 미니맵 이미지는 실행할 때 valorant-api에서 받아 오고 저장소에는 넣지 않았다. 역시 Riot 자산 라이선스 때문이다.

`apps/desktop`은 DECISION-007(Electron 기반 PC 게임)을 구현한 앱이다. `contextIsolation: true`, `nodeIntegration: false`, 화이트리스트 preload(`window.pv`), CSP를 걸었다. 시뮬레이션은 Electron `utilityProcess`로 별도 프로세스에서 돌린다(DECISION-006, 경기 연산과 렌더링 분리). 요청은 메시지 대신 fork 인자로 넘겨 메시지 경쟁 조건을 없앴다. 뷰어 코드는 복사하지 않고 `src/lib/`로 빼서 같이 쓰고, E2E는 Playwright의 `_electron.launch`를 xvfb와 SwiftShader 위에서 돌린다. 처음엔 가짜 시뮬레이터(StubRunner)로 화면을 만들었고, 통합 후에는 `RealMatchRunner`가 같은 `SimulationRunner` 인터페이스로 실제 라운드 시뮬레이터를 돌린다. 갈아 끼울 자리를 처음부터 인터페이스로 잡아 둬서, 실제 엔진이 들어올 때 화면 코드는 거의 안 바뀌었다.

UI 방향은 "매니저 게임(FM/OOTP) 장르의 관례를 따르되, 특정 게임의 외형을 복제하지 않는다"로 기록되어 있다. 경기일 화면, 경제·궁극기 운영, 코치 메모 같은 장르의 기본 요소는 가져오고, PROJECT V의 중심은 정보전(안개)으로 잡았다. 클럽 운영 화면은 경기 엔진이 먼저라는 DECISION-001에 따라 "준비 중"이다.

경기 중 화면은 아군 시점이고 실제 적 위치를 그리지 않는다.

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

실제 선수 점 레이어를 지우고, 5편의 Belief State를 반투명 원으로 그린다. 확률이 높을수록 원이 크고 진하다. 지금 보이는 적은 꽉 찬 점, 마지막으로 본 위치는 속이 빈 점에 본 지 얼마나 지났는지를 같이 표시한다. 감독이 보는 정보가 선수들이 아는 정보와 같고, 감독은 "저쪽에 있을 것 같다"는 히트맵을 보고 타임아웃 때 지시를 내린다. AI가 못 보는 건 감독도 못 보게 한 것인데, 엔진의 정보 경계가 그대로 게임의 재미 요소가 될 수 있다고 본다.

경기가 끝나면 리뷰 탭에 라운드 결과 띠, 경제 흐름 그래프(SVG), IGL 결정 추적 카드, MVP가 나온다. 실제 위치를 다 보는 전체 시점은 경기가 끝난 뒤에만 열리고 "경기 후 전체 시점" 라벨이 붙는다. 시뮬레이션은 `atk1`~`def5` 같은 슬롯으로 돌고, 리뷰 화면은 이 슬롯을 결정적 해시로 실제 선수 핸들에 짝지어 보여 준다. 그래서 MVP는 실제 선수 기록이 아니라 시뮬레이션 성적에 이름을 붙인 것이고, 화면에도 "synthetic attribution" 표시를 달았다.

다음 날 새벽에 내가 요청해서 한국어를 기본 언어로 바꿨다(영어 전환 지원). 용어집(`GLOSSARY_KO.md`, 131줄)은 일반 UI는 한국어로 옮기고, 요원·맵·무기·선수 핸들·팀 이름은 음차 없이 원어로 두고, 엔진의 전략 ID(`A_EXECUTE`)는 번역 키로 한국어 라벨에 잇되 키가 없으면 원래 ID를 보여 주는 원칙이다. 리뷰하면서 라운드 종료 사유 `elimination`을 "제압"에서 한국어판 용어인 "전멸"로 바꿨고, 결정 카드의 전략 이름이 한 글자씩 줄바꿈되던 걸 앱 전체 `word-break: keep-all`과 `min-width: 0`으로 고쳤다. UI 문자열에 남아 있던 내부 세션 이름(PV-n)도 지웠고, `git grep -nE 'PV-[0-9]' apps/desktop/src/renderer`가 비어 있는 걸로 확인했다.

타임아웃은 6편의 `createMatchSession`을 오래 사는 자식 프로세스(`scripts/match-session.mts`)로 띄우고 화면과 줄 단위 JSON으로 주고받는다. 경기일 화면에서 타임아웃을 부르면 지시 패널에서 전략·경제·템포·역할을 고를 수 있다. E2E는 2라운드에 내린 지시가 엔진에 닿았는지를 리뷰 화면의 타임아웃 기록으로 확인한다. 지시가 실제 경기 진행에 얼마나 반영되는지는 6편의 "남은 과제"에 적어 두었다.

## 남은 일

제일 급한 건 5대5 Ascent 리플레이다. 10명의 궤적, 구역 간 이동 시간, 첫 움직임까지의 시간을 이걸로 검증하려고 한다. 캡처 가이드(`vrf-capture-guide.md`)에 파일 위치(`%LOCALAPPDATA%\VALORANT\Saved\Demos\`), 커스텀 게임 권장, 세리머니 직후 캡처는 이동 데이터가 비어 있을 수 있다는 점을 적어 두었다. 로컬 `.vrf` 파싱에 대한 Riot의 명시적 조항은 찾지 못했고(UNVERIFIED), 그래서 본인 커스텀 게임만 쓰고 공개 배포는 하지 않는다는 정책도 같이 적혀 있다.

그 밖에 권한 정책이 풀리면 vrfkit 빌드, 킬·사망 추론, `.vrf` 헤더로 맵 자동 판별, 실제 리플레이의 플레이어와 팀 연결(지금 팀 정보는 `null`), 통합이 끝난 세션 브랜치 정리가 남았다. 다음 편은 여섯 세션의 브랜치를 하나로 합친 이야기다.

## 참고 자료

- [docs/handoffs/PV-6-replay.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoffs/PV-6-replay.md)
- [docs/research/replay-parser.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/replay-parser.md)
- [docs/research/replay-kinematics.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/replay-kinematics.md)
- [docs/research/vrf-capture-guide.md](https://github.com/2rangs/Project-VM/blob/main/docs/research/vrf-capture-guide.md)
- [tools/replay-parser](https://github.com/2rangs/Project-VM/tree/main/tools/replay-parser)
- [packages/replay-engine](https://github.com/2rangs/Project-VM/tree/main/packages/replay-engine)
- [apps/replay-viewer](https://github.com/2rangs/Project-VM/tree/main/apps/replay-viewer)
- [apps/desktop](https://github.com/2rangs/Project-VM/tree/main/apps/desktop)
