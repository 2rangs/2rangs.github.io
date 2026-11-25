
11월 23일 하루 동안 main 머지가 15차부터 20차까지 여섯 번 있었다. 그중 15~17차는 엔진이 아니라 엔진 바깥을 다뤘다. 존재하지 않는 선수와 스태프를 만들어 세계를 채우고, 그 세계 위에 달력과 리그를 얹고, 다시 그 위에 계약·재정·이적·훈련을 얹었다. 세 세션이 거의 같은 시각에 같은 패키지(`packages/career`)를 건드렸고, 13편에서 짧게 적은 "같은 개념의 타입과 함수가 두 벌 생긴 일"도 여기서 일어났다.

## 실존하지 않는 선수

출발점은 데이터셋의 한계였다. game-data에는 실제 선수 1,227명의 핸들이 있지만 능력치가 추정된 선수는 402명뿐이고, 이름도 나이도 없다. 스태프는 아예 없다. 몇 시즌을 넘기는 게임을 만들려면 은퇴한 자리를 채울 사람이 필요하다. Football Manager의 리젠(regen)처럼 매 시즌 가상의 유망주가 들어오게 하는 것이 `docs/GENERATED_PEOPLE.md`의 설계다. 생성된 사람은 모두 `origin: "generated"`, `generated: true`를 달고, 실제 선수는 `origin: "real"`이다.

설계의 중심은 생성된 선수가 엔진 입장에서 실제 선수와 구별되지 않게 하는 것이었다. `WorldPlayer`는 game-data의 `Player`를 그대로 포함하는 상위 타입이고, 능력치도 데이터셋의 모양(`{ value, uncertainty, nMaps }`, 추정 불가 항목은 `{ value: null, reason }`)을 그대로 쓴다. 그래서 엔진은 생성 선수를 실제 선수와 똑같이 읽고, `movement`처럼 추정되지 않은 항목은 둘 다 리그 평균으로 떨어진다.

생성 방식은 "역할 평균 × 잠재력 × 나이 곡선 + 노이즈"다. 월드를 만들 때 실제 402명에서 역할별·능력치별 평균과 표준편차, 실제 최솟값과 최댓값, CA 범위(0.381–0.793), 지역별 국적 분포를 뽑아 월드 안에 저장한다. 저장해 둔 값으로 생성하니 세이브를 불러와도 같은 사람이 나온다. 잠재력은 `PA* = caMin + (caMax − caMin) · u^1.6`으로 뽑는데, 지수 1.6 때문에 대부분의 유망주는 정상급에 닿지 못한다. 현재 능력치는 성숙 곡선 `m(t)`를 따라 피크를 향해 올라가고, 사격 계열은 곡선보다 1.5년 앞서, 임팩트·트레이딩·일관성은 1.5년 늦게 자란다. 모든 항목이 `x_k ≤ peak_k`이므로 CA가 PA를 넘는 일은 없고, 모든 값이 실제 선수들의 범위 안에 머문다.

CA와 PA를 계산할 때 뺀 항목도 있다. `entryAggression`은 실력이 아니라 성향이고, `clutch`는 데이터에서 능력치가 있는 선수 전원이 0.6이라 퍼짐이 없다. 둘 다 CA/PA에 넣지 않고 성장도 시키지 않았다. 측정되지 않은 것을 실력처럼 키우지 않는다는 판단이다.

이름은 따로 신경을 썼다. 16개 이름 문화별로 이름 조각 풀을 두고, 한국·중국 이름은 두 음절을 조합하고 성을 앞에 둔다. 핸들은 지어낸 음절로 네 가지 스타일 중 하나로 만든다. 소문자로 바꾸고 구두점을 뺀 뒤 실존 핸들 1,227개 중 하나와 같거나, 이미 발급된 핸들과 같거나, 3글자 미만이거나, 막아 둔 비속어 조각이 들어 있으면 다시 뽑는다. 데스크톱 빌드에는 이 핸들 목록이 `reserved_handles.json`으로 들어간다. 실존 인물을 쓰지 않는다는 프로젝트 규칙(`DEVELOPMENT_PROCESS.md` §2.4)을 이름 수준까지 내린 것이다.

