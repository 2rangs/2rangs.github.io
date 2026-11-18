---
title: pokebattle-engine
kind: personal
order: 9
tags: [TypeScript, Pokémon Showdown, tsup, Vitest, 퍼징 테스트]
summary: Showdown 시뮬레이터를 감싼 TypeScript 전투 엔진. 1,000만 번의 배틀로 검증.
highlight: 규칙을 다시 짜지 않고 검증된 시뮬레이터를 감싼 뒤, 1,000만 번의 배틀로 어긋남이 없는지 확인했다.
cover: img/projects/pokebattle-engine.png
link: https://github.com/2rangs/pokebattle-engine
demo: /portfolio/pokebattle-engine/
---

## 한눈에

| 항목 | 내용 |
|---|---|
| 무엇 | 웹 앱에서 포켓몬 배틀을 돌리기 위한 TypeScript 라이브러리 |
| 기반 | 전투 규칙 `@pkmn/sim`(Pokémon Showdown), 데미지 계산 `@smogon/calc`, 이름·데이터 PokeAPI |
| 규모 | 테스트·문서 사이트 포함 약 7,100줄, 엔진 본체 `BattleEngine.ts` 1,232줄 |
| 이벤트 | 타입이 있는 배틀 이벤트 34종 |
| 테스트 | 단위 테스트 122개, 푸시마다 퍼징 1만 번, 수동 실행 시 1,000만 번 |
| 쓰는 곳 | [Pokestra](/projects/pokestra/)의 배틀 시뮬레이터와 데미지 계산기, 문서 사이트 |

## 왜 만들었나

처음에는 전투 규칙을 직접 짰습니다. 기술 몇 개, 특성 몇 개까지는 괜찮았지만 9세대의 기술·특성·도구가 서로 얽히는 경우의 수를 손으로 따라가는 건 끝이 없었습니다. 그래서 방향을 바꿨습니다. **규칙은 이미 수많은 사람이 검증한 Showdown 시뮬레이터에 맡기고, 나는 그 바깥을 제대로 만든다.**

그런데 Showdown은 서버용으로 만들어진 시뮬레이터라, 화면을 만들기에는 불편한 점이 많았습니다.

- **결과가 텍스트 프로토콜이다.** `|-damage|p2a: Garchomp|54/100` 같은 줄을 직접 해석해야 하고, 공개 줄에는 HP가 정확한 값이 아니라 퍼센트로만 나옵니다.
- **로그 없이 바뀌는 상태가 있다.** 재생력·자연회복처럼 교체할 때 조용히 HP나 상태이상이 바뀌는 경우, 로그만 따라가면 화면의 HP가 실제와 어긋납니다.
- **요청에 숨은 정보가 있다.** 그림자밟기 같은 숨은 교체 불가, 봉인 같은 숨은 사용 불가는 요청에 "그럴 수도 있다"로만 표시됩니다. 이걸 그대로 버튼으로 보여 주면 누른 뒤에 거절당합니다.
- **이름 체계가 PokeAPI와 다르다.** PokeAPI의 `urshifu-rapid-strike`는 Showdown에서 `urshifurapidstrike`입니다.
- **한국어 로그가 없다.**

## 구조: 한 턴이 흘러가는 길

1. **`submitAction()`**: 받은 행동을 `getRequest()`가 제시한 선택지와 대조해 검증하고, Showdown 선택 문자열(`move 1, switch 3`)로 바꿔 시뮬레이터에 넘깁니다.
2. **시뮬레이터가 턴을 진행**하면서 프로토콜 로그를 한 줄씩 씁니다.
3. 엔진은 시뮬레이터의 `log.push`를 가로채, **줄이 쓰이는 바로 그 순간** 해석해서 타입 있는 이벤트(`move_use`, `damage`, `switch`, `faint` …)로 바꿉니다.
4. **`emit()`**: 이벤트를 기록하고, 해당 타입 구독자와 전체 구독자에게 차례로 알립니다. React 훅과 한국어 로그 포매터는 모두 이 구독자입니다.
5. **턴이 끝나면** 엔진이 추적하던 HP·상태를 시뮬레이터의 실제 값과 맞춰 보고, 어긋난 만큼 보정 이벤트를 낸 뒤 `turn_end`와 다음 `turn_start`를 냅니다.

