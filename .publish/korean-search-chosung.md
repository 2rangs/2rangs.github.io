
연락처 앱에서 "ㄱㅇㄹ"만 쳐도 "김이랑"이 나옵니다.
너무 익숙해서 당연한 기능처럼 느껴집니다.
그런데 막상 직접 만들려고 하면 손이 멈춥니다.
`'김이랑'.includes('ㄱ')`는 `false`니까요.

오늘은 한글 검색이 왜 까다로운지, 그리고 초성 검색을 어떻게 만드는지 정리해 보겠습니다.

## 한글 음절은 계산으로 만들어집니다

유니코드에는 완성된 한글 음절이 `U+AC00`(가)부터 `U+D7A3`(힣)까지 들어 있습니다.
모두 11,172자입니다.
이 순서는 아무렇게나 정해진 게 아닙니다.

한글 음절은 초성, 중성, 종성의 조합입니다.
초성은 19개, 중성은 21개, 종성은 "없음"을 포함해 28개입니다.
유니코드 표준은 이 조합을 순서대로 늘어놓았습니다.

- 음절 코드 = `0xAC00 + (초성 × 21 + 중성) × 28 + 종성`
- 19 × 21 × 28 = 11,172

그래서 거꾸로 계산하면 자모를 꺼낼 수 있습니다.
중성과 종성 조합이 21 × 28 = 588가지라서, 588로 나누면 초성 번호가 나옵니다.

```js
function decompose(ch) {
  const code = ch.codePointAt(0) - 0xAC00;
  if (code < 0 || code >= 11172) return null; // 완성형 한글이 아님

  return {
    cho: Math.floor(code / 588),         // 0 ~ 18
    jung: Math.floor((code % 588) / 28), // 0 ~ 20
    jong: code % 28,                     // 0 ~ 27, 0이면 받침 없음
  };
}

decompose('각'); // { cho: 0, jung: 0, jong: 1 }
decompose('힣'); // { cho: 18, jung: 20, jong: 27 }
```

`'각'`은 초성 ㄱ(0), 중성 ㅏ(0), 종성 ㄱ(1)입니다.
마지막 글자 `'힣'`은 각각 마지막 번호인 18, 20, 27이 나옵니다.
계산이 맞다는 뜻이죠.

## 초성만 뽑아 보기

초성 번호를 글자로 바꾸려면 표가 하나 필요합니다.
여기서 쓰는 `ㄱ`, `ㄴ` 같은 글자는 우리가 키보드로 치는 "호환용 자모"입니다.
유니코드 순서대로 19개를 적어 두면 됩니다.

```js
const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

function getChosung(str) {
  let result = '';
  for (const ch of str) {
    const code = ch.codePointAt(0) - 0xAC00;
    result += code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : ch;
  }
  return result;
}

getChosung('김이랑');      // 'ㄱㅇㄹ'
getChosung('React 훅');   // 'React ㅎ'
```

한글이 아닌 글자는 그대로 둡니다.
그래야 영어나 숫자가 섞인 이름도 자연스럽게 검색됩니다.

## 섞어서 쳐도 찾아 주기

사람들은 "ㄱㅊ"처럼 초성만 치기도 하고, "김ㅊ"처럼 섞어 치기도 합니다.
그래서 글자를 하나씩 비교하는 방식이 다루기 쉽습니다.
입력한 글자가 초성이면 대상 글자의 초성과, 아니면 글자 자체와 비교합니다.

```js
const isCho = (c) => CHO.includes(c);

function matches(target, query) {
  const t = [...target];
  const q = [...query];

  for (let start = 0; start + q.length <= t.length; start++) {
    const ok = q.every((c, i) =>
      isCho(c) ? getChosung(t[start + i]) === c : t[start + i] === c
    );
    if (ok) return true;
  }
  return false;
}

matches('김치찌개', 'ㄱㅊ'); // true
matches('김치찌개', '김ㅊ'); // true
matches('된장찌개', '김ㅊ'); // false
```

목록이 수천 개라면 매번 계산하지 말고 초성 문자열을 미리 만들어 두세요.
저도 처음엔 키 입력마다 전부 다시 계산했다가 입력이 버벅여서 고생했습니다.

## 같은 글자인데 비교가 안 될 때

여기까지 하면 끝일 것 같지만, 함정이 하나 더 있습니다.
화면에서는 똑같이 "한글"인데 `===`가 `false`인 경우가 있거든요.

유니코드에서 한글은 두 가지로 적을 수 있습니다.
"한"을 한 글자로 적는 완성형과, ㅎ·ㅏ·ㄴ 세 개의 자모를 이어 적는 조합형입니다.
보이는 건 같지만 들어 있는 코드는 다릅니다.

이럴 때 쓰는 게 `String.prototype.normalize()`입니다.
`'NFC'`는 분해한 뒤 다시 합치고, `'NFD'`는 분해만 합니다.
인자를 생략하면 `'NFC'`가 쓰입니다.

```js
const nfd = '한글'.normalize('NFD');

nfd.length;                      // 6 (자모 6개)
'한글'.length;                   // 2
nfd === '한글';                  // false
nfd.normalize('NFC') === '한글'; // true
```

조합형으로 들어온 글자는 `0xAC00` 계산식에 걸리지 않습니다.
그래서 검색 전에 대상과 입력을 모두 `normalize()`로 맞춰 두는 게 안전합니다.
파일 이름이나 다른 시스템에서 넘어온 텍스트를 다룰 때 특히 그렇습니다.

> **참고** 위 `matches` 예시는 이해를 돕기 위한 단순한 버전입니다. 쌍자음 받침이나 "갑ㅅ"처럼 받침이 다음 초성으로 넘어가는 입력까지 처리하려면 종성을 다시 쪼개는 규칙이 더 필요합니다.

## 정리

한글 초성 검색의 핵심은 `0xAC00`과 588, 28 세 숫자입니다.
여기에 `normalize()`로 형태를 맞춰 주면 대부분의 경우를 다룰 수 있습니다.
생각보다 계산 몇 줄이면 되니, 한 번 직접 만들어 보시는 건 어떨까요?

## 참고

- [Unicode Standard, Chapter 3.12 Conjoining Jamo Behavior](https://www.unicode.org/versions/latest/core-spec/chapter-3/)
- [MDN, String.prototype.normalize()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)
- [MDN, String.prototype.codePointAt()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt)