한 시즌이 지나면 성장, 나이 증가, 은퇴, 스태프 충원, 유망주 유입, 아카데미 선발, 로스터 정리가 순서대로 돈다. 성장 공식은 이렇다.

```
x' = clamp( x + clamp(r(t)·P·C·(1 + 0.25·z), 0, 1) · (peak − x) − λ·max(0, t + 1 − D),  min, peak )
r(t) = (m(t+1) − m(t)) / (1 − m(t))           closing rate: following it reproduces the maturity curve
P    = 0.5 + 0.5 · min(1, maps / 40)           playing time; maps: starter 40, bench 10, academy 20, free 4
C    = 0.75 + 0.5 · coach.development          no coach → development 0 → C = 0.75; average coach → 1
λ    = 0.006, D = 26 (mechanical) / 30 (others)
```

출전 시간(P)과 감독(C)이 성장 속도를 바꾸고, 사격 계열은 26세, 나머지는 30세부터 줄어든다. 은퇴는 로지스틱 해저드인데, 계약된 선수는 31세가 기준이고 아무도 영입하지 않는 선수는 `22 + 9·v`라서 약한 선수일수록 일찍 그만둔다. 스태프는 감독·분석관·스카우트 세 역할이고, 각자 무언가가 실제로 읽는 능력치만 갖는다. 감독의 `development`는 위의 C로, 분석관의 `analysis`는 시리즈의 상대 숙련도 추정 오차로, 스카우트의 판단력은 화면에 보이는 CA/PA 추정치의 오차로 들어간다. AI 팀도 이 추정치로 유망주를 고르기 때문에 스카우트가 좋은 팀이 더 좋은 선수를 데려간다.

이 루프를 시드 7, 70개 팀, 15시즌으로 돌린 결과가 문서에 있다. 지역별 인구는 목표값에 정확히 머물렀고, 스태프는 315명을 유지했고, 유입과 은퇴는 해마다 170~220명(약 16%) 수준이었다. 주전 다섯 명의 평균 CA는 처음 0.634에서 0.634~0.669 사이를 오갔고, 10시즌쯤 지나면 로스터 대부분을 생성 선수가 차지했다. 다만 이 성장·쇠퇴·은퇴 상수들은 맞춰 볼 데이터가 없는 설계값이라고 문서에 그대로 적혀 있다. 실제 선수의 나이도 "첫 데이터 시즌 + 19세" 같은 추정이다.

## 15차 머지와 바이트 동일

생성 선수 작업(`c73e72d`, `75e2764`)은 15차 머지로 main에 들어갔다. 엔진 쪽 변경은 match-runner의 `MatchConfig.rosters` 하나뿐이었다. 이 값이 있으면 그 다섯 명이 경기에 나가고, 없으면 경기가 이전과 바이트 단위로 같다. `match-runner/test/rosters.test.ts`가 그걸 확인한다. 기존 경기를 건드리지 않는다는 보증을 먼저 세우고 기능을 붙이는 방식은 이 뒤로도 계속 반복된다.

15차 기록에는 Ascent 160경기 판정 8/8, 공격 승률 0.521로 14차와 같다고 적혀 있다. 엔진이 바뀌지 않았다는 확인으로는 의미가 있지만, 숫자 자체는 믿을 수 없다. 13편에서 쓴 대로 이때까지의 `sim-batch`는 팀 id를 `t.id`로 읽어서 열 명 전원이 0.6인 미러 경기를 돌리고 있었다. 생성 선수를 만들어 경기에 넣는 기능이 들어간 바로 그 머지에서, 정작 검증 도구는 어떤 선수도 구별하지 못하고 있었다. 수정 커밋(`6bfb689`)은 같은 날 13:18에 나왔고, 16차 머지 기록에 "13–15차의 8/8은 평균 선수 미러 경기였다, 실제 로스터로는 6/8, 공격 0.460"이라는 정정이 붙었다. 15차에서 남은 일로 적힌 것도 이랬다. 경기일과 시리즈가 아직 커리어 월드의 로스터와 스태프를 쓰지 않고, 계약·연봉·이적이 없고, 성장 상수는 보정되지 않았다. 앞의 둘이 다음 두 세션의 일이 됐다.