## 핵심 구현

### 1. 로그가 쓰이는 순간에 해석하기

턴이 끝난 뒤 로그를 한꺼번에 해석하면, 그 줄이 쓰였을 때의 상태를 이미 잃은 뒤입니다. 그래서 시뮬레이터의 `log.push`를 감싸 줄이 들어오는 즉시 해석하게 했습니다.

정확한 HP는 `|split|` 다음에 오는 비공개 줄에만 있고, 바로 뒤에 퍼센트로 된 공개 줄이 중복으로 따라옵니다. 작은 상태 기계로 비공개 줄만 쓰고 공개 줄은 버립니다.

```ts
log.push = function (...lines: string[]) {
  const n = Array.prototype.push.apply(this, lines)
  if (self.ready) for (const line of lines) self.parseLine(line)
  return n
}

// parseLine 안
if (cmd === 'split') { this.splitState = 1; return }
if (this.splitState === 1) { this.splitState = 2 }                 // 비공개 줄: 정확한 HP
else if (this.splitState === 2) { this.splitState = 0; return }    // 공개 줄: 퍼센트라 버림
```

급소·효과가 굉장했다·효과가 별로였다 같은 줄은 잠시 들고 있다가 바로 다음 `damage` 이벤트에 붙입니다. 그래서 화면은 데미지 이벤트 하나만 보고도 "급소에 맞았다, 효과가 굉장했다"를 함께 보여 줄 수 있습니다.

### 2. 로그 없이 바뀐 상태를 보정 이벤트로

엔진은 포켓몬마다 마지막으로 알린 HP와 상태이상을 기억합니다. 교체가 일어날 때와 매 턴이 끝날 때 이 값을 시뮬레이터의 실제 값과 비교해, 다르면 그 차이만큼 `heal`·`damage`·`status_apply`·`status_remove` 이벤트를 만들어 냅니다.

```ts
const prev = this.lastHp.get(id); const now = Math.max(0, p.hp)
if (prev !== undefined && prev !== now && !p.fainted) {
  this.lastHp.set(id, now)
  const source = now > prev && toID(p.ability) === 'regenerator' ? 'regenerator' : reason
  if (now > prev) this.emit({ type: 'heal', pokemon_id: id, amount: now - prev, source, hp_after: now })
  else this.emit({ type: 'damage', pokemon_id: id, amount: prev - now, source, hp_after: now })
}
```

덕분에 **이벤트만 순서대로 따라가도 HP가 시뮬레이터와 정확히 같아집니다.** Pokestra가 배틀을 장면 단위로 재생할 수 있는 것도 이 보장 덕분입니다.

### 3. Showdown에 없는 로테이션 배틀 구현

로테이션 배틀은 세 마리를 내보내지만 앞에 선 한 마리만 싸우고, 턴 시작에 뒤의 포켓몬과 자리를 돌릴 수 있는 형식입니다. Showdown에는 이름만 있고 실제 규칙은 구현되어 있지 않습니다.

시뮬레이터를 고치는 대신, 트리플 배틀 위에서 몇 가지 메서드를 **런타임에 감싸는** 방식을 택했습니다. 감싼 메서드는 로테이션으로 표시한 배틀에서만 새 동작을 하고, 다른 배틀에서는 원래 메서드를 그대로 부릅니다. 같은 프로세스에서 다른 형식의 배틀이 함께 돌아가도 영향이 없습니다.

