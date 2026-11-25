
어느 날 디자이너가 말합니다. "브랜드 색을 파란색에서 초록색으로 바꾸기로 했어요."

코드를 검색해 봅니다. `--blue-500`이 300군데에 나옵니다. 그런데 전부 바꾸면 안 됩니다. 그중 일부는 브랜드 색이 아니라 그냥 "정보" 표시용 파란색이거든요. 하나하나 열어서 이게 어떤 파란색인지 확인해야 합니다.

이런 일이 생기는 이유는 간단합니다. 이름이 **어떻게 생겼는지**만 말하고, **무엇에 쓰는지**는 말하지 않아서예요.

## 두 종류의 이름

디자인 시스템에서는 색 이름을 보통 두 층으로 나눕니다.

**원시 토큰**은 팔레트 그 자체입니다. "이런 색이 있다"만 말해요.

```css
:root {
  --blue-500: #2f6fed;
  --blue-600: #2459c7;
  --green-500: #1f9d63;
  --gray-50: #f7f8fa;
  --gray-900: #16181d;
}
```

**의미 토큰**은 역할을 말합니다. "이 색은 주요 버튼 배경에 쓴다"처럼요.

```css
:root {
  --color-bg-primary: var(--blue-500);
  --color-bg-primary-hover: var(--blue-600);
  --color-bg-surface: var(--gray-50);
  --color-text-default: var(--gray-900);
}
```

컴포넌트는 의미 토큰만 씁니다. 원시 토큰은 의미 토큰을 정의할 때만 등장하고요.

```css
.button-primary {
  background: var(--color-bg-primary);
  color: white;
}

.button-primary:hover {
  background: var(--color-bg-primary-hover);
}
```

이제 브랜드 색을 바꾸려면 어디를 고치면 될까요? 의미 토큰 두 줄입니다.

```css
:root {
  --color-bg-primary: var(--green-500);
}
```

버튼 코드는 한 글자도 바뀌지 않습니다. 정보 표시용 파란색은 따로 이름이 있으니 건드릴 일도 없고요.

## 다크 모드에서 진가가 나옵니다

다크 모드를 생각해 보면 차이가 더 분명해집니다.

`--gray-50`은 아주 밝은 회색입니다. 다크 모드에서 이 값을 어두운 색으로 바꾸면 어떻게 될까요? 이름은 "밝은 회색"인데 실제로는 어두운 색이 됩니다. 코드를 읽는 사람이 헷갈리기 시작하죠.

의미 토큰은 이런 문제가 없습니다. `--color-bg-surface`는 "표면 배경"이라는 뜻이라, 라이트에서는 밝고 다크에서는 어두워도 이름이 거짓말을 하지 않아요.

```css
:root {
  color-scheme: light dark;
  --color-bg-surface: var(--gray-50);
  --color-text-default: var(--gray-900);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-surface: var(--gray-900);
    --color-text-default: var(--gray-50);
  }
}

body {
  background: var(--color-bg-surface);
  color: var(--color-text-default);
}
```

원시 토큰은 그대로 두고 연결만 바꿨습니다. 팔레트는 하나, 연결표는 테마마다 하나입니다.

사용자가 직접 테마를 고르는 사이트라면 속성 선택자를 하나 더 둡니다.

```css
:root[data-theme="dark"] {
  --color-bg-surface: var(--gray-900);
  --color-text-default: var(--gray-50);
}
```

## CSS 변수라서 되는 일

이 구조가 깔끔하게 돌아가는 건 CSS 사용자 정의 속성이 **상속**되기 때문입니다. MDN에 따르면 `--`로 만든 사용자 정의 속성은 캐스케이드를 따르고 부모 값을 물려받습니다.

그래서 특정 영역에만 다른 값을 줄 수도 있어요.

```css
.promo-banner {
  --color-bg-primary: var(--green-500);
}
```

이 배너 안에 있는 버튼만 초록색이 됩니다. 버튼 컴포넌트에 `variant` 속성을 하나 더 만들지 않아도 됩니다.

`var()`의 두 번째 인자로 대체 값도 줄 수 있습니다.

```css
.card {
  border-color: var(--color-border-subtle, #e3e5e8);
}
```

토큰이 아직 정의되지 않은 환경에서도 깨지지 않게 하는 안전장치입니다. 다만 대체 값이 많아지면 진짜 값이 어디서 오는지 찾기 어려워지니 꼭 필요한 곳에만 쓰는 게 좋습니다.

`--`로 만든 사용자 정의 속성은 이름의 대소문자를 구분합니다. `--Color-Primary`와 `--color-primary`는 다른 변수예요. 팀에서 소문자와 하이픈으로 통일해 두면 실수가 줄어듭니다.

## 이름 짓는 규칙

의미 토큰은 이름이 길어지기 쉽습니다. 그래서 규칙을 먼저 정해 두는 게 좋아요. 제가 자주 쓰는 순서는 이렇습니다.

```text
--color-{용도}-{역할}-{상태}

--color-bg-primary
--color-bg-primary-hover
--color-text-muted
--color-border-danger
```

몇 가지 기준도 같이 둡니다.

- **용도**는 `bg`, `text`, `border`, `icon`처럼 어디에 칠하는지입니다.
- **역할**은 `primary`, `danger`, `success`, `muted`처럼 왜 이 색인지입니다.
- **상태**는 `hover`, `active`, `disabled`처럼 필요할 때만 붙입니다.
- 이름에 색 이름(`blue`, `red`)을 넣지 않습니다. 넣는 순간 원시 토큰이 됩니다.
- 컴포넌트 이름(`button`, `modal`)은 정말 그 컴포넌트에만 쓰일 때만 넣습니다.

`danger`가 빨간색이 아닐 날이 올까 싶지만, 다크 모드에서는 같은 빨강이라도 더 밝은 값을 써야 할 때가 많습니다. 이름이 역할만 말하고 있으면 그런 조정이 쉬워요.

## 주의할 점

모든 색을 의미 토큰으로 만들 필요는 없습니다. 한 번만 쓰이는 일러스트 색까지 이름을 붙이면 토큰 목록만 길어지고 아무도 안 씁니다.

반대로 의미 토큰을 너무 잘게 쪼개도 곤란합니다. `--color-bg-card-header-left` 같은 이름이 보이기 시작하면 한 번 멈추고 정리할 때입니다.

저는 "이 색이 바뀔 때 같이 바뀌어야 하는 곳이 두 군데 이상인가?"를 기준으로 삼습니다. 그렇다면 이름을 붙일 가치가 있다고 보는 거죠.

`blue-500`은 색이 어떻게 생겼는지 말하고, `primary`는 색이 무슨 일을 하는지 말합니다. 생김새는 바뀌어도 역할은 잘 안 바뀝니다. 그래서 컴포넌트는 역할의 이름을 알고 있어야 합니다.

## 참고

- [Using CSS custom properties | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)
- [var() | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/var)
- [prefers-color-scheme | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme)
- [color-scheme | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme)