## 달력이 시간을 갖게 되다

15차 기록 커밋(`bcc3458`)이 12:52에 main에 올라갔고, 거기서 두 세션이 동시에 갈라졌다. 커리어 셸(`claude/festive-brattain-042f51`)과 구단 운영(`claude/happy-newton-649a94`)이다.

커리어 셸이 만든 건 FM 스타일의 게임 껍데기다. 데스크톱 앱은 이제 시작 메뉴로 열린다. 새 커리어를 고르면 감독 이름과 국적, 지역과 팀, 세이브 슬롯을 정하고, 월드는 시드에서 만들어진다(같은 시드면 같은 월드와 일정). 그 뒤로 시간은 Home의 **Continue** 버튼으로만 흐른다. Continue는 하루씩 나아가다가 감독의 경기일, 답이 필요한 메시지, 시즌 마지막 날 중 하나에 멈춘다. 엔진은 경기를 할 때만 돈다. 예전 기본 화면이던 Match Day는 Quick Match 샌드박스 아래로 내려갔다.

리그는 실제 서킷을 느슨하게 따랐다. 감독 팀이 속한 지역의 상위 12팀으로 리그를 만들고, Stage 1은 6팀씩 두 조 단판 리그전(Bo3) 뒤 조 상위 4팀의 플레이오프(8강·4강 Bo3, 결승 Bo5)다. Stage 2는 Stage 1 순위로 다시 조를 짠다. 한 시즌에 74시리즈가 있고 감독 팀 경기는 11~14개다. 경기 시드는 커리어 시드와 경기 id에서 나오기 때문에 경기를 어떤 순서로 치르든 결과가 같다.

시즌이 끝나면 `advanceSeason(world, { mapsPlayed })`이 돈다. 앞 절의 성장 공식에서 P는 원래 신분별 추정치(주전 40맵, 벤치 10맵)였는데, 커리어에서는 그 시즌에 실제로 뛴 맵 수가 들어간다. 생성 선수 세션이 "출전 시간"이라는 자리를 비워 두었고, 커리어 셸이 그 자리에 진짜 값을 넣었다.

남의 팀 경기를 어떻게 돌릴지가 꽤 오래 걸린 부분이다. 처음 핸드오프에는 전체 엔진으로 Bo3 하나에 10~25초, 시즌당 20~30분이 걸린다고 적혀 있었다. 그래서 빠른 추정 모드를 따로 두었다. 두 팀 다섯 명의 평균 능력 차이를 시그모이드에 넣어 라운드 승률을 정하는 단순한 식이다.

```
P(round) = sigmoid(5.4 · (s_home − s_away + comfort_home,map − comfort_away,map))
```

첫 버전의 기울기 2.5는 추측이었고 너무 평평했다. 나중에 커리어 다섯 명끼리 엔진으로 48맵을 돌려 라운드 단위 최대우도로 맞췄더니 5.39가 나왔다(`tools/career/calibrate-quick-sim.mts`). 시간도 다시 쟀다. 빠른 추정은 한 시즌 전체가 0.3초, 전체 엔진은 이미 떠 있는 프로세스 기준 시리즈당 2.6초라서 시즌당 약 2.8분이었다. 문서에는 앞의 10~25초가 프로세스 시작 시간을 포함한 잘못된 값이었다고 정정해 두었다. 근사를 쓰더라도 엔진에 맞춰 쓴다는 원칙은 13편에서 쓴 경제 판단 모델 이야기와 같은 결이다.

커리어 셸이 가장 먼저 커밋한 것은 화면도 리그도 아니고 훅 API였다(`c784fe1`, 13:07). 재정이나 이적 같은 다른 모듈이 하루 루프를 직접 고치지 않고 달력에 끼어들 수 있게 하는 자리다.