```ts
const wrap = (proto, name, impl, getBattle) => {
  const orig = proto[name]; const patched = impl(orig)
  proto[name] = function (...args) {
    return isRotation(getBattle(this)) ? patched.apply(this, args) : orig.apply(this, args)
  }
}

// 뒤에 있던 포켓몬이 기술을 고르면, 턴 맨 앞(교체·선공기보다 먼저)에 자리 이동을 끼워 넣는다
wrap(Side.prototype, 'commitChoices', (orig) => function () {
  const movers = this.choice.actions.filter((a) => a.choice === 'move' && a.pokemon.position !== FRONT)
  for (const a of movers) this.choice.actions.push({ choice: 'shift', pokemon: a.pokemon, order: ROTATE_ORDER })
  return orig.call(this)
}, (side) => side.battle)
```

- 공격 대상과 아군·상대 판정은 앞에 선 포켓몬끼리로 좁혔습니다.
- 한 턴에 한 마리만 행동하게 했습니다.
- 자리 이동은 교체가 아니므로 능력치 변화가 유지되고, 등장 특성은 다시 발동하지 않습니다.

### 4. 요청에 숨은 정보 채워 넣기

Showdown의 요청은 상대에게 정보를 흘리지 않으려고 숨은 교체 불가를 `maybeTrapped`로만 알려 줍니다. 하지만 엔진은 양쪽을 모두 아는 쪽이므로, 실제 포켓몬 상태를 읽어 확실한 값으로 바꿉니다.

```ts
const trapped = !!a.trapped || (!!a.maybeTrapped && !!live.trapped)
```

- 봉인으로 막힌 기술은 버튼에서 뺍니다.
- 이미 교체되어 들어오기로 예약된 포켓몬은 교체 후보에서 뺍니다.
- 부활의 기원 차례에는 기절한 포켓몬만 후보로 보여 줍니다.

그래서 화면에 보이는 선택지는 **누르면 반드시 받아들여지는 것**만 남습니다.

### 5. 받침을 보고 고르는 한국어 조사

배틀 로그 문장은 `이(가)`, `은(는)`, `을(를)`, `과(와)`로 써 두고, 앞 글자의 받침 유무를 유니코드 계산으로 판단해 조사를 고릅니다. 한글이 아닌 글자 뒤에는 괄호 표기를 그대로 둡니다.

```ts
return text.replace(/(.)(이\(가\)|은\(는\)|을\(를\)|과\(와\))/g, (_, prev, pair) => {
  const code = prev.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return prev + pair
  const hasBatchim = (code - 0xac00) % 28 !== 0
  const [withB, withoutB] = PAIRS[pair]
  return prev + (hasBatchim ? withB : withoutB)
})
```

"한카리아스**는** 쓰러졌다!", "상대 타부자고**를** 공격했다!"처럼 포켓몬 이름이 바뀌어도 문장이 자연스럽습니다.

### 6. PokeAPI 이름을 Showdown ID로

PokeAPI 이름을 Showdown ID로 바꿀 때 네 단계를 차례로 시도합니다.

1. 규칙으로 풀 수 없는 17개 폼은 별칭표로 직접 연결
2. 그대로 ID로 바꿔 보기
3. `-incarnate`, `-single-strike`처럼 기본 폼을 뜻하는 접미사 제거
4. 끝의 `-` 마디를 하나씩 떼어 가며 존재하는 종 찾기

이렇게 PokeAPI의 포켓몬 1,351개(폼 포함)를 모두 연결했고, 반대 방향 변환도 제공합니다.

## 검증: 1,000만 번의 배틀

감싼 코드는 시뮬레이터와 어긋나는 순간 조용히 틀린 화면을 만듭니다. 사람이 떠올리는 테스트 케이스로는 기술·특성·도구 조합을 다 볼 수 없어서, 무작위 배틀을 대량으로 돌려 규칙을 확인하는 퍼징 테스트를 만들었습니다.

### 무엇을 섞나

| 항목 | 분포 |
|---|---|
| 형식 | 싱글 65% · 더블 15% · 트리플 10% · 로테이션 10% |
| 팀 | Showdown 랜덤 배틀 세트 50% · 종·특성·도구·기술·레벨까지 무작위로 섞은 팀 50% |
| 팀 미리보기 | 20% |
| 행동 | 무작위, 일부는 휴리스틱 AI |