```ts
import { registerCareerHook } from '@pv/career';
registerCareerHook({
  id: 'finance',                        // the ext slot and inbox `source`
  order: 100,                           // optional; ascending, then id
  onCareerStart(world, ctx) {},
  onDay(world, date, ctx) {},           // every day, after that day's fixtures
  onMonth(world, date, ctx) {},         // the 1st, after onDay
  onMatchResult(world, fixture, ctx) {},
  onSeasonEnd(world, season, ctx) {},   // BEFORE advanceSeason
  onSeasonStart(world, season, ctx) {}, // after advanceSeason and the new schedule
  onAnswer(world, item, answer, ctx) {},// an inbox item this hook posted was answered
});
// ctx = { career, world, date, post(draft), rng(label), ext(() => init) }
```

규칙은 몇 줄이다. 훅은 `order` 다음 `id` 순으로 돌아서 import 순서와 무관하다. 난수는 `ctx.rng(label)`에서만, 저장할 상태는 `ctx.ext(init)`에만 둔다. 둘 다 세이브의 결정성을 지키기 위한 것이다. 실제로 테스트는 같은 시드로 한 시즌을 두 번 돌려 직렬화 결과가 바이트 단위로 같은지, 시즌 중간에 저장하고 불러온 쪽과 그냥 진행한 쪽이 같은 끝 상태에 도달하는지 확인한다.

## 모든 숫자에 이름 있는 공식

구단 운영 세션의 설계 규칙은 `CLUB_OPERATIONS.md` 첫 문단에 있다. 모든 숫자는 능력치·상황·결정에 대한 이름 있는 공식에서 나오고, 고정 보너스와 임의 확률은 없다. 상수는 전부 `club/constants.ts`의 `CLUB_MODEL` 한 곳에 있다. 동시에 이 상수들이 설계값이라는 것도 분명히 적었다. e스포츠 연봉·스폰서십·이적료에 대한 공개 데이터는 언론 보도 정도뿐이고, 여기 나오는 어떤 숫자도 실제 계약이 아니다.

연봉과 이적 가치는 같은 능력 지수 `e`에서 나온다. CA를 실제 선수 범위로 정규화하고, 어린 선수일수록 PA와의 차이를 일부 더한다(연봉은 30%, 가치는 60%). 구단이 CA/PA를 읽을 때는 자기 스카우트의 추정치를 쓴다. 선수는 자기 실력을 알기 때문에 자기 역할을 판단할 때 진짜 CA를 쓰고, 팀 전력은 공개 정보라 진짜 CA를 쓴다. 누가 무엇을 아는지를 나눈 것은 엔진의 "전지적 판단 금지" 규칙을 구단 운영까지 끌고 온 것이다.

이적은 두 단계를 거친다. 파는 구단은 바이아웃 이상이면 반드시 받고, 요구액 이상이면 받고, 요구액의 60% 이상이면 요구액으로 역제안한다. 선수는 효용 `U = 1.0·ln(wage/ref) + 1.2·ambition·(S_to − S_from) + 0.6·(R_to − R_from) + 0.15·L`로 판단한다. 연봉, 팀 전력 차이에 숨겨진 야망을 곱한 값, 예상 역할(주전 1, 로테이션 0.35, 아카데미 0.1), 계약 기간 선호가 들어간다. U가 0 이상이면 받고, 아니면 U가 0.02가 되는 연봉으로 역제안한다. AI 구단은 이적 창이 열린 기간의 월요일마다 자기 지역에서 가장 약한 주전보다 추정 CA가 0.03 이상 높은 선수를 노린다.

재정은 리그 지원금, 스폰서십, 상금, 연봉, 운영비로 굴러간다. 처음에는 돈이 한쪽으로 쌓이거나 무한히 빠지는 문제를 막아야 했고, 그래서 두 개의 바닥과 천장을 두었다. 잔고가 연간 비용을 넘으면 넘는 부분의 60%를 재투자하고, 기대 수입의 −25% 아래로 떨어지면 구단주가 0까지 메운다. 시드를 고정해 3~5시즌을 돌리면 잔고 중앙값이 150만~180만 달러, 가장 부자 구단이 350만~400만 달러 근처에 머물고 아무도 부채 바닥을 넘지 않는다는 것을 `club.test.ts`가 확인한다.

훈련은 성장 공식에 F라는 항을 하나 더 곱하는 방식으로 들어갔다. 팀 포커스(사격, 유틸리티, 팀플레이, 전술, 휴식)와 개인 포커스에 따라 주마다 그룹별 노출량이 쌓이고, 시즌 말에 `F_k = (1 − 0.45) + 0.45 · 3 · x_g(k)`가 된다. 이 식은 일부러 합이 보존되게 짰다. 피로 기준 아래에서 균형 훈련을 하면 F가 정확히 1이고, 한 주를 다 쓰면 그룹 평균 F도 1이라서 포커스는 성장을 더하는 게 아니라 그룹 사이로 옮길 뿐이다. 훈련 계획이 없는 팀, 즉 모든 AI 구단은 이전과 바이트 단위로 똑같이 성장한다. 15차의 `MatchConfig.rosters`와 같은 방식의 보증이다.

## 같은 개념이 두 벌

문제는 시간 순서였다. 두 세션은 모두 `bcc3458`(12:52)에서 출발했다. 커리어 셸의 훅 API는 15분 뒤인 13:07에 커밋됐지만, 구단 운영 세션은 그걸 보기 전에 이미 "셸이 노출할 훅"을 가정하고 자기 인터페이스를 짜고 있었다. 구단 운영 핸드오프에는 셸의 API가 아직 공개되지 않아서 자기 `CareerHooks`에 맞춰 썼다고 적혀 있다. 커리어 셸 핸드오프에는 API를 구단 운영 세션에 보내면서 병행으로 만든 `ClubOpsHooks` 대신 이것을 쓰라고 요청했다고 적혀 있다. 요청은 전달됐지만, 구단 운영의 첫 커밋(`a1ab580`, 13:21)은 이미 자기 인터페이스 위에 서 있었다.

두 인터페이스는 이름만 다른 게 아니라 생각이 달랐다. 구단 쪽 `CareerHooks`는 `(world, date) => World`처럼 새 월드를 돌려주는 함수형이었고, 시간을 시험하려고 자체 로컬 드라이버와 데스크톱의 "+1일/주/월" 버튼까지 갖고 있었다. 무엇보다 시즌 종료 핸들러가 `advanceSeason`을 직접 불렀다. 반면 커리어 셸은 월드를 그 자리에서 바꾸는 방식이고, `onSeasonEnd`는 `advanceSeason` 전에 호출되며, `advanceSeason`은 셸 자신이 부른다. 같은 시즌 전환을 두 쪽이 각자 소유하려 했다. 구단 쪽 문서 주석에도 "셸은 `advanceSeason`을 또 부르면 안 된다, 직접 불러야 하는 셸이라면 이렇게 나눠 쓰라"는 단서가 붙어 있었다.

그 상태에서 13편에서 쓴 사고가 났다. 별도 세션이 `claude/final-merge`로 nav-engine, club-ops, career-shell 등 다섯 브랜치를 합쳐 main(`5e35ff8`)에 직접 푸시한 것이다. git 충돌은 `season.ts`와 `index.ts` 두 파일에서만 났고, 그 세션은 둘 다 기계적으로 풀었다. `advanceSeason`의 옵션은 양쪽 필드(`mapsPlayed`, `focus`)를 합친 `AdvanceSeasonOptions`로 만들고 `AdvanceOptions`를 별칭으로 남겼다. `index.ts`는 이렇게 됐다.

```ts
// Both the club layer (club/types.ts) and career mode (career/inbox.ts) define an `InboxItem`. Name the
// export explicitly (an explicit export wins over the two `export *`): career mode's is the inbox the app
// shows; the club layer's own message record is `ClubInboxItem`.
export type { InboxItem } from "./career/inbox.ts";
export type { InboxItem as ClubInboxItem } from "./club/types.ts";
// Same names in the club layer and career mode (both use ISO-date strings): career mode's are the plain
// names; the club layer's are re-exported with a `club` prefix.
export { addDays, daysBetween } from "./career/calendar.ts";
export { teamStrength } from "./career/schedule.ts";
export { addDays as clubAddDays, daysBetween as clubDaysBetween } from "./club/calendar.ts";
export { teamStrength as clubTeamStrength } from "./club/market.ts";
```