### 무엇을 검사하나: 7가지 불변식

1. 예외가 나지 않는다.
2. 엔진이 제시한 행동은 시뮬레이터가 모두 받아들인다.
3. 해석하지 못한 프로토콜 줄이 하나도 없다.
4. 모든 이벤트는 실제로 있는 포켓몬을 가리킨다.
5. **이벤트만으로 다시 계산한 HP가 시뮬레이터의 실제 HP와 같다.**
6. 기절 수와 승자가 서로 맞는다.
7. 같은 시드로 다시 돌리면 같은 로그가 나온다(1% 표본).

### 어떻게 돌리나

- **푸시·PR마다:** GitHub Actions에서 타입 검사, 단위 테스트, 퍼징 1만 번
- **필요할 때:** 수동 실행 워크플로가 기본 10개 샤드 × 100만 번 = 1,000만 번을 병렬로 돌리고, 실패 종류를 모아 요약
- 모든 배틀은 시드로 재현되므로, 실패한 배틀은 시드 하나로 다시 열어 볼 수 있습니다.

## 퍼징이 실제로 잡은 버그

| 버그 | 원인 | 해결 |
|---|---|---|
| 낼 수 있는 행동이 0개 | 봉인으로 모든 기술이 막히고 교체할 포켓몬도 없을 때, 엔진이 아무 선택지도 주지 않았음. CI 퍼징의 시드 8022에서 발견 | 이 경우 발버둥으로 이어지는 행동을 제시 |
| 이미 들어오기로 한 포켓몬을 또 교체 후보로 제시 | 탈출팩처럼 턴 중간에 강제 교체가 일어난 뒤의 대기열을 보지 않았음. 약 9만 7천 번 중 3번 발생 | 시뮬레이터의 행동 대기열을 확인해 예약된 포켓몬 제외 |
| 자리 교환 후 위치가 틀어짐 | 시뮬레이터가 실제로 옮기기 전에 위치를 읽었음 | 위치를 프로토콜 줄에서 직접 읽도록 변경 |
| 팀 등록 전 상태 조회 시 오류 | 배틀 시작 구독자 안에서 상태를 읽으면 아직 팀이 없었음 | 등록 전에는 안전한 기본값이나 `null` 반환 |

2번째와 3번째 불변식("제시한 행동은 모두 받아들여진다", "해석하지 못한 줄이 없다")이 있었기 때문에, 사람이 손으로는 만들기 어려운 이런 상황이 드러났습니다.

## 문서 사이트

위의 **사이트 열기**로 들어가는 문서 사이트는 엔진을 브라우저에서 직접 돌리는 플레이그라운드입니다.

- 약 12개 문서 페이지와 19개의 실행 가능한 예제(빠른 시작, 요청, 이벤트, 한국어 로그, 데미지 계산, 더블·트리플·로테이션, 팀 미리보기, 규칙 옵션 등)
- 예제마다 코드와 실행 버튼이 있고, 실행하면 실제 엔진이 돌아 결과와 걸린 시간을 보여 줍니다. 잘못된 입력 예제는 오류가 어떻게 나는지도 그대로 보여 줍니다.
- 한국어·영어 전환을 지원하고, 해시 라우팅으로 어느 정적 호스팅에서든 동작합니다.

## 배운 점

- **다시 만들기보다 잘 감싸기.** 이미 검증된 구현이 있다면, 내가 할 일은 그 바깥을 쓰기 좋게 만드는 것이다. 대신 감싼 쪽이 어긋나지 않는다는 걸 끝까지 증명해야 한다.
- **테스트 케이스보다 불변식.** "이 입력이면 이 결과"를 하나씩 적는 대신 "어떤 입력이든 이건 지켜져야 한다"를 정하고 무작위 입력을 대량으로 넣으면, 생각하지 못한 조합이 드러난다.
- **라이브러리의 사용자는 개발자다.** 타입, 이벤트 이름, 오류 메시지, 문서의 실행 예제가 곧 UX다.