빌드는 통과하고 타입도 맞는다. 하지만 이 시점의 main에는 받은메일 항목 타입이 두 개, 날짜 도우미가 두 벌, 팀 전력 계산이 두 개, 시간을 움직이는 방법이 두 가지(Continue와 구단 화면의 +1일 버튼) 있었다. 구단 운영은 커리어 달력과 연결되지 않은 채 NRG를 기본 구단으로 놓고 자기 드라이버로 돌고 있었다. 첫날 통합(10편)에서 배운 것, 즉 git이 조용하다고 합쳐진 게 아니라는 교훈이 그대로 다시 나왔다. 충돌은 이름이 같은 곳에서만 나고, 개념이 같은 곳에서는 나지 않는다. 별칭 접두어 `club`은 그 겹침을 숨겨 줬을 뿐이다.

정리는 16:00 무렵 시작했다. 통합 세션이 final-merge에서 빠진 커밋을 다시 합친 뒤(16차), 커리어 셸 세션에 두 번째 작업으로 구단 운영 통합을 맡겼다. 세 커밋(`8050d2f`, `763d174`, `c6bd559`)이 16:17~16:23에 나왔다. 구단의 `CareerHooks`와 로컬 드라이버, `ClubClock` 버튼, `DEFAULT_USER_TEAM`, `club*` 별칭이 사라졌다. 받은메일 항목은 `career/inbox.ts` 하나, 날짜 도우미는 `career/calendar.ts` 하나, `teamStrength`는 `club/market.ts` 하나로 모였다. 구단의 메시지는 `club.outbox`에 쌓였다가 각 단계 뒤에 커리어 받은메일로 옮겨지고, 우리 선수에 대한 입찰은 수락/거절 선택지가 붙은 받은메일이 됐다.

구단 쪽은 `club/career-hook.ts`의 `clubCareerHook` 하나로 셸에 붙었다. `registerCareerHook`이 받는 `CareerHook` 모양을 그대로 구현하지만, 전역 등록 대신 `career.ts`의 훅 목록에 코어 훅 바로 다음 자리(order 10)로 고정해 넣었다. 구단 운영은 선택 모듈이 아니라 모든 커리어에 있어야 하는 층이기 때문이다. 구단 쪽이 미리 만들어 둔 `*Mut` 함수들(월드를 그 자리에서 바꾸는 버전)이 있어서 어댑터는 109줄로 끝났다. 시즌 전환의 소유권도 정리됐다. 구단 훅의 `onSeasonEnd`는 임대 복귀, 상금, 계약 만료까지만 하고, `advanceSeason`은 셸이 부른다.

```ts
state.world = advanceSeason(state.world, { mapsPlayed, focus: seasonFocus(state.world), managedTeams: [state.userTeamId] });
```

`managedTeams`는 이 통합에서 새로 생겼다. 원래 시즌 루프는 로스터가 다섯 명보다 적으면 FA를 영입하고, 여덟 명을 넘으면 방출하고, 아카데미 선수를 올렸다. 감독이 있는 게임에서 시즌이 끝날 때마다 감독 팀 로스터가 저절로 바뀌는 건 말이 안 된다. 커리어 셸의 첫 핸드오프에도 구단 운영이 계약과 이적을 넣을 때까지 감독 팀 로스터가 자동으로 바뀐다는 한계가 적혀 있었다. 이제 감독 팀은 은퇴 말고는 감독과 이적으로만 바뀐다.

## 경기가 구단을 읽기까지

17차 머지에는 통합 말고도 구단 층이 처음으로 경기에 닿는 변경이 같이 들어갔다. 구단 운영 핸드오프의 한계 목록에는 "피로는 훈련 효율에만 영향을 주고 경기에는 주지 않는다, 경기일과 시리즈는 월드 로스터를 아직 읽지 않는다"가 있었다. 이 둘을 `c6bd559`가 메웠다.

경기 전에 라인업 화면에서 다섯 명을 고르고, 각 선수의 준비도 `R = (1 − 0.25·max(0, f − 0.3)) · (1 − 0.08·(1 − s))`를 보여 준다. f는 훈련 피로에 맵당 0.03을 더한 값, s는 샤프니스로 맵을 뛸 때마다 오르고 30일 시간 상수로 빠진다. 준비도는 고정 보너스가 아니라 각 능력치를 리그 바닥 쪽으로 당기는 비율(`x' = floor + R·(x − floor)`)이라서, 지친 선수는 자기 실력에 비례해서 떨어진다. 훈련 계획의 전술 주간에 연습한 맵은 맵 기록에 연습 경기로 더해져 맵 숙련도의 연속성 항(C)으로 들어간다. 감독 경기의 K/D도 엔진 킬 이벤트에서 나와 폼 계산에 쓰인다. 엔진 판정 숫자는 바꾸지 않았고, 17차 기록에도 엔진 변경 없음(실제 로스터 6/8, 공격 0.455 유지)이라고 적혀 있다.

검증은 e2e로 했다. 커리어 e2e는 시작 메뉴에서 새 커리어를 만들고, 이사회 질문에 답하고, FA 한 명을 1년 계약으로 영입하고, 훈련 포커스와 연습 맵을 정한 뒤, 그 선수를 넣은 라인업으로 엔진 Bo3를 치르고, 배경에서 다른 팀 시리즈를 엔진으로 돌리고, 시즌을 끝까지 진행해 계약이 만료되는 것까지 확인한다. 시즌 루프가 감독 팀에 아무도 채워 넣지 않는다는 것도 이 테스트에서 본다. 첫 실행은 첫 경기일에서 실패했는데, 영입 입찰 질문이 Continue를 멈췄기 때문이었다. 테스트가 그 질문에 답하도록 고친 뒤 통과했다. 그 전의 첫 버전 e2e도 이사회 질문이 첫날부터 Continue를 막는다는 걸 몰라서 한 번 실패했다. 둘 다 버그가 아니라 설계한 동작을 테스트가 몰랐던 경우였다.

남은 일도 문서에 담담하게 적혀 있다. 계약이 만료돼 다섯 명 아래가 되면 라인업을 확정할 수 없는데 Home에서 경고하지 않는다. 상대 분석 화면과 전술 화면은 아직 커리어 월드가 아니라 데이터셋을 읽는다. 모든 맵은 Ascent 지형으로 시뮬레이션된다. 에이전트, 보너스, 이사회의 성적 목표, 스태프 시장 화면이 없다. 성장 상수와 재정 상수는 맞춰 볼 데이터가 없는 설계값이다. 능력치가 없는 실제 선수 825명은 성장하지 않고 리그 평균으로 취급되다가 나이가 들어 사라진다.

돌아보면 15~17차에서 반복된 장치는 하나였다. 새 층을 얹을 때마다 "이게 없으면 이전과 바이트 단위로 같다"는 테스트를 먼저 세웠다. `rosters`가 없는 경기, 훈련 계획이 없는 팀, `club`이 없는 월드가 모두 그랬다. 덕분에 세 층이 같은 날 쌓이는 동안 기본 경기 결과는 한 번도 바뀌지 않았다. 반대로 같은 날 같은 패키지를 두 세션이 나눠 가졌을 때는 인터페이스가 15분 늦게 나온 것만으로 두 벌의 설계가 생겼고, 그걸 하나로 접는 데 커밋 세 개와 머지 한 번이 더 필요했다.

## 참고 자료

- [docs/GENERATED_PEOPLE.md](https://github.com/2rangs/Project-VM/blob/main/docs/GENERATED_PEOPLE.md)
- [docs/CAREER_MODE.md](https://github.com/2rangs/Project-VM/blob/main/docs/CAREER_MODE.md)
- [docs/CLUB_OPERATIONS.md](https://github.com/2rangs/Project-VM/blob/main/docs/CLUB_OPERATIONS.md)
- [docs/handoff/career-shell.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoff/career-shell.md)
- [docs/handoff/club-ops.md](https://github.com/2rangs/Project-VM/blob/main/docs/handoff/club-ops.md)
- [docs/WORK_HISTORY.md](https://github.com/2rangs/Project-VM/blob/main/docs/WORK_HISTORY.md)
- [packages/career/src/career/hooks.ts](https://github.com/2rangs/Project-VM/blob/main/packages/career/src/career/hooks.ts)
- [packages/career/src/club/career-hook.ts](https://github.com/2rangs/Project-VM/blob/main/packages/career/src/club/career-hook.ts)
